/* 기념 사진 표지 만들기 (100·500·1000번째): 사람만 오려내서 제호·큰 숫자·이름 글자 사이에 끼워 넣어요.
   사진은 기기 안에서만 처리돼요(밖으로 나가지 않음). 실패하면 호출한 쪽이 옛 카드로 대신해요. */
(function(){
var IV='#F5F0E5',YE='#FFD400',BASE=(function(){var s=document.currentScript;return s&&s.src?s.src.replace(/[^\/]*$/,''):''})();
function loadScript(u){return new Promise(function(ok,no){var s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=function(){no(new Error('load '+u))};document.head.appendChild(s)})}
var fontsP=null;
function fonts(){if(fontsP)return fontsP;var defs=[['normal','600','fonts/bc600.woff2'],['italic','600','fonts/bc600i.woff2'],['italic','800','fonts/bc800i.woff2']];
 fontsP=Promise.all(defs.map(function(d){var f=new FontFace('JWBC','url('+BASE+d[2]+')',{style:d[0],weight:d[1]});return f.load().then(function(x){document.fonts.add(x)})})).then(function(){return Promise.all(['800 40px Pretendard','700 40px Pretendard','600 40px Pretendard'].map(function(f){return document.fonts.load(f,'출석회원번째홍길동')}))});return fontsP}
var ssP=null;
function getSeg(){if(ssP)return ssP;ssP=(async function(){if(typeof SelfieSegmentation==='undefined')await loadScript(BASE+'face/seg/selfie_segmentation.js');
 var ss=new SelfieSegmentation({locateFile:function(f){return BASE+'face/seg/'+f}});ss.setOptions({modelSelection:0});await ss.initialize();return ss})();ssP.catch(function(){ssP=null});return ssP}
async function seg(cv){var ss=await getSeg();return await new Promise(function(ok,no){var t=setTimeout(function(){no(new Error('seg timeout'))},20000);ss.onResults(function(r){clearTimeout(t);ok(r.segmentationMask)});ss.send({image:cv}).catch(no)})}
function cleanMask(m){var w=m.width,h=m.height,c=document.createElement('canvas');c.width=w;c.height=h;var g=c.getContext('2d');g.drawImage(m,0,0);
 var d=g.getImageData(0,0,w,h).data,a=new Uint8Array(w*h),i;for(i=0;i<w*h;i++)a[i]=d[i*4]>140?1:0;
 var sx=-1,sy=-1,x,y;for(y=h-1;y>h*.6&&sx<0;y-=4)for(x=Math.floor(w*.4);x<w*.6;x+=4)if(a[y*w+x]){sx=x;sy=y;break}
 if(sx<0)throw new Error('no person');
 var keep=new Uint8Array(w*h),st=[sy*w+sx];keep[st[0]]=1;while(st.length){var p=st.pop();x=p%w;y=(p/w)|0;
  if(x>0&&a[p-1]&&!keep[p-1]){keep[p-1]=1;st.push(p-1)}if(x<w-1&&a[p+1]&&!keep[p+1]){keep[p+1]=1;st.push(p+1)}
  if(y>0&&a[p-w]&&!keep[p-w]){keep[p-w]=1;st.push(p-w)}if(y<h-1&&a[p+w]&&!keep[p+w]){keep[p+w]=1;st.push(p+w)}}
 var o=document.createElement('canvas');o.width=w;o.height=h;var og=o.getContext('2d'),id=og.createImageData(w,h),x0=w,x1=0,y0=h,y1=0,n=0;
 for(i=0;i<w*h;i++){id.data[i*4+3]=keep[i]?255:0;if(keep[i]){n++;x=i%w;y=(i/w)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
 if(n<w*h*.04)throw new Error('person too small');
 og.putImageData(id,0,0);
 var e=document.createElement('canvas');e.width=w;e.height=h;var eg=e.getContext('2d');eg.drawImage(o,0,0);eg.globalCompositeOperation='destination-in';var R=Math.max(3,Math.round(w/190));for(var k=0;k<16;k++){var an=k/16*6.2832;eg.drawImage(o,Math.cos(an)*R,Math.sin(an)*R)}
 var s=document.createElement('canvas');s.width=w;s.height=h;var sg=s.getContext('2d');sg.filter='blur(2px)';sg.drawImage(e,0,0);
 return{c:s,bb:[x0,y0,x1,y1],d:s}}
function grade(g,W,H){var im=g.getImageData(0,0,W,H),d=im.data;for(var i=0;i<d.length;i+=4){var r=d[i]/255,gg=d[i+1]/255,b=d[i+2]/255,l=.3*r+.59*gg+.11*b;
 r=.5+(r-.5)*1.06+.035;gg=.5+(gg-.5)*1.06+.03;b=.5+(b-.5)*1.06+.02;r=l+(r-l)*.94;gg=l+(gg-l)*.94;b=l+(b-l)*.94;r=r*1.05+.012;b=b*.92;
 var n=(Math.random()+Math.random()-1)*.045;d[i]=Math.max(0,Math.min(255,(r+n)*255));d[i+1]=Math.max(0,Math.min(255,(gg+n)*255));d[i+2]=Math.max(0,Math.min(255,(b+n)*255))}g.putImageData(im,0,0)}
function sp(g,t,x,y,ls,al){g.letterSpacing=ls+'px';g.textAlign=al||'left';g.fillText(t,x,y);g.letterSpacing='0px'}
/* 사진 한 장을 적당한 크기의 캔버스로 (앞 카메라 영상이면 좌우 뒤집어 보이는 그대로) */
function grab(src,mirror){var iw=src.videoWidth||src.naturalWidth||src.width,ih=src.videoHeight||src.naturalHeight||src.height,k=Math.min(1,1500/Math.max(iw,ih)),c=document.createElement('canvas');c.width=Math.round(iw*k);c.height=Math.round(ih*k);
 var g=c.getContext('2d');if(mirror){g.translate(c.width,0);g.scale(-1,1)}g.drawImage(src,0,0,c.width,c.height);return c}
var MON=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
async function make(src,mirror,no,name){
 await fonts();var img=grab(src,mirror),m=cleanMask(await seg(img));
 var W=1080,H=1440,c=document.createElement('canvas');c.width=W;c.height=H;var g=c.getContext('2d'),bb=m.bb,bw=bb[2]-bb[0],bh=bb[3]-bb[1],cx=(bb[0]+bb[2])/2,s=Math.min(W*.95/bw,H*.86/bh),headTop=H*.18;
 var ox=W*.5-cx*s,oy=headTop-bb[1]*s;if(oy+img.height*s<H)oy=H-img.height*s;
 var bgS=Math.max(W/img.width,H/img.height)*1.35;g.save();g.filter='blur(28px) brightness(.88) saturate(.92)';g.drawImage(img,W/2-(cx*bgS),H*.1-bb[1]*bgS*.6,img.width*bgS,img.height*bgS);g.restore();
 g.fillStyle='rgba(18,16,14,.25)';g.fillRect(0,0,W,H);
 /* 뒤: 제호 */
 var BC=function(sz,it,wt){return (it?'italic ':'')+wt+' '+sz+'px JWBC, Impact, sans-serif'};
 g.fillStyle=IV;g.textAlign='center';g.textBaseline='alphabetic';var fs=600;g.font=BC(fs,1,800);while(g.measureText('JWADONG').width>W-60&&fs>60){fs-=6;g.font=BC(fs,1,800)}
 g.save();g.translate(W/2,H*.275);g.scale(1,1.2);g.fillText('JWADONG',0,0);g.restore();
 /* 가운데: 사람 */
 var pc=document.createElement('canvas');pc.width=W;pc.height=H;var pg=pc.getContext('2d');pg.drawImage(img,ox,oy,img.width*s,img.height*s);
 pg.globalCompositeOperation='destination-in';pg.drawImage(m.c,ox,oy,img.width*s,img.height*s);
 g.save();g.shadowColor='rgba(0,0,0,.45)';g.shadowBlur=36;g.shadowOffsetY=6;g.drawImage(pc,0,0);g.restore();
 grade(g,W,H);var vg=g.createRadialGradient(W/2,H*.45,H*.3,W/2,H*.5,H*.8);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=vg;g.fillRect(0,0,W,H);
 /* 앞: 글자 */
 var d=new Date();g.fillStyle=IV;g.font=BC(28,0,600);sp(g,'BADMINTON CLUB · '+MON[d.getMonth()]+' '+d.getFullYear(),W/2+6,62,12,'center');
 g.strokeStyle=IV;g.lineWidth=2;g.beginPath();g.moveTo(60,50);g.lineTo(140,50);g.moveTo(W-140,50);g.lineTo(W-60,50);g.stroke();
 var md=m.c.getContext('2d').getImageData(0,0,m.c.width,m.c.height).data,L=0,R=0,y0=Math.max(0,Math.floor((H*.45-oy)/s)),y1=Math.min(m.c.height,Math.floor((H*.75-oy)/s));
 for(var y=y0;y<y1;y+=8){for(var x=0;x<m.c.width;x+=8){var px=ox+x*s;if(md[(y*m.c.width+x)*4+3]>128){if(px<W*.34)L++;else if(px>W*.66)R++}}}
 var left=L<=R,X=left?56:W-56,AL=left?'left':'right',y100=H*.7,NX=left?W-56:56,NA=left?'right':'left',ns=String(no);
 /* 큰 숫자 (이름 뒤): 자릿수가 달라도 폭은 같게 */
 g.save();g.fillStyle=YE;var nf=470;g.font=BC(nf,1,800);var w3=(function(){g.font=BC(470,1,800);return g.measureText('100').width})();g.font=BC(470,1,800);nf=Math.round(470*w3/g.measureText(ns).width);if(nf>470)nf=470;
 g.font=BC(nf,1,800);g.textAlign=NA;g.fillText(ns,NX-(NA=='right'?58:-58),H-80);g.font=BC(Math.round(nf*.22),1,800);g.fillText('th',NX,H-80-nf*.62);g.restore();
 /* 왼쪽(또는 사람 없는 쪽) 문구 */
 g.fillStyle=IV;g.textAlign=AL;g.save();g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=14;g.font='800 64px Pretendard, sans-serif';g.fillText(ns+'번째',X,y100+86);g.fillStyle=IV;g.font='800 76px Pretendard, sans-serif';g.fillText('출석회원',X,y100+170);g.restore();
 g.fillStyle=YE;g.fillRect(left?X:X-90,y100+198,90,6);
 g.fillStyle=IV;g.font=BC(28,0,600);['SPECIAL','MEMBER','ISSUE'].forEach(function(t,i){sp(g,t,X,y100+250+i*38,12,AL)});
 /* 이름 (숫자 위) */
 var nm=String(name||'').toUpperCase(),f2=84;g.fillStyle=IV;g.font='700 '+f2+'px Pretendard, sans-serif';g.letterSpacing='8px';while(g.measureText(nm).width>W*.46&&f2>36){f2-=4;g.font='700 '+f2+'px Pretendard, sans-serif'}
 g.save();g.shadowColor='rgba(0,0,0,.35)';g.shadowBlur=10;g.textAlign=NA;g.fillText(nm,NX,H-146);g.restore();g.letterSpacing='0px';
 g.fillStyle=YE;g.fillRect(left?NX-110:NX,H-124,110,5);
 g.fillStyle=IV;g.font=BC(54,1,600);g.textAlign=NA;g.fillText("Today's Star",NX,H-62);
 return c}
window.JWcover=make;
window.JWcoverWarm=function(){fonts().catch(function(){});getSeg().catch(function(){})};
})();
