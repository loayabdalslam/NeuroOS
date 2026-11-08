const fs = require('fs');
const p = 'src/renderer/src/surfaces/ComposioPanel.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace("  const [query, setQuery] = useState('');", "  const [query, setQuery] = useState('');\n  const [remoteBusy, setRemoteBusy] = useState(false);");

const effect = `  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || filteredTools.length) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setRemoteBusy(true);
      void invoke('composio.search', { query: q, limit: 40 })
        .then((found) => {
          if (cancelled || !found.length) return;
          setTools((current) => [...current, ...found.filter((item) => !current.some((tool) => tool.slug === item.slug))]);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setRemoteBusy(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, filteredTools.length]);
`;
c = c.replace("  if (!status) return <div className=\"composio\">", effect + "\n  if (!status) return <div className=\"composio\">");

const input = c.indexOf('<input value={query}');
if (input >= 0) {
  const close = c.indexOf('/>', input);
  if (close >= 0) {
    c = c.slice(0, close + 2) + "\n              {remoteBusy ? <Spinner size={11} /> : null}" + c.slice(close + 2);
  }
}
fs.writeFileSync(p, c, 'utf8');
console.log('composio ui patched', c.includes('remoteBusy'), c.includes('composio.search'));
