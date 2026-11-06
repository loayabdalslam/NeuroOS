const ctx={client:{clientName:'MWEB',clientVersion:'2.20240726.01.00',hl:'en',gl:'US'}};
const KEY='AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
async function browse(browseId,params){
  const r=await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${KEY}&prettyPrint=false`,{method:'POST',headers:{'content-type':'application/json','user-agent':UA},body:JSON.stringify({context:ctx,browseId,...(params?{params}:{})})});
  return {status:r.status,text:await r.text()};
}
for(const p of ['EgVhYm91dA%3D%3D','EgVhYm91dPIGBAoCEgA%3D']){
  const {status,text}=await browse('UC9x0AN7BWHpCDHSm9NiJFJQ',p);
  console.log('about params',p,'status',status,'len',text.length,'hasAboutModel',text.includes('aboutChannelViewModel'));
  const subs=text.match(/"subscriberCountText":\{[^}]{0,300}/);
  console.log('  subs:',subs?subs[0].slice(0,220):'none');
  const cnt=text.match(/"videoCountText":\{[^}]{0,300}/);
  console.log('  videos:',cnt?cnt[0].slice(0,220):'none');
  const joined=text.match(/[Jj]oined[^"]{0,40}/); console.log('  joined:',joined?joined[0]:'none');
  const viewc=text.match(/"viewCountText":\{[^}]{0,200}/); console.log('  totalviews:',viewc?viewc[0].slice(0,160):'none');
}
const home=await browse('UC9x0AN7BWHpCDHSm9NiJFJQ');
console.log('\nHOME publishedTimeText count:',(home.text.match(/publishedTimeText/g)||[]).length);
const pm=home.text.match(/"publishedTimeText":\{[^}]{0,120}/); console.log('sample:',pm?pm[0]:'none');
