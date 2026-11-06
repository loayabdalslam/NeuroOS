import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, clipboard, Notification, shell } from 'electron';
import type { AppInfo, LaunchedApp, SystemStats, WindowInfo } from '@shared/types';
import { Paths } from '../core/store';
import { log } from '../core/ipc';
import { ensureDir, newId, nowIso } from '../core/util';
import { ptyAvailable } from './terminal.service';

function runPowerShell(script: string, timeout = 12_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}

function runFile(file: string, args: string[], timeout = 12_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

export class SystemService {
  private lastCpu = os.cpus().map((c) => c.times);
  private processCount = 0;
  private lastProcessSample = 0;
  private cachedStats: SystemStats | null = null;

  async info(): Promise<AppInfo> {
    let gpu = 'Unknown';
    if (process.platform === 'win32') {
      try {
        const out = await runPowerShell('(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name', 6000);
        const line = out.trim().split('\n')[0]?.trim();
        if (line) gpu = line.replace(/\s+/g, ' ');
      } catch {
        gpu = 'Unavailable';
      }
    }
    return {
      name: 'Neuro OS',
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
      userData: Paths.userData,
      home: os.homedir(),
      cpus: os.cpus().length,
      memoryTotal: os.totalmem(),
      gpu,
      ptyAvailable: ptyAvailable(),
      shell: process.platform === 'win32' ? 'PowerShell' : process.env.SHELL ?? 'sh',
    };
  }

  stats(): SystemStats {
    const now = Date.now();
    const cpus = os.cpus();
    let idleDelta = 0;
    let totalDelta = 0;
    cpus.forEach((cpu, i) => {
      const prev = this.lastCpu[i] ?? cpu.times;
      const idle = cpu.times.idle - prev.idle;
      const total =
        cpu.times.user - prev.user +
        cpu.times.nice - prev.nice +
        cpu.times.sys - prev.sys +
        cpu.times.irq - prev.irq +
        idle;
      idleDelta += idle;
      totalDelta += total;
    });
    this.lastCpu = cpus.map((c) => c.times);
    const cpu = totalDelta > 0 ? Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100))) : 0;
    const memoryTotal = os.totalmem();
    const memoryUsed = memoryTotal - os.freemem();
    const uptime = os.uptime();
    const network: 'online' | 'offline' = process.platform === 'win32' ? 'online' : 'online';

    if (now - this.lastProcessSample > 10_000 && process.platform === 'win32') {
      this.lastProcessSample = now;
      void runPowerShell('(Get-Process).Count', 6000)
        .then((out) => {
          const n = Number(out.trim());
          if (Number.isFinite(n)) this.processCount = n;
        })
        .catch(() => {});
    }

    this.cachedStats = {
      cpu,
      memoryUsed,
      memoryTotal,
      uptime,
      processes: this.processCount || 0,
      battery: null,
      network,
      timestamp: now,
    };
    return this.cachedStats;
  }

  async screenshot(): Promise<{ path: string; dataUrl: string }> {
    const dir = path.join(Paths.cache, 'screenshots');
    await ensureDir(dir);
    const file = path.join(dir, `capture-${newId('shot')}.png`);
    if (process.platform === 'win32') {
      const script = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save('${file.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bmp.Dispose()
Write-Output 'ok'
`;
      await runPowerShell(script, 15_000);
    } else {
      await runFile('screencapture', ['-x', file]);
    }
    const buffer = fs.readFileSync(file);
    return { path: file, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
  }

  launchApp(command: string, args: string[] = []): LaunchedApp {
    const isUrl = /^https?:\/\//i.test(command);
    if (isUrl) {
      void shell.openExternal(command);
      return { pid: 0, name: command, path: command };
    }
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false, shell: process.platform === 'win32' });
    child.unref();
    return { pid: child.pid ?? 0, name: path.basename(command), path: command };
  }

  async windows(): Promise<WindowInfo[]> {
    if (process.platform !== 'win32') return [];
    try {
      const out = await runPowerShell(
        `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress`,
        9000,
      );
      const parsed = JSON.parse(out.trim() || '[]');
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map((w: any) => ({
        title: w.MainWindowTitle,
        processId: w.Id,
        processName: w.ProcessName,
        handle: String(w.Id),
      }));
    } catch (error) {
      log.warn('system', 'window enumeration failed', error);
      return [];
    }
  }

  async focusWindow(title: string): Promise<boolean> {
    if (process.platform !== 'win32') return false;
    const escaped = title.replace(/'/g, "''");
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*${escaped}*' } | Select-Object -First 1
if ($p) { [Win32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null; [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null; Write-Output 'ok' } else { Write-Output 'notfound' }
`;
    try {
      const out = await runPowerShell(script, 8000);
      return out.includes('ok');
    } catch {
      return false;
    }
  }

  async killProcess(pid: number): Promise<boolean> {
    try {
      process.kill(pid);
      return true;
    } catch {
      if (process.platform === 'win32') {
        try {
          await runFile('taskkill', ['/PID', String(pid), '/F'], 5000);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async volume(delta: number): Promise<{ ok: boolean; level?: number }> {
    if (process.platform !== 'win32') return { ok: false };
    const key = delta > 0 ? 175 : 174;
    const times = Math.max(1, Math.min(10, Math.abs(delta)));
    const script = `$w = New-Object -ComObject WScript.Shell; 1..${times} | ForEach-Object { $w.SendKeys([char]${key}) }; Write-Output 'ok'`;
    try {
      await runPowerShell(script, 6000);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  clipboardRead(): string {
    return clipboard.readText();
  }

  clipboardWrite(text: string): void {
    clipboard.writeText(text);
  }

  notify(title: string, body: string): void {
    if (!Notification.isSupported()) return;
    new Notification({ title, body, silent: false }).show();
  }

  env(): { shell: string; home: string; cwd: string; path: string } {
    return {
      shell: process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL ?? '/bin/sh',
      home: os.homedir(),
      cwd: process.cwd(),
      path: process.env.PATH ?? '',
    };
  }

  async openExternal(url: string): Promise<{ ok: boolean }> {
    await shell.openExternal(url);
    return { ok: true };
  }

  showItemInFolder(target: string): void {
    shell.showItemInFolder(target);
  }

  revealPath(target: string): void {
    shell.showItemInFolder(target);
  }

  userDataFolder(): string {
    return Paths.userData;
  }
}

export const systemBootTime = (): string => nowIso();
