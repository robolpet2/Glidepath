const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+__dirname+'/anim.html');await p.waitForTimeout(500);
const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate','30','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','frames.mp4'],{stdio:['pipe','ignore','inherit']});
const FPS=30,N=30*FPS;for(let i=0;i<N;i++){const d=await p.evaluate(t=>frame(t),i/FPS);
const buf=Buffer.from(d.split(',')[1],'base64');if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%150==0)console.log(i);}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();})();
