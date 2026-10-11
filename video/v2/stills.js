const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>console.log('LOG',m.text()));
await p.goto('file://'+__dirname+'/anim.html');await p.evaluate(()=>ready());
const ts=process.argv.slice(2).map(Number);fs.mkdirSync('st',{recursive:true});
for(const t of ts){const s=Date.now();const d=await p.evaluate(t=>frame(t),t);fs.writeFileSync(`st/${t.toFixed(2)}.jpg`,Buffer.from(d.split(',')[1],'base64'));console.log(t,Date.now()-s,'ms')}
await b.close()})();
