/**
 * Report Generation Tools — create markdown/HTML reports and save them
 */
import { registerTool, ToolResult } from '../toolEngine';

// ─── Generate Report ─────────────────────────────────────────────
registerTool({
    name: 'generate_report',
    description: 'Generates a structured report and saves it as a markdown file to the workspace. Use for summaries, analysis documents, meeting notes, etc.',
    category: 'generate',
    parameters: {
        title: { type: 'string', description: 'Report title', required: true },
        content: { type: 'string', description: 'Full markdown content of the report', required: true },
        filename: { type: 'string', description: 'Output filename (default: report-{timestamp}.md)', required: false }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = args.filename || `report-${timestamp}.md`;
        const sep = ctx.workspacePath.includes('/') ? '/' : '\\';
        const filePath = `${ctx.workspacePath}${sep}${filename}`;

        const fullContent = `# ${args.title}\n\n*Generated: ${new Date().toLocaleString()}*\n\n---\n\n${args.content}`;

        try {
            await ctx.writeFile(filePath, fullContent);
            return {
                success: true,
                message: `📊 Report **"${args.title}"** saved as \`${filename}\`\n\nPreview:\n${fullContent.slice(0, 1000)}${fullContent.length > 1000 ? '\n...' : ''}`
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to save report: ${e.message}` };
        }
    }
});

// ─── Generate Image (via AI API) ─────────────────────────────────
registerTool({
    name: 'generate_image',
    description: 'Generates an image from a text description and saves it to the workspace. Requires a Gemini API key configured.',
    category: 'generate',
    parameters: {
        prompt: { type: 'string', description: 'Detailed description of the image to generate', required: true },
        filename: { type: 'string', description: 'Output filename (default: generated-image.png)', required: false }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) {
            return { success: false, message: '❌ No workspace set.' };
        }

        try {
            // Use Gemini's image generation API
            const electron = (window as any).electron;
            if (electron?.ai?.generateImage) {
                const result = await electron.ai.generateImage(args.prompt);
                const filename = args.filename || 'generated-image.png';
                const sep = ctx.workspacePath.includes('/') ? '/' : '\\';
                const filePath = `${ctx.workspacePath}${sep}${filename}`;

                // Save the base64 image
                await ctx.writeFile(filePath, result.base64);
                return {
                    success: true,
                    message: `🎨 Image generated and saved as **${filename}**!\n\nPrompt: "${args.prompt}"`
                };
            }

            // Fallback: Create an SVG placeholder
            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" rx="16"/>
  <text x="256" y="240" text-anchor="middle" fill="white" font-size="20" font-family="Arial">🎨 AI Generated Image</text>
  <text x="256" y="280" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="14" font-family="Arial">${args.prompt.slice(0, 60)}</text>
</svg>`;

            const filename = args.filename || 'generated-image.svg';
            const sep = ctx.workspacePath.includes('/') ? '/' : '\\';
            const filePath = `${ctx.workspacePath}${sep}${filename}`;
            await ctx.writeFile(filePath, svgContent);

            return {
                success: true,
                message: `🎨 Image placeholder saved as **${filename}**\n\n> Note: Full image generation requires Gemini Vision API. SVG placeholder was created with your prompt.`
            };
        } catch (e: any) {
            return { success: false, message: `❌ Image generation failed: ${e.message}` };
        }
    }
});
