const fs = require('fs');

let p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('msg__attachments')) {
  c = c.replace(
    '        <div className="msg__meta">',
    `        {message.attachments?.some((attachment) => attachment.dataUrl) ? (
          <div className="msg__attachments">
            {message.attachments
              .filter((attachment) => attachment.dataUrl)
              .map((attachment) => (
                <img key={attachment.id} src={attachment.dataUrl} alt={attachment.label} />
              ))}
          </div>
        ) : null}
        <div className="msg__meta">`,
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('message thumbnails added');
}

p = 'src/renderer/src/styles/chat.css';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('.msg__attachments')) {
  c += `\n.msg__attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }\n.msg__attachments img { width: 96px; height: 96px; object-fit: cover; border-radius: 10px; border: 1px solid var(--n-line); }\n`;
  fs.writeFileSync(p, c, 'utf8');
}

let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Composer pickers & images')) {
  b += [
    '',
    '## Composer pickers & images',
    '',
    '| Feature | Behaviour |',
    '| --- | --- |',
    '| Provider pill | Opens a Providers dialog listing every provider (kind, model count, enabled state) with a Manage providers action. |',
    '| Model pill | Opens “Models with tool calling”: only models whose supportsTools is not false; shows context window and vision badges. |',
    '| Image upload | Paperclip reads PNG/JPEG/WebP/GIF up to 8 MB, shows thumbnails/chips (max 4), sends them as multimodal content to OpenAI-compatible providers, and renders them in the user message. |',
    '| Backend | New system.readDataUrl IPC returns a data URL; LlmMessage carries images; adapters with vision support receive image_url blocks. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
console.log('docs updated');
