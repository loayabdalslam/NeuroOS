const fs = require('fs');
const p = 'src/shared/i18n.ts';
let c = fs.readFileSync(p, 'utf8');
const map = {
  'Tools & permissions': 'Integrations',
  'الأدوات والصلاحيات': 'التكاملات',
  'Outils et permissions': 'Intégrations',
  'Herramientas y permisos': 'Integraciones',
  'Werkzeuge & Rechte': 'Integrationen',
  '工具与权限': '集成',
  'ツールと権限': '連携',
  'Инструменты и права': 'Интеграции',
};
let added = 0;
for (const [label, value] of Object.entries(map)) {
  const needle = `'settings.tools': '${label}',`;
  if (c.includes(needle) && !c.includes(`'settings.integrations': '${value}'`)) {
    c = c.replace(needle, `${needle}\n  'settings.integrations': '${value}',`);
    added += 1;
  }
}
fs.writeFileSync(p, c, 'utf8');
console.log('integrations labels added:', added);
