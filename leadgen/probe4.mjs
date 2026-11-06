const tries=[
 {name:'WEB',ctx:{client:{clientName:'WEB',clientVersion:'2.20240726.00.00',hl:'en',gl:'US'}}},
 {name:'ANDROID',ctx:{client:{clientName:'ANDROID',clientVersion:'19.09.37',androidSdkVersion:30,hl:'en',gl:'US'}}},
 {name:'IOS',ctx:{client:{clientName:'IOS',clientVersion:'19.09.3',deviceModel:'iPhone14,3',hl:'en',gl:'US'}}},
 {name:'MWEB',ctx:{client:{clientName:'MWEB',clientVersion:'2.20240726.01.00',hl:'en',gl:'US'}}},
];
const ids={MrBeast:'UCX6OQ3DkcsbYNE6H8uQQuVA',NetworkChuck:'UC9x0AN7BWHpCDHSm9NiJFJQ',Fireship:'UCsBjURrPoezykLs9EqgamOA',lexfridman:'UCSHZKyawb77ixDdsGog4iWA'};
for(const t of tries){
 for(const [n,id] of Object.entries(ids)){
  try{
   const r=await fetch('https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false',{
     method:'POST',headers:{'content-type':'application/json','user-agent':'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'},
     body:JSON.stringify({context:t.ctx,browseId:id})});
   const txt=await r.text();
   const emails=[...new Set((txt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)||[]))].filter(e=>!e.includes('google')&&!e.includes('youtube'));
   console.log(`${t.name} ${n}: ${r.status} len=${txt.length} biz=${txt.includes('businessEmail')} emails=${JSON.stringify(emails.slice(0,3))}`);
  }catch(e){console.log(t.name,n,'ERR',e.message)}
 }
}
