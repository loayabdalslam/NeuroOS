const fs = require('fs');

let p = 'src/main/services/web.service.ts';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('resolvedSites()')) {
  c = c.replace(
    '  async unpublish(domain: string): Promise<SiteManifest[]> {',
    `  resolvedSites(): SiteManifest[] {
    return [...this.remoteCache.values()].map((entry) => entry.manifest);
  }

  async unpublish(domain: string): Promise<SiteManifest[]> {`,
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('web.resolvedSites added');
}

p = 'src/shared/ipc.ts';
c = fs.readFileSync(p, 'utf8');
if (!c.includes("'web.resolved'")) {
  c = c.replace(
    "  'web.list': { params: void; result: SiteManifest[] };",
    "  'web.list': { params: void; result: SiteManifest[] };\n  'web.resolved': { params: void; result: SiteManifest[] };",
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('ipc type added');
}

p = 'src/main/ipcHandlers.ts';
c = fs.readFileSync(p, 'utf8');
if (!c.includes("'web.resolved'")) {
  c = c.replace(
    "    'web.list': () => kernel.web.list(),",
    "    'web.list': () => kernel.web.list(),\n    'web.resolved': () => kernel.web.resolvedSites(),",
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('ipc handler added');
}

p = 'src/renderer/src/surfaces/Sites.tsx';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('meshSites')) {
  c = c.replace(
    '  const [siteList, statsNow, peerList] = await Promise.all([invoke(\'web.list\', undefined), invoke(\'web.status\', undefined), invoke(\'web.peers\', undefined)]);\n    setSites(siteList);\n    setStats(statsNow);\n    setPeers(peerList);',
    '  const [siteList, statsNow, peerList, meshNow] = await Promise.all([invoke(\'web.list\', undefined), invoke(\'web.status\', undefined), invoke(\'web.peers\', undefined), invoke(\'web.resolved\', undefined)]);\n    setSites(siteList);\n    setStats(statsNow);\n    setPeers(peerList);\n    setMeshSites(meshNow);',
  );
  c = c.replace(
    '  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);',
    "  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);\n  const [meshSites, setMeshSites] = useState<SiteManifest[]>([]);",
  );
  c = c.replace(
    '            <span className="tiny faint">{sites.length}</span>\n          </div>',
    `            <span className="tiny faint">{sites.length}</span>
          </div>`,
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('sites state patched');
}
