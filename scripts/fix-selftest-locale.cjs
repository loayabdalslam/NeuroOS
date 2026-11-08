const fs = require('fs');
const p = 'src/main/index.ts';
let c = fs.readFileSync(p, 'utf8');

const start = c.indexOf('      const pickLanguage = async (label: string): Promise<string> =>');
const endMarker = ".catch((error) => String(error));";
const end = c.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('pickLanguage block not found');

const replacement = `      const pickLanguage = async (label: string): Promise<string> => {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const result = await win.webContents
            .executeJavaScript(
              \`(() => { const card = [...document.querySelectorAll('.langcard')].find((element) => element.textContent?.includes(\${JSON.stringify(label)})); if (!card) return 'missing'; card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return 'clicked'; })()\`,
            )
            .catch((error) => String(error));
          if (result !== 'missing') return result;
          await wait(250);
        }
        return 'missing';
      };`;

c = c.slice(0, start) + replacement + c.slice(end + endMarker.length);

c = c.replace(
  /const pickedArabic = await pickLanguage\('[^']*'\);/,
  "const pickedArabic = await pickLanguage('\\u0627\\u0644\\u0639\\u0631\\u0628\\u064a\\u0629');",
);

fs.writeFileSync(p, c, 'utf8');
console.log('pickLanguage patched', c.includes('attempt < 12'), c.includes('u0627'));
