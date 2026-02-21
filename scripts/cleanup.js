const { execSync } = require('child_process');

const port = process.argv[2] || 5173;
console.log(`[Cleanup] Checking port ${port}...`);

try {
    let cmd = '';
    if (process.platform === 'win32') {
        cmd = `netstat -ano | findstr :${port}`;
    } else {
        cmd = `lsof -i tcp:${port} | grep LISTEN`;
    }

    const output = execSync(cmd).toString();
    const lines = output.trim().split('\n');

    lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = process.platform === 'win32' ? parts[parts.length - 1] : parts[1];

        if (pid && !isNaN(pid) && pid !== '0' && pid !== process.pid.toString()) {
            console.log(`[Cleanup] Killing ghost process with PID: ${pid}`);
            try {
                process.kill(pid, 'SIGKILL');
            } catch (e) {
                // On Windows, process.kill might fail for foreign processes
                if (process.platform === 'win32') {
                    execSync(`taskkill /F /PID ${pid}`);
                }
            }
        }
    });
    // Kill projects by path/name using powerful PowerShell
    if (process.platform === 'win32') {
        console.log(`[Cleanup] Aggressively killing all NeuroOS processes...`);
        const psCommand = `Get-Process | Where-Object { $_.Path -like "*NeuroOS*" -or $_.Path -like "*Neuro OS*" -or $_.Name -like "*Neuro OS*" -or $_.Name -like "*NeuroOS*" } | Stop-Process -Force -ErrorAction SilentlyContinue`;
        try {
            execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
        } catch (e) {
            console.log(`[Cleanup] PowerShell cleanup skipped or failed.`);
        }
    }
    console.log(`[Cleanup] Port ${port} and file locks should be free.`);
} catch (error) {
    // If netstat/lsof fails, it usually means no process is using the port
    console.log(`[Cleanup] Port ${port} is clear or no process was found.`);
}
