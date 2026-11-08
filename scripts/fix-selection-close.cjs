const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  '                  void chooseModel(model, item.id).then(() => setProviderModal(false));',
  `                  setProviderModal(false);
                  void chooseModel(model, item.id).catch((error) =>
                    pushToast({ title: 'Could not switch provider', message: (error as Error).message, kind: 'error' }),
                  );`,
);
c = c.replace(
  '                  void chooseModel(model.id, provider?.id).then(() => setModelModal(false));',
  `                  setModelModal(false);
                  void chooseModel(model.id, provider?.id).catch((error) =>
                    pushToast({ title: 'Could not switch model', message: (error as Error).message, kind: 'error' }),
                  );`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('selection closes immediately', c.includes('Could not switch model'));
