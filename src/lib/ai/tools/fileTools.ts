/**
 * File System Tools — save, read, list, create, delete, append, update files
 * Every tool returns structured `data` for cross-tool chaining.
 */
import { registerTool, ToolResult } from '../toolEngine';

function getSep(p: string | null) {
    return p && p.includes('/') ? '/' : '\\';
}

function buildPath(workspace: string, filename: string): string {
    const sep = getSep(workspace);
    // If filename is already an absolute path, use it directly
    if (filename.match(/^[A-Za-z]:[\\/]/) || filename.startsWith('/')) {
        return filename;
    }
    return `${workspace}${sep}${filename}`;
}

// ─── Save File ───────────────────────────────────────────────────
registerTool({
    name: 'save_file',
    description: 'Saves/creates a file with the given filename and content to the workspace. Use proper file extensions. Returns the saved path and content for chaining.',
    category: 'file',
    parameters: {
        filename: { type: 'string', description: 'File name with extension (relative to workspace, or absolute path)', required: true },
        content: { type: 'string', description: 'Full file content to write', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set. Open File Explorer and select a workspace first.' };
        }
        const filePath = buildPath(ctx.workspacePath, args.filename);
        try {
            await ctx.writeFile(filePath, args.content);
            return {
                success: true,
                message: `✅ Saved **${args.filename}** to \`${filePath}\``,
                data: { path: filePath, filename: args.filename, content: args.content, size: args.content.length }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to save: ${e.message}` };
        }
    }
});

// ─── Read File ───────────────────────────────────────────────────
registerTool({
    name: 'read_file',
    description: 'Reads and returns the full content of a file. The content is available in the result data for use in subsequent tool calls.',
    category: 'file',
    parameters: {
        filename: { type: 'string', description: 'File name to read (relative to workspace, or absolute path)', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        const filePath = buildPath(ctx.workspacePath, args.filename);
        try {
            const content = await ctx.readFile(filePath);
            return {
                success: true,
                message: `📄 Content of **${args.filename}** (${content.length} chars):\n\`\`\`\n${content.slice(0, 4000)}${content.length > 4000 ? '\n...(truncated)' : ''}\n\`\`\``,
                data: { content, path: filePath, filename: args.filename, size: content.length }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to read "${args.filename}": ${e.message}` };
        }
    }
});

// ─── Append to File ──────────────────────────────────────────────
registerTool({
    name: 'append_file',
    description: 'Appends content to the end of an existing file. If the file does not exist, creates it. Use this to add sections, results, or summaries to an existing file.',
    category: 'file',
    parameters: {
        filename: { type: 'string', description: 'File name to append to (relative to workspace, or absolute path)', required: true },
        content: { type: 'string', description: 'Content to append at the end of the file', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        const filePath = buildPath(ctx.workspacePath, args.filename);
        try {
            let existing = '';
            try {
                existing = await ctx.readFile(filePath);
            } catch {
                // File doesn't exist yet — will create
            }
            const newContent = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + args.content;
            await ctx.writeFile(filePath, newContent);
            return {
                success: true,
                message: `✅ Appended to **${args.filename}** (now ${newContent.length} chars)`,
                data: { path: filePath, filename: args.filename, content: newContent, appendedContent: args.content, size: newContent.length }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to append: ${e.message}` };
        }
    }
});

// ─── Update File (Find & Replace) ────────────────────────────────
registerTool({
    name: 'update_file',
    description: 'Updates a file by finding a section and replacing it. Reads the file, replaces the first occurrence of `find` with `replace`, and saves. Use to modify specific parts of an existing file.',
    category: 'file',
    parameters: {
        filename: { type: 'string', description: 'File name to update (relative to workspace, or absolute path)', required: true },
        find: { type: 'string', description: 'Text to find in the file (exact match)', required: true },
        replace: { type: 'string', description: 'Text to replace it with', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        const filePath = buildPath(ctx.workspacePath, args.filename);
        try {
            const content = await ctx.readFile(filePath);
            if (!content.includes(args.find)) {
                return {
                    success: false,
                    message: `❌ Could not find the specified text in **${args.filename}**. The file has ${content.length} chars.`,
                    data: { content, path: filePath }
                };
            }
            const newContent = content.replace(args.find, args.replace);
            await ctx.writeFile(filePath, newContent);
            return {
                success: true,
                message: `✅ Updated **${args.filename}** — replaced section successfully (${newContent.length} chars)`,
                data: { path: filePath, filename: args.filename, content: newContent, size: newContent.length }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to update: ${e.message}` };
        }
    }
});

// ─── List Files ──────────────────────────────────────────────────
registerTool({
    name: 'list_files',
    description: 'Lists files and folders in the workspace (or a subfolder). Returns file names, types, and sizes for use in subsequent actions.',
    category: 'file',
    parameters: {
        path: { type: 'string', description: 'Subfolder path relative to workspace (optional, defaults to root)', required: false }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        const sep = getSep(ctx.workspacePath);
        const targetPath = args.path ? `${ctx.workspacePath}${sep}${args.path}` : ctx.workspacePath;
        try {
            const entries = await ctx.listFiles(targetPath);
            if (!entries.length) return { success: true, message: '📂 Directory is empty.', data: { entries: [], path: targetPath } };
            const list = entries.map((e: any) => `${e.isDirectory ? '📁' : '📄'} ${e.name}`).join('\n');
            return {
                success: true,
                message: `📂 **${args.path || 'Workspace'}** (${entries.length} items):\n${list}`,
                data: { entries, path: targetPath, count: entries.length }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to list: ${e.message}` };
        }
    }
});

// ─── Create Folder ───────────────────────────────────────────────
registerTool({
    name: 'create_folder',
    description: 'Creates a new folder in the workspace.',
    category: 'file',
    parameters: {
        name: { type: 'string', description: 'Folder name to create', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        const sep = getSep(ctx.workspacePath);
        const dirPath = `${ctx.workspacePath}${sep}${args.name}`;
        try {
            await ctx.createDir(dirPath);
            return { success: true, message: `📁 Created folder **${args.name}**`, data: { path: dirPath, name: args.name } };
        } catch (e: any) {
            return { success: false, message: `❌ Failed: ${e.message}` };
        }
    }
});

// ─── Delete File ─────────────────────────────────────────────────
registerTool({
    name: 'delete_file',
    description: 'Deletes a file or folder from the workspace. Use with caution.',
    category: 'file',
    requiresConfirmation: true,
    parameters: {
        filename: { type: 'string', description: 'File or folder name to delete', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        const filePath = buildPath(ctx.workspacePath, args.filename);
        try {
            await ctx.deleteFile(filePath);
            return { success: true, message: `🗑️ Deleted **${args.filename}**`, data: { path: filePath, filename: args.filename } };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to delete: ${e.message}` };
        }
    }
});
