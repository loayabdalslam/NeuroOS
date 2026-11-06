const ctx={client:{clientName:'MWEB',clientVersion:'2.20240726.01.00',hl:'en',gl:'US'}};
const KEY='AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const r=await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${KEY}&prettyPrint=false`,{method:'POST',headers:{'content-type':'application/json','user-agent':UA},body:JSON.stringify({context:ctx,browseId:'UC9x0AN7BWHpCDHSm9NiJFJQ'})});
const t=await r.text();
console.log('occurrences of "subscriber":',(t.match(/subscriber/gi)||[]).length);
let i=-1,n=0;
while((i=t.indexOf('subscriber',i+1))!==-1 && n<6){ console.log('---',JSON.stringify(t.slice(i-160,i+120))); n++; }
