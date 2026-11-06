const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
// 1) plain search HTML
const t0=Date.now();
const r=await fetch('https://www.youtube.com/results?search_query=local+llm+homelab&hl=en',{headers:{'user-agent':UA}});
const html=await r.text();
console.log('search html',r.status,html.length,'ms',Date.now()-t0);
const ids=[...new Set([...html.matchAll(/"browseId":"(UC[\w-]{20,24})"/g)].map(m=>m[1]))];
console.log('channelIds found:',ids.length, ids.slice(0,5));
const cont=html.match(/"continuationCommand":\{"token":"([^"]+)"/);
console.log('continuation token:',cont?cont[1].slice(0,30)+'...':'none');
// 2) DNS MX
const dns=await import('node:dns/promises');
try{const mx=await dns.resolveMx('gmail.com');console.log('MX ok:',mx.slice(0,2).map(x=>x.exchange));}catch(e){console.log('MX ERR',e.code||e.message)}
