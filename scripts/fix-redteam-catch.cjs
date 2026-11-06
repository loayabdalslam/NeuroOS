const fs = require('fs');
const p = 'src/main/redteam.ts';
let c = fs.readFileSync(p, 'utf8');

const catchBlock = `  } catch (error) {
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

  /* -------------------------------- CLEANUP ---------------------------- */`;

if (c.includes(catchBlock)) {
  c = c.replace(catchBlock, '  /* -------------------------------- CLEANUP ---------------------------- */');
}

c = c.replace(
  "  void installedId;\n\n  clearTimeout(watchdog);",
  `  void installedId;
  } catch (error) {
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

  clearTimeout(watchdog);`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('fixed catch placement', c.includes('void installedId;\n  } catch'));
