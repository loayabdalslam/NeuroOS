const fs = require('fs');
let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## ACP authentication')) {
  b += [
    '',
    '## ACP authentication',
    '',
    '| Issue | Fix |',
    '| --- | --- |',
    '| ACP prompt timed out with “The agent did not finish in time and advertises authentication: Login with opencode”. `opencode auth list` shows 0 credentials, so the agent blocks until the prompt timeout. | The inline ACP error now includes **Open login terminal**, which navigates to Terminal and types the right command (`opencode auth login`, `codex login`, or `claude login`) into an interactive shell. The user completes the login there and retries the turn. D-38 verifies the command is typed into a live PTY. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
let d = fs.readFileSync('docs/DEEP-QA.md', 'utf8');
d = d.replace('| Checks | **36** |', '| Checks | **37** |').replace('| Pass | **34** |', '| Pass | **35** |');
fs.writeFileSync('docs/DEEP-QA.md', d, 'utf8');
console.log('acp docs updated');
