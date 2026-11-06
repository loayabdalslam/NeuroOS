const fs = require('fs');

let s = fs.readFileSync('src/renderer/src/onboarding/StoryIntro.tsx', 'utf8');
const oldQuote = s.match(/const QUOTE =\s*\n?\s*'[^']+';/);
if (oldQuote) {
  s = s.replace(
    oldQuote[0],
    `const QUOTE = [
  'هذا المشروع تم العمل عليه في الخامس من نوفمبر .. تذكر دائماً الخامس من نوفمبر، هذا اليوم الذي استيقظت فيه إلى العالم وقررت أن أنفّذ أكبر مشروع في عالم التكنولوجيا: نظام تشغيل Neuro OS.',
  'تذكّر اسمي جيداً، أنا لؤي عبد السلام .. يمكنك مناداتي ابن عبد السلام، ليرقد بسلام أينما كان، ليرى ابنه في أعالي النجوم.',
].join('\\n\\n');`,
  );
  fs.writeFileSync('src/renderer/src/onboarding/StoryIntro.tsx', s, 'utf8');
  console.log('quote split into paragraphs');
} else {
  console.log('quote not found');
}

let c = fs.readFileSync('src/renderer/src/styles/story.css', 'utf8');
if (!c.includes('white-space: pre-line')) {
  c += `\n.story__quote { white-space: pre-line; min-height: 208px; line-height: 1.85; }\n.story__name { margin-top: 6px; }\n`;
  fs.writeFileSync('src/renderer/src/styles/story.css', c, 'utf8');
}

let idx = fs.readFileSync('src/main/index.ts', 'utf8');
idx = idx.replace('await wait(11500);', 'await wait(13500);');
fs.writeFileSync('src/main/index.ts', idx, 'utf8');
console.log('story wait extended');
