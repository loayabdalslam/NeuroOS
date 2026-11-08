const fs = require('fs');

let p = 'src/main/qa.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace("      const hits = kernel.composio.tools({ query: 'gmail' }).length;", "      const hits = (await kernel.composio.searchRemote('gmail', 20)).length;");
c = c.replace(
  "      const github = kernel.composio.tools({ toolkit: 'github' }).find((tool) => /GET_THE_AUTHENTICATED_USER/i.test(tool.slug));",
  "      const github = (await kernel.composio.searchRemote('github', 60)).find((tool) => /GET_THE_AUTHENTICATED_USER/i.test(tool.slug));",
);
fs.writeFileSync(p, c, 'utf8');
console.log('qa updated', c.includes('searchRemote'));

p = 'src/main/deepqa.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  "return { evidence: `${finished.steps?.length ?? 0} steps, ${finished.durationMs ?? \"?\"}ms, output ${String(finished.steps?.[0]?.output ?? '').slice(0, 60)}` };",
  "const transform = (finished.steps ?? []).find((step: any) => step.name === 'Set value') ?? finished.steps?.[1];\n    return { evidence: `${finished.steps?.length ?? 0} steps, output ${String(transform?.output ?? '').slice(0, 60)}` };",
);
fs.writeFileSync(p, c, 'utf8');
console.log('deep updated', c.includes('Set value'));
