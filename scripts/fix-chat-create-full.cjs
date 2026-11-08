const fs = require('fs');
const p = 'src/renderer/src/state/chat.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  `  create: async (params) => {
    const session = await invoke('chat.create', params ?? {});
    set({ sessions: [session, ...get().sessions], activeId: session.id, active: session, draft: '' });
  },`,
  `  create: async (params) => {
    const created = await invoke('chat.create', params ?? {});
    let active: any = { ...created, messages: [] };
    try {
      active = await invoke('chat.session', { id: created.id });
    } catch {
      // keep the empty-message fallback so sending still works
    }
    set({ sessions: [created, ...get().sessions], activeId: active.id, active, draft: '' });
  },`,
);

c = c.replace(
  '    const { active, draft, activeId } = get();\n    if (!draft.trim() || !active || !activeId) return;',
  '    const { active, draft, activeId } = get();\n    if (!draft.trim() || !active || !activeId) return;\n    const messages = active.messages ?? [];',
);
c = c.replace(
  '      active: { ...active, messages: [...active.messages, userMessage, assistantMessage] },',
  '      active: { ...active, messages: [...messages, userMessage, assistantMessage] },',
);
c = c.replaceAll('updateMessage(active.messages,', 'updateMessage(active.messages ?? [],');
c = c.replace("?? active.messages[active.messages.length - 1]?.id ?? ''", "?? (active.messages ?? [])[(active.messages ?? []).length - 1]?.id ?? ''");

fs.writeFileSync(p, c, 'utf8');

const q = 'src/renderer/src/surfaces/Chat.tsx';
let s = fs.readFileSync(q, 'utf8');
s = s.replace(') : !active || active.messages.length === 0 ? (', ') : !active || (active.messages ?? []).length === 0 ? (');
s = s.replace('{active.messages\n', '{(active.messages ?? [])\n');
fs.writeFileSync(q, s, 'utf8');
console.log('session creation now loads full messages', c.includes('chat.session'), s.includes('(active.messages ?? [])'));
