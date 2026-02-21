const { execSync } = require('child_process');

const port = process.argv[2] || 5173;
console.log(`[Cleanup] Checking port ${port} and NeuroOS processes...`);

try {
    // 1. Kill by port
    try {
        let cmd = '';
        if (process.platform === 'win32') {
            cmd = `netstat -ano | findstr :${port}`;
            const output = execSync(cmd).toString();
            const lines = output.trim().split('\n');
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && !isNaN(pid) && pid !== '0') {
                    console.log(`[Cleanup] Killing process on port ${port} (PID: ${pid})`);
                    execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
                }
            });
        }
    } catch (e) { }

    // 2. Aggressively kill by name and path (PowerShell)
    if (process.platform === 'win32') {
        console.log(`[Cleanup] Searching for all NeuroOS/Electron windows and processes...`);
        const psCommand = `Get-Process | Where-Object { $_.Path -like "*NeuroOS*" -or $_.Path -like "*Neuro OS*" -or $_.Name -like "*Neuro OS*" -or $_.Name -like "*NeuroOS*" -or $_.Name -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue`;
        try {
            execSync(`powershell -Command "${psCommand}"`, { stdio: 'ignore' });
        } catch (e) { }
    }

    // 3. CRITICAL: Wait for Windows to release file handles
    console.log(`[Cleanup] Waiting 1.5s for OS to release file locks...`);
    const start = Date.now();
    while (Date.now() - start < 1500) {
        // Synchronous busy-wait to ensure it blocks the next step
    }

    console.log(`[Cleanup] Done. Project is now fresh.`);
} catch (error) {
    console.log(`[Cleanup] Finished with minor notes or no processes found.`);
}
