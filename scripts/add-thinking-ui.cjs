const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');

// Custom model input at the top of the model dialog
const modelTitle = c.indexOf("title={toolModels.length");
const chooser = c.indexOf('<div className="providerChooser">', modelTitle);
if (modelTitle > 0 && chooser > 0 && !c.slice(modelTitle, chooser).includes('customModel')) {
  const block = `        <div className="customModel">
          <input
            className="n-input"
            value={customModel}
            onChange={(event) => setCustomModel(event.target.value)}
            placeholder="Or type a model id (ACP model, tag, deployment…)"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && customModel.trim()) {
                setModelModal(false);
                void chooseModel(customModel.trim(), provider?.id).catch((error) =>
                  pushToast({ title: 'Could not use model', message: (error as Error).message, kind: 'error' }),
                );
              }
            }}
          />
          <Button
            variant="soft"
            size="sm"
            icon="check"
            disabled={!customModel.trim()}
            onClick={() => {
              setModelModal(false);
              void chooseModel(customModel.trim(), provider?.id).catch((error) =>
                pushToast({ title: 'Could not use model', message: (error as Error).message, kind: 'error' }),
              );
            }}
          >
            Use
          </Button>
        </div>
`;
  c = c.slice(0, chooser) + block + c.slice(chooser);
}

// Thinking dialog after the model dialog
if (!c.includes('title="Thinking level"')) {
  const close = c.indexOf('</Modal>', modelTitle);
  if (close > 0) {
    const thinkingModal = `
      <Modal
        open={thinkingModal}
        onClose={() => setThinkingModal(false)}
        title="Thinking level"
        description="How much reasoning the model may spend before answering. Auto lets the provider decide; Off disables reasoning where supported."
        width={480}
      >
        <div className="providerChooser">
          {[
            { id: 'auto', label: 'Auto', hint: 'Provider default (recommended)' },
            { id: 'off', label: 'Off', hint: 'Disable reasoning tokens where the provider allows it' },
            { id: 'low', label: 'Low', hint: 'Fast, light reasoning' },
            { id: 'medium', label: 'Medium', hint: 'Balanced reasoning budget' },
            { id: 'high', label: 'High', hint: 'Deeper reasoning, slower and more tokens' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className="providerChoice"
              data-active={thinking === option.id}
              onClick={() => void chooseThinking(option.id as 'auto' | 'off' | 'low' | 'medium' | 'high')}
            >
              <Icon name="brain" size={15} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="small strong">{option.label}</span>
                <span className="tiny faint" style={{ display: 'block' }}>{option.hint}</span>
              </span>
              {thinking === option.id ? <Icon name="check" size={13} /> : null}
            </button>
          ))}
        </div>
      </Modal>
`;
    c = c.slice(0, close + '</Modal>'.length) + thinkingModal + c.slice(close + '</Modal>'.length);
  }
}

fs.writeFileSync(p, c, 'utf8');
console.log('thinking dialog + custom model added', c.includes('title="Thinking level"'), c.includes('customModel'));
