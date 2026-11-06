const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const r=await fetch('https://www.youtube.com/@MrBeast/about?hl=en',{headers:{'user-agent':UA,'accept-language':'en-US,en;q=0.9'}});
const t=await r.text();
const i=t.indexOf('chucky@mrbeastbusiness.com');
console.log('CTX:',JSON.stringify(t.slice(i-400,i+200)));
const j=t.indexOf('aboutChannelViewModel');
console.log('\nABOUT MODEL:',JSON.stringify(t.slice(j-100,j+1200)));
