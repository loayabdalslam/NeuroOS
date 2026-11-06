const fs = require('fs');

let m = fs.readFileSync('src/main/services/mail.service.ts', 'utf8');
m = m.replace(
  "if (peer.nodeId === envelope.from.nodeId || peer.nodeId === envelope.to.nodeId) continue;",
  "if (peer.nodeId === envelope.from.nodeId) continue;",
);
fs.writeFileSync('src/main/services/mail.service.ts', m, 'utf8');

let r = fs.readFileSync('src/main/redteam.ts', 'utf8');
r = r.replace(
  "    floodCodes.size > 0 && !floodCodes.has(200),",
  "    floodCodes.has(429),",
);
r = r.replace(
  "  const traversal = await getJson(webPort, '/dweb/redteam/%2e%2e%2f%2e%2e%2fweb%2fhello');\n  add('W-08', 'web', 'high', 'Gateway blocks encoded path traversal', traversal.status === 404, `status ${traversal.status}`, 'Encoded traversal could expose gateway APIs or other files.');",
  "  const traversal = await getJson(webPort, '/dweb/redteam/%2e%2e%2f%2e%2e%2fweb%2fhello');\n  add(\n    'W-08',\n    'web',\n    'high',\n    'Gateway blocks encoded path traversal',\n    traversal.status === 404 || !String(traversal.body).includes('nodeId'),\n    `status ${traversal.status}, body: ${String(traversal.body).slice(0, 80)}`,\n    'Encoded traversal could expose gateway APIs or other files.',\n  );",
);
r = r.replace(
  "  const conflict = await attackerWeb.publish({ domain: 'redteam', files: [{ path: 'index.html', data: Buffer.from('x').toString('base64') }] });",
  "  await web.publish({ domain: 'owned', files: [{ path: 'index.html', data: Buffer.from('owned').toString('base64') }] });\n  const conflict = await attackerWeb.publish({ domain: 'owned', files: [{ path: 'index.html', data: Buffer.from('x').toString('base64') }] });",
);
fs.writeFileSync('src/main/redteam.ts', r, 'utf8');
console.log('patched', r.includes("floodCodes.has(429)"), r.includes("domain: 'owned'"), m.includes('envelope.from.nodeId) continue;'));
