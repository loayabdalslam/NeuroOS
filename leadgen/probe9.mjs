const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const id='UC9x0AN7BWHpCDHSm9NiJFJQ';
async function size(url,ua){const t=Date.now();const r=await fetch(url,{headers:{'user-agent':ua||UA}});const txt=await r.text();return {url:url.slice(0,70),status:r.status,len:txt.length,ms:Date.now()-t,txt};}
const a=await size(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,'curl/8');
console.log('RSS',a.status,'len',a.len,'ms',a.ms,'hasEmail',/[\w.]+@[\w.]+\.\w+/.test(a.txt));
const b=await size(`https://www.youtube.com/@NetworkChuck/about`);
console.log('mobile about',b.status,'len',b.len,'ms',b.ms,'links',(b.txt.match(/channelExternalLinkViewModel/g)||[]).length,'email',/chuck@/.test(b.txt));
// throughput test with MWEB browse
const KEY='AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const ctx={client:{clientName:'MWEB',clientVersion:'2.20240726.01.00',hl:'en',gl:'US'}};
const ids=['UCsBjURrPoezykLs9EqgamOA','UCSHZKyawb77ixDdsGog4iWA','UC6YL31AicZzw1-gap7zBm9A','UCiaQzXI5528Il6r2NNkrkJA','UCz21u_dPpYlJ-XyLcyxutow','UC9HwoV7VQpDRDXOzviV2DIQ','UCX6OQ3DkcsbYNE6H8uQQuVA','UC9x0AN7BWHpCDHSm9NiJFJQ'];
let total=0; const t0=Date.now();
await Promise.all(Array.from({length:8},async(_,k)=>{for(let i=0;i<3;i++){const r=await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${KEY}&prettyPrint=false`,{method:'POST',headers:{'content-type':'application/json','user-agent':UA},body:JSON.stringify({context:ctx,browseId:ids[(k+i)%ids.length]})});total+=(await r.text()).length;}}));
const el=Date.now()-t0;
console.log(`24 requests in ${el}ms -> ${(el/24).toFixed(0)}ms/req, ${(total/1024/1024).toFixed(1)}MB, ~${(1000/(el/24)).toFixed(1)} req/s`);
