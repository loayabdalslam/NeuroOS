const fs = require('fs');

// 1) Types: attachments can carry image data; LlmMessage can carry images
let p = 'src/shared/types.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `  mime?: string;
  size?: number;
}`,
  `  mime?: string;
  size?: number;
  /** data: URL for image attachments (vision models). */
  dataUrl?: string;
}`,
);
fs.writeFileSync(p, c, 'utf8');

p = 'src/main/services/providers/adapters.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;`,
  `export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: { mime: string; dataUrl: string }[];`,
);
// OpenAI-compatible: user content becomes a multimodal array when images exist
c = c.replace(
  `      } else {
        messages.push({ role: m.role, content: m.content });
      }`,
  `      } else if (m.role === 'user' && m.images?.length) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            ...m.images.map((image) => ({ type: 'image_url', image_url: { url: image.dataUrl } })),
          ],
        });
      } else {
        messages.push({ role: m.role, content: m.content });
      }`,
);
fs.writeFileSync(p, c, 'utf8');

// 2) Agent: forward attachment images into LlmMessage
p = 'src/main/services/agent.service.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `    if (message.role === 'user') {
      out.push({ role: 'user', content: message.content });`,
  `    if (message.role === 'user') {
      const images = (message.attachments ?? [])
        .filter((attachment) => attachment.kind === 'image' && attachment.dataUrl)
        .map((attachment) => ({ mime: attachment.mime ?? 'image/png', dataUrl: attachment.dataUrl! }));
      out.push({ role: 'user', content: message.content, ...(images.length ? { images } : {}) });`,
);
fs.writeFileSync(p, c, 'utf8');

// 3) IPC: read an image file as a data URL
p = 'src/shared/ipc.ts';
c = fs.readFileSync(p, 'utf8');
if (!c.includes("'system.readDataUrl'")) {
  c = c.replace(
    "  'system.pickFiles': { params: { multiple?: boolean }; result: { paths: string[] } };",
    "  'system.pickFiles': { params: { multiple?: boolean }; result: { paths: string[] } };\n  'system.readDataUrl': {\n    params: { path: string };\n    result: { dataUrl: string; mime: string; name: string; size: number };\n  };",
  );
  fs.writeFileSync(p, c, 'utf8');
}

p = 'src/main/ipcHandlers.ts';
c = fs.readFileSync(p, 'utf8');
if (!c.includes("'system.readDataUrl'")) {
  c = c.replace(
    "    'system.pickFiles': async (params) => {",
    `    'system.readDataUrl': async ({ path: file }) => {
      const ext = path.extname(file).toLowerCase();
      const types: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      };
      const mime = types[ext];
      if (!mime) throw new Error('Only PNG, JPEG, WebP or GIF images can be attached.');
      const stat = await fs.stat(file);
      if (stat.size > 8 * 1024 * 1024) throw new Error('Images are limited to 8 MB.');
      const data = await fs.readFile(file);
      return { dataUrl: \`data:\${mime};base64,\${data.toString('base64')}\`, mime, name: path.basename(file), size: stat.size };
    },
    'system.pickFiles': async (params) => {`,
  );
  fs.writeFileSync(p, c, 'utf8');
}

// 4) Chat store: attachment setter
p = 'src/renderer/src/state/chat.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace('  attachments: ChatMessage[\'attachments\'];', '  attachments: ChatMessage[\'attachments\'];\n  setAttachments: (attachments: ChatMessage[\'attachments\']) => void;');
c = c.replace('  setDraft: (draft) => set({ draft }),', '  setDraft: (draft) => set({ draft }),\n\n  setAttachments: (attachments) => set({ attachments }),');
fs.writeFileSync(p, c, 'utf8');
console.log('attachment plumbing added');
