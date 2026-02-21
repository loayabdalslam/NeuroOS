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
    // Kill projects by name as well
    if (process.platform === 'win32') {
        const apps = ['"Neuro OS™"', '"Neuro OS"', '"electron"'];
        apps.forEach(app => {
            try {
                execSync(`taskkill /F /IM ${app}.exe /T /F`, { stdio: 'ignore' });
            } catch (e) { }
        });
    }
    console.log(`[Cleanup] Port ${port} is now free.`);
} catch (error) {
    // If netstat/lsof fails, it usually means no process is using the port
    console.log(`[Cleanup] Port ${port} is clear or no process was found.`);
}
