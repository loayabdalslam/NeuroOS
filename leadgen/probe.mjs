const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const handles=['@MrBeast','@Fireship','@lexfridman','@ThePrimeagen','@NetworkChuck','@TechWithTim'];
const emailRe=/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
for(const h of handles){
  const url=`https://www.youtube.com/${h}/about?hl=en`;
  try{
    const r=await fetch(url,{headers:{'user-agent':UA,'accept-language':'en-US,en;q=0.9'}});
    const t=await r.text();
    const emails=[...new Set((t.match(emailRe)||[]).filter(e=>!e.endsWith('.png')&&!e.endsWith('.jpg')&&!e.includes('youtube')&&!e.includes('google')))];
    const hasBiz=t.includes('businessEmail')||t.includes('business_email');
    const hasView=t.includes('View email address');
    console.log(`${h}: status=${r.status} len=${t.length} emails=${JSON.stringify(emails.slice(0,5))} businessEmail=${hasBiz} viewBtn=${hasView}`);
  }catch(e){console.log(`${h}: ERR ${e.message}`)}
}
