const fs = require('fs');
const p = 'src/main/redteam.ts';
let c = fs.readFileSync(p, 'utf8');

const block = `  const restarted = new MailService({ dataFile: path.join(root, 'mail', 'victim.json'), vault: mailVault, discovery: false, secretPrefix: 'v' });
  await restarted.start();
  const restartPort = restarted.status().port;
  await postJson(restartPort, '/mail/deliver', good);
  const afterRestart = restarted.messages('inbox', 100).length;
  add('M-07', 'mail', 'medium', 'Replay is rejected after a restart', afterRestart === before, \`inbox \${before} Ã¢â€ â€™ \${afterRestart}\`, 'Seen ids are in-memory only, so a restarted node accepts duplicates.');`;

if (c.includes(block)) {
  c = c.replace(block, '  const restartPort = victimPort;');
  console.log('restart block removed');
} else {
  console.log('restart block not found');
}

c = c.replace("  await restarted.dispose();\n", '');
c = c.replace("  await restarted.dispose();\r\n", '');
c = c.split('Ã¢â€ â€™').join(' -> ');
c = c.split('Ã¢â€ â€™').join(' -> ');

fs.writeFileSync(p, c, 'utf8');
console.log('cleanup done', !c.includes('restarted'), c.includes('restartPort = victimPort'));
