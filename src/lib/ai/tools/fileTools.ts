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
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff'];
const BINARY_EXTENSIONS = ['exe', 'dll', 'so', 'bin', 'dat', 'zip', 'rar', '7z', 'tar', 'gz', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv'];

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function getFileSizeString(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
            const content: any = await ctx.readFile(filePath);
            
            const ext = args.filename.split('.').pop()?.toLowerCase() || '';
            const isArrayBuffer = content && typeof content === 'object' && 'byteLength' in content;
            const contentLength = isArrayBuffer ? (content as ArrayBuffer).byteLength : (content as string).length;
            
            if (IMAGE_EXTENSIONS.includes(ext)) {
                let base64: string;
                if (isArrayBuffer) {
                    base64 = arrayBufferToBase64(content as ArrayBuffer);
                } else {
                    // Properly encode UTF-8 string to base64
                    base64 = btoa(unescape(encodeURIComponent(content as string)));
                }
                const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                return {
                    success: true,
                    message: `🖼️ Image file: **${args.filename}** (${getFileSizeString(contentLength)})\n\nThis is an image file (${ext.toUpperCase()}). Use the Media Viewer to view it, or describe it using AI vision capabilities.`,
                    data: {
                        path: filePath,
                        filename: args.filename,
                        size: contentLength,
                        isImage: true,
                        mimeType,
                        dataUrl: `data:${mimeType};base64,${base64}`
                    }
                };
            }
            
            if (BINARY_EXTENSIONS.includes(ext)) {
                return {
                    success: true,
                    message: `📦 Binary file: **${args.filename}** (${getFileSizeString(contentLength)})\n\nThis is a binary file (${ext.toUpperCase()}) that cannot be displayed as text.`,
                    data: { path: filePath, filename: args.filename, size: contentLength, isBinary: true }
                };
            }
            
            let textContent: string;
            if (isArrayBuffer) {
                const decoder = new TextDecoder('utf-8', { fatal: false });
                textContent = decoder.decode(content as ArrayBuffer);
            } else {
                textContent = content as string;
            }
            
            return {
                success: true,
                message: `📄 Content of **${args.filename}** (${textContent.length} chars):\n\`\`\`\n${textContent.slice(0, 4000)}${textContent.length > 4000 ? '\n...(truncated)' : ''}\n\`\`\``,
                data: { content: textContent, path: filePath, filename: args.filename, size: textContent.length }
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

// ─── Copy File ───────────────────────────────────────────────────
registerTool({
    name: 'copy_file',
    description: 'Copies a file from source to destination path within or outside the workspace.',
    category: 'file',
    parameters: {
        source: { type: 'string', description: 'Source file path (relative to workspace or absolute)', required: true },
        destination: { type: 'string', description: 'Destination file path (relative to workspace or absolute)', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        const sourcePath = buildPath(ctx.workspacePath, args.source);
        const destPath = buildPath(ctx.workspacePath, args.destination);
        try {
            // Read source and write to destination
            const content = await ctx.readFile(sourcePath);
            await ctx.writeFile(destPath, content);
            return {
                success: true,
                message: `📋 Copied **${args.source}** to **${args.destination}**`,
                data: { source: sourcePath, destination: destPath }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to copy: ${e.message}` };
        }
    }
});

// ─── Move File (via rename) ──────────────────────────────────────
registerTool({
    name: 'move_file',
    description: 'Moves (renames) a file or folder from one location to another.',
    category: 'file',
    parameters: {
        source: { type: 'string', description: 'Current file path (relative to workspace or absolute)', required: true },
        destination: { type: 'string', description: 'New file path (relative to workspace or absolute)', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        const sourcePath = buildPath(ctx.workspacePath, args.source);
        const destPath = buildPath(ctx.workspacePath, args.destination);
        try {
            // Read source, write to destination, then delete source
            const content = await ctx.readFile(sourcePath);
            await ctx.writeFile(destPath, content);
            await ctx.deleteFile(sourcePath);
            return {
                success: true,
                message: `➡️ Moved **${args.source}** to **${args.destination}**`,
                data: { source: sourcePath, destination: destPath }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to move: ${e.message}` };
        }
    }
});

// ─── Search in Files ─────────────────────────────────────────────
registerTool({
    name: 'search_in_files',
    description: 'Searches for text patterns in files within the workspace. Returns matching files and line counts.',
    category: 'file',
    parameters: {
        pattern: { type: 'string', description: 'Text or regex pattern to search for', required: true },
        extension: { type: 'string', description: 'File extension to limit search (e.g., ".js", ".py", optional)', required: false }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }
        try {
            // List all files
            const entries = await ctx.listFiles(ctx.workspacePath);
            const pattern = new RegExp(args.pattern, 'gi');
            const results: any[] = [];

            for (const entry of entries) {
                if (entry.isDirectory) continue;
                if (args.extension && !entry.name.endsWith(args.extension)) continue;

                try {
                    const content = await ctx.readFile(`${ctx.workspacePath}/${entry.name}`);
                    const matches = content.match(pattern);
                    if (matches && matches.length > 0) {
                        results.push({
                            file: entry.name,
                            matches: matches.length,
                            preview: content.substring(0, 200)
                        });
                    }
                } catch {
                    // Skip files that can't be read
                }
            }

            if (results.length === 0) {
                return {
                    success: true,
                    message: `🔍 No matches found for pattern: \`${args.pattern}\``,
                    data: { matches: [] }
                };
            }

            const summary = results.map(r => `📄 **${r.file}** — ${r.matches} match${r.matches > 1 ? 'es' : ''}`).join('\n');
            return {
                success: true,
                message: `🔍 Found in **${results.length}** file(s):\n${summary}`,
                data: { results, count: results.length }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Search failed: ${e.message}` };
        }
    }
});
