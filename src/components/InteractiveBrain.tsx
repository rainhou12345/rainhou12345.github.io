import { useEffect, useRef, useState, type PointerEvent } from 'react'

type Side = 'none' | 'left' | 'right' | 'both'
type Spark = { x:number; y:number; vx:number; vy:number; life:number; max:number; size:number }
type ReturnParticle = { startX:number; startY:number; controlX:number; controlY:number; targetX:number; targetY:number; t:number; speed:number; phase:number; orbit:number; size:number }

const folds = [
  [[30,-195],[65,-175],[50,-135],[88,-112]], [[95,-195],[125,-170],[112,-135],[148,-110]],
  [[155,-145],[125,-105],[160,-75],[145,-40]], [[45,-115],[80,-95],[65,-55],[105,-35]],
  [[115,-70],[145,-45],[125,-10],[165,5]], [[40,-35],[80,-10],[62,30],[105,48]],
  [[155,25],[120,45],[140,80],[105,95]], [[45,55],[82,78],[65,112],[105,125]],
  [[160,105],[125,115],[135,150],[95,165]], [[40,120],[75,140],[55,178],[82,190]],
] as const

const circuits = [[45,-210],[90,-165],[145,-125],[65,-100],[125,-65],[170,-35],[45,-45],[95,-5],[155,25],[55,45],[120,75],[175,95],[70,110],[135,135],[55,160],[100,180]] as const

export function InteractiveBrain() {
  const wrap = useRef<HTMLDivElement>(null)
  const brainCanvas = useRef<HTMLCanvasElement>(null)
  const particleCanvas = useRef<HTMLCanvasElement>(null)
  const sideRef = useRef<Side>('none')
  const sparks = useRef<Spark[]>([])
  const returning = useRef<ReturnParticle[]>([])
  const pulse = useRef({left:0,right:0,center:0})
  const [side,setSideState] = useState<Side>('none')

  const setSide = (next:Side) => {
    const previous=sideRef.current
    if(next===previous)return
    const hadLeft=previous==='left'||previous==='both',hasLeft=next==='left'||next==='both'
    const hadRight=previous==='right'||previous==='both',hasRight=next==='right'||next==='both'
    if(hadLeft&&!hasLeft)absorbWords('left')
    if(hadRight&&!hasRight)absorbWords('right')
    if(previous==='both'&&next!=='both')absorbWords('center')
    sideRef.current=next
    setSideState(next)
    if(next==='left'||next==='both')burst(-1)
    if(next==='right'||next==='both')burst(1)
  }

  const absorbWords = (group:'left'|'right'|'center') => {
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
    const host=wrap.current
    if(!host)return
    const box=host.getBoundingClientRect(),cx=box.width/2,cy=box.height*.52,scale=Math.min(box.width,box.height)/(box.width<520?640:540)
    const selector=group==='center'?'.brain-word[data-side="center"].visible':`.brain-word[data-side="${group}"].visible`
    host.querySelectorAll<HTMLElement>(selector).forEach(word=>{
      const rect=word.getBoundingClientRect(),text=word.textContent?.trim()||'',direction=group==='left'?-1:group==='right'?1:0
      for(let letter=0;letter<text.length;letter++){
        const startX=rect.left-box.left+(letter+.5)*rect.width/Math.max(1,text.length)+(Math.random()-.5)*5
        const startY=rect.top-box.top+rect.height/2+(Math.random()-.5)*8
        const targetX=group==='center'?cx+(Math.random()-.5)*18*scale:cx+direction*(45+Math.random()*120)*scale
        const targetY=group==='center'?cy-175*scale+(Math.random()-.5)*42*scale:cy+(Math.random()-.5)*260*scale
        const dx=targetX-startX,dy=targetY-startY,length=Math.max(1,Math.hypot(dx,dy)),normalX=-dy/length,normalY=dx/length
        const curve=(28+Math.random()*70)*(Math.random()>.5?1:-1)
        returning.current.push({startX,startY,controlX:(startX+targetX)/2+normalX*curve+(Math.random()-.5)*20,controlY:(startY+targetY)/2+normalY*curve+(Math.random()-.5)*20,targetX,targetY,t:0,speed:.011+Math.random()*.006,phase:Math.random()*Math.PI*2,orbit:8+Math.random()*17,size:1.65+Math.random()*1.35})
      }
    })
  }

  const burst = (direction:number) => {
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
    const box=wrap.current?.getBoundingClientRect()
    if(!box)return
    const scale=Math.min(box.width,box.height)/(box.width<520?640:540)
    for(let i=0;i<5;i++){
      const angle=(direction<0?Math.PI:0)+(Math.random()-.5)*1.5
      const speed=.45+Math.random()*1.15
      sparks.current.push({x:box.width/2+direction*(35+Math.random()*105)*scale,y:box.height*.52+(Math.random()-.5)*260*scale,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:24+Math.random()*20,max:44,size:1.4+Math.random()*1.4})
    }
  }

  const onPointerMove = (event:PointerEvent<HTMLDivElement>) => {
    const box=event.currentTarget.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top
    const scale=Math.min(box.width,box.height)/(box.width<520?640:540),cx=box.width/2,cy=box.height*.52
    const nx=(x-cx)/(215*scale),ny=(y-cy)/(245*scale)
    if(nx*nx+ny*ny>1){setSide('none');return}
    setSide(Math.abs(x-cx)<24*scale?'both':x<cx?'left':'right')
  }

  useEffect(()=>{
    const host=wrap.current,canvas=brainCanvas.current,particles=particleCanvas.current
    if(!host||!canvas||!particles)return
    const ctx=canvas.getContext('2d'),pctx=particles.getContext('2d')
    if(!ctx||!pctx)return
    pctx.globalCompositeOperation='lighter'
    let width=0,height=0,dpr=1,frame=0,left=0,right=0,running=true
    const resize=()=>{const box=host.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(devicePixelRatio||1,1.5);for(const item of [canvas,particles]){item.width=width*dpr;item.height=height*dpr}ctx.setTransform(dpr,0,0,dpr,0,0);pctx.setTransform(dpr,0,0,dpr,0,0)}
    const metrics=()=>({cx:width*.5,cy:height*.52,s:Math.min(width,height)/(width<520?640:540)})
    const halfPath=(context:CanvasRenderingContext2D,d:number)=>{const b=metrics(),x=b.cx,y=b.cy,s=b.s;context.beginPath();context.moveTo(x,y-245*s);context.bezierCurveTo(x+d*25*s,y-260*s,x+d*55*s,y-240*s,x+d*70*s,y-215*s);context.bezierCurveTo(x+d*115*s,y-220*s,x+d*165*s,y-185*s,x+d*170*s,y-145*s);context.bezierCurveTo(x+d*210*s,y-120*s,x+d*215*s,y-65*s,x+d*195*s,y-30*s);context.bezierCurveTo(x+d*225*s,y+10*s,x+d*215*s,y+70*s,x+d*185*s,y+90*s);context.bezierCurveTo(x+d*195*s,y+145*s,x+d*160*s,y+195*s,x+d*120*s,y+190*s);context.bezierCurveTo(x+d*90*s,y+225*s,x+d*35*s,y+220*s,x+d*15*s,y+190*s);context.bezierCurveTo(x+d*2*s,y+170*s,x,y+130*s,x,y+100*s);context.lineTo(x,y-245*s);context.closePath()}
    const fill=(d:number,a:number)=>{const b=metrics();ctx.save();halfPath(ctx,d);const g=ctx.createRadialGradient(b.cx+d*55*b.s,b.cy-35*b.s,5,b.cx+d*60*b.s,b.cy,230*b.s);g.addColorStop(0,`rgba(47,145,255,${.07+a*.1})`);g.addColorStop(.48,`rgba(16,73,145,${.05+a*.07})`);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fill();ctx.restore()}
    const outline=(d:number,a:number)=>{ctx.save();halfPath(ctx,d);ctx.shadowColor='#2f91ff';ctx.shadowBlur=20+a*17;ctx.strokeStyle=`rgba(47,145,255,${.12+a*.2})`;ctx.lineWidth=9;ctx.stroke();ctx.shadowBlur=10+a*13;ctx.strokeStyle=`rgba(47,145,255,${.48+a*.35})`;ctx.lineWidth=4;ctx.stroke();ctx.shadowBlur=5+a*8;ctx.strokeStyle=`rgba(154,207,255,${.76+a*.22})`;ctx.lineWidth=1.4;ctx.stroke();ctx.restore()}
    const drawFold=(points:readonly (readonly [number,number])[],d:number,a:number,time:number,index:number)=>{const b=metrics();ctx.beginPath();ctx.moveTo(b.cx+d*points[0][0]*b.s,b.cy+points[0][1]*b.s);for(let i=1;i<points.length-1;i++){const p=points[i],n=points[i+1];ctx.quadraticCurveTo(b.cx+d*p[0]*b.s,b.cy+p[1]*b.s,b.cx+d*(p[0]+n[0])/2*b.s,b.cy+(p[1]+n[1])/2*b.s)}const last=points[points.length-1];ctx.lineTo(b.cx+d*last[0]*b.s,b.cy+last[1]*b.s);const shimmer=Math.sin(time*.002+index*.55)*.5+.5;ctx.save();ctx.shadowColor='#2f91ff';ctx.shadowBlur=4+a*9;ctx.strokeStyle=`rgba(80,165,255,${.34+a*.44+shimmer*.07})`;ctx.lineWidth=1.05+a*.75;ctx.lineCap='round';ctx.stroke();ctx.restore()}
    const details=(d:number,a:number,time:number)=>{const b=metrics();circuits.forEach((point,i)=>{const x=b.cx+d*point[0]*b.s,y=b.cy+point[1]*b.s,len=(10+i%3*6)*b.s,shimmer=Math.sin(time*.003+i)*.5+.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+d*len,y);ctx.strokeStyle=`rgba(47,145,255,${.12+shimmer*.12+a*.18})`;ctx.lineWidth=.7;ctx.stroke();ctx.beginPath();ctx.arc(x+d*len,y,1.25+shimmer*.7+a*.25,0,Math.PI*2);ctx.fillStyle=`rgba(132,194,255,${.22+shimmer*.32+a*.3})`;ctx.fill()})}
    const draw=(time:number)=>{ctx.clearRect(0,0,width,height);const b=metrics(),leftGlow=Math.min(1,left+pulse.current.left),rightGlow=Math.min(1,right+pulse.current.right),aura=ctx.createRadialGradient(b.cx,b.cy,20*b.s,b.cx,b.cy,300*b.s);aura.addColorStop(0,'rgba(47,145,255,.07)');aura.addColorStop(.55,'rgba(20,79,160,.03)');aura.addColorStop(1,'transparent');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(b.cx,b.cy,300*b.s,0,Math.PI*2);ctx.fill();fill(-1,leftGlow);fill(1,rightGlow);outline(-1,leftGlow);outline(1,rightGlow);for(const d of [-1,1])folds.forEach((fold,i)=>drawFold(fold,d,d<0?leftGlow:rightGlow,time,i));details(-1,leftGlow,time);details(1,rightGlow,time);ctx.save();ctx.beginPath();ctx.moveTo(b.cx,b.cy-245*b.s);ctx.bezierCurveTo(b.cx-4*b.s,b.cy-140*b.s,b.cx+5*b.s,b.cy+60*b.s,b.cx,b.cy+190*b.s);ctx.strokeStyle=`rgba(116,188,255,${.52+Math.max(left,right,pulse.current.center)*.4})`;ctx.shadowColor='#2f91ff';ctx.shadowBlur=9+Math.max(left,right,pulse.current.center)*13;ctx.lineWidth=1.5;ctx.stroke();ctx.restore()}
    const drawParticles=()=>{pctx.clearRect(0,0,width,height);for(let i=sparks.current.length-1;i>=0;i--){const p=sparks.current[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.96;p.vy*=.96;p.life--;const alpha=Math.max(0,p.life/p.max);pctx.save();pctx.beginPath();pctx.arc(p.x,p.y,p.size,0,Math.PI*2);pctx.fillStyle=`rgba(92,169,255,${alpha*.68})`;pctx.shadowColor='#2f91ff';pctx.shadowBlur=7;pctx.fill();pctx.restore();if(p.life<=0)sparks.current.splice(i,1)}for(let i=returning.current.length-1;i>=0;i--){const p=returning.current[i];p.t=Math.min(1,p.t+p.speed);const t=p.t,ease=t<.12?t*.45:.054+(1-Math.pow(1-(t-.12)/.88,2.35))*.946,inv=1-ease,baseX=inv*inv*p.startX+2*inv*ease*p.controlX+ease*ease*p.targetX,baseY=inv*inv*p.startY+2*inv*ease*p.controlY+ease*ease*p.targetY,angle=p.phase+t*Math.PI*(3.2+Math.sin(p.phase)),orbit=p.orbit*Math.sin(Math.PI*t)*Math.pow(1-t,.35),x=baseX+Math.cos(angle)*orbit,y=baseY+Math.sin(angle)*orbit*.72,alpha=Math.max(0,1-Math.pow(t,3.2));pctx.save();pctx.beginPath();pctx.arc(x,y,p.size*(1-t*.58),0,Math.PI*2);pctx.fillStyle=`rgba(91,169,255,${alpha*.9})`;pctx.shadowColor='#2f91ff';pctx.shadowBlur=7*(1-t*.45);pctx.fill();pctx.restore();if(t>=.88){const center=Math.abs(p.targetX-width*.5)<25;if(center)pulse.current.center=Math.max(pulse.current.center,.7);else if(p.targetX<width*.5)pulse.current.left=Math.max(pulse.current.left,.55);else pulse.current.right=Math.max(pulse.current.right,.55)}if(t>=1)returning.current.splice(i,1)}}
    const animate=(time:number)=>{if(!running)return;left+=(((sideRef.current==='left'||sideRef.current==='both')?1:0)-left)*.075;right+=(((sideRef.current==='right'||sideRef.current==='both')?1:0)-right)*.075;pulse.current.left*=.9;pulse.current.right*=.9;pulse.current.center*=.9;draw(time);drawParticles();frame=requestAnimationFrame(animate)}
    const observer=new ResizeObserver(resize),visibility=()=>{running=!document.hidden;if(running)frame=requestAnimationFrame(animate);else cancelAnimationFrame(frame)}
    observer.observe(host);resize();document.addEventListener('visibilitychange',visibility);frame=requestAnimationFrame(animate)
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);cancelAnimationFrame(frame)}
  },[])

  const leftVisible=side==='left'||side==='both',rightVisible=side==='right'||side==='both'
  return <div ref={wrap} className="interactive-brain" onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={()=>setSide('none')} role="img" aria-label="Interactive brain connecting creative and technical curiosity">
    <canvas ref={brainCanvas}/>
    <div data-side="left" className={`brain-word design${leftVisible?' visible':''}`}>DESIGN</div><div data-side="left" className={`brain-word create${leftVisible?' visible':''}`}>CREATE</div><div data-side="left" className={`brain-word music${leftVisible?' visible':''}`}>MUSIC</div><div data-side="left" className={`brain-word paradox${leftVisible?' visible':''}`}>PARADOX</div>
    <div data-side="right" className={`brain-word understand${rightVisible?' visible':''}`}>UNDERSTAND</div><div data-side="right" className={`brain-word simulate${rightVisible?' visible':''}`}>SIMULATE</div><div data-side="right" className={`brain-word analyze${rightVisible?' visible':''}`}>ANALYZE</div><div data-side="right" className={`brain-word model${rightVisible?' visible':''}`}>MODEL</div>
    <div data-side="center" className={`brain-word curiosity${side==='both'?' visible':''}`}>CURIOSITY</div><canvas ref={particleCanvas} className="brain-particles"/><p className="brain-hint">Hover Across My Brain!</p>
  </div>
}
