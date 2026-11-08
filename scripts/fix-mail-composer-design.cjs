const fs = require('fs');

// Mail setup must not inherit the 3-column mail grid
let p = 'src/renderer/src/styles/os.css';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `.mail--setup {
  display: grid;
  place-items: center;
}`,
  `.mail--setup {
  display: grid;
  grid-template-columns: 1fr;
  place-items: center;
  overflow: auto;
  padding: 24px;
}`,
);
fs.writeFileSync(p, c, 'utf8');
console.log('mail setup grid fixed');

// Chat: remove the noisy chip row and rebuild the composer footer
p = 'src/renderer/src/surfaces/Chat.tsx';
c = fs.readFileSync(p, 'utf8');
const topStart = c.indexOf('            <div className="composer__top">');
const topEnd = c.indexOf('            <textarea', topStart);
if (topStart > -1 && topEnd > -1) {
  c = c.slice(0, topStart) + c.slice(topEnd);
  console.log('composer top removed');
}
c = c.replace(
  `              <span className="composer__agent">
                <span className="composer__agentDot" />
                {agent?.name ?? 'Neuro'}
                <span className="faint tiny">Â· {agent?.temperature ?? 0.3}</span>
              </span>
              <span className="grow" />
              {streaming ? (
                <Button variant="danger" size="sm" icon="square" onClick={() => void cancel()}>
                  {t('common.stop')}
                </Button>
              ) : (
                <Button variant="primary" size="sm" icon="arrow-up" onClick={() => void send()} disabled={!draft.trim() || !active}>
                  {t('common.send')}
                </Button>
              )}`,
  `              <span className="grow" />
              {streaming ? (
                <button type="button" className="composer__send composer__send--stop" onClick={() => void cancel()} aria-label={t('common.stop')}>
                  <Icon name="square" size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  className="composer__send"
                  onClick={() => void send()}
                  disabled={!draft.trim() || !active}
                  aria-label={t('common.send')}
                >
                  <Icon name="arrow-up" size={16} />
                </button>
              )}`,
);
fs.writeFileSync(p, c, 'utf8');
console.log('composer footer simplified', c.includes('composer__send'));

// ChatGPT-like composer styling
p = 'src/renderer/src/styles/chat.css';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('.composer__send {')) {
  c += `\n.composer { max-width: 820px; border-radius: 20px; padding: 12px 14px 10px; box-shadow: 0 10px 34px rgba(15, 18, 26, 0.06); }\n.composer__input { padding: 4px 4px 2px; font-size: 14px; line-height: 1.65; }\n.composer__bottom { gap: 6px; padding-top: 8px; }\n.composer__selectors { min-width: 0; }\n.composer__select { height: 26px; max-width: 190px; }\n.composer__select .truncate { max-width: 140px; }\n.composer__send { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; border: 0; background: var(--n-accent); color: #fff; flex: none; transition: opacity var(--n-speed) var(--n-ease), transform var(--n-speed) var(--n-ease); }\n.composer__send:hover:not(:disabled) { transform: scale(1.04); }\n.composer__send:disabled { opacity: 0.35; cursor: default; }\n.composer__send--stop { background: var(--n-danger, #ef4444); }\n.chat__composerWrap { padding-bottom: 10px; }\n`;
  fs.writeFileSync(p, c, 'utf8');
  console.log('composer css added');
}
