const fs = require('fs');
const p = 'src/main/redteam.ts';
let c = fs.readFileSync(p, 'utf8');

// finer logging around the web attack surface
c = c.replace(
  "  const attackerHello = (await getJson(attackerWeb.stats().port, '/web/hello')).body;",
  "  log.info('redteam', 'W-04 step: attacker hello');\n  const attackerHello = (await getJson(attackerWeb.stats().port, '/web/hello')).body;\n  log.info('redteam', 'W-04 step: sign spoofed manifest');",
);
c = c.replace(
  "  const spoofAnnounce = await postJson(webPort, '/web/announce', { manifest: spoofManifest, blobs: [] });",
  "  log.info('redteam', 'W-04 step: announce spoofed manifest');\n  const spoofAnnounce = await postJson(webPort, '/web/announce', { manifest: spoofManifest, blobs: [] });\n  log.info('redteam', 'W-04 step: announce returned');",
);

// global try/catch so a rejected promise still produces a partial report
c = c.replace(
  "  watchdog.unref();",
  "  watchdog.unref();\n  try {",
);
c = c.replace(
  "  /* -------------------------------- CLEANUP ---------------------------- */",
  `  } catch (error) {
    checks.push({
      id: 'RT-CRASH',
      area: 'system',
      severity: 'critical',
      title: 'Red-team harness crashed before completing',
      pass: false,
      evidence: String((error as Error)?.stack ?? error),
      risk: 'The harness stopped early; remaining checks were not executed.',
    });
  }

  /* -------------------------------- CLEANUP ---------------------------- */`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('patched', c.includes('W-04 step'), c.includes('RT-CRASH'));
