/**
 * Shell Execution Tools — run commands, get output
 */
import { registerTool, ToolResult } from '../toolEngine';

// ─── Run Shell Command ───────────────────────────────────────────
registerTool({
    name: 'run_shell',
    description: 'Executes a shell command on the system and returns stdout/stderr. Use for running scripts, installing packages, checking system status, etc.',
    category: 'shell',
    requiresConfirmation: true,
    parameters: {
        command: { type: 'string', description: 'The shell command to execute', required: true },
        cwd: { type: 'string', description: 'Working directory (optional, defaults to workspace)', required: false }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        try {
            const electron = (window as any).electron;
            if (!electron?.shell?.exec) {
                return { success: false, message: '❌ Shell execution is not available. Electron shell API not found.' };
            }
            const cwd = args.cwd || ctx.workspacePath || undefined;
            const result = await electron.shell.exec(args.command, cwd);

            const output = [];
            if (result.stdout) output.push(`**stdout:**\n\`\`\`\n${result.stdout.slice(0, 4000)}\n\`\`\``);
            if (result.stderr) output.push(`**stderr:**\n\`\`\`\n${result.stderr.slice(0, 2000)}\n\`\`\``);

            if (result.code !== 0) {
                return {
                    success: false,
                    message: `⚠️ Command exited with code ${result.code}\n${output.join('\n')}`,
                    data: result
                };
            }

            return {
                success: true,
                message: `✅ Command executed successfully\n${output.join('\n') || '(no output)'}`,
                data: result
            };
        } catch (e: any) {
            return { success: false, message: `❌ Shell error: ${e.message}` };
        }
    }
});
