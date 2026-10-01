// Kinematic preview controller. Units: mm, radians, seconds.
// One clock and one mesh-aware IK solve own each frame. There are no per-leg
// touchdown latches, accumulated reach corrections, or post-IK body teleports.
export function createMotionController(THREE, assembly) {
  const clamp=THREE.MathUtils.clamp, rad=THREE.MathUtils.degToRad;
  const legs=Object.values(assembly.legs), root=assembly.root;
  const smooth=u=>{u=clamp(u,0,1);return u*u*u*(10+u*(-15+6*u));};
  const moving=m=>["walk","backward","trot","sprint","turnLeft","turnRight"].includes(m);
  const crawl=[0,.5,.75,.25], trot=[0,.5,.5,0];
  let mode="stand", phase=0, age=1, heading=root.rotation.y, clock=0;
  let settings={speed:1,length:40,height:24,body:112};
  let filtered={...settings}, transition=null;
  const vector=new THREE.Vector3();

  // Deduplicate STL vertices once. Exact mesh support uses all distinct
  // vertices, including the rounded paw, instead of an assumed link endpoint.
  for(const l of legs){
    const unique=new Map(),a=l.lower.geometry.attributes.position.array;
    for(let i=0;i<a.length;i+=3)unique.set(`${a[i]},${a[i+1]},${a[i+2]}`,[a[i],a[i+1],a[i+2]]);
    l.supportVertices=new Float64Array([...unique.values()].flat());
    l.lower.geometry.computeBoundingBox();
    const b=l.lower.geometry.boundingBox;
    l.pawPoint=new THREE.Vector3((b.min.x+b.max.x)/2,70*Math.sin(rad(20))+2,-70*Math.cos(rad(20)));
    l.target={x:0,lift:0,side:4};
  }
  function measure(l){
    l.side.updateWorldMatrix(true,true);
    const e=l.lower.matrixWorld.elements,a=l.supportVertices;
    let y=Infinity;
    for(let i=0;i<a.length;i+=3)y=Math.min(y,e[1]*a[i]+e[5]*a[i+1]+e[9]*a[i+2]+e[13]);
    vector.copy(l.pawPoint).applyMatrix4(l.lower.matrixWorld);
    return {x:Math.cos(heading)*vector.x-Math.sin(heading)*vector.z,y};
  }
  root.updateMatrixWorld(true);
  const bottom=Math.min(...legs.map(l=>measure(l).y));
  root.position.y-=bottom;
  root.updateMatrixWorld(true);
  const standingHeight=root.position.y;
  for(const l of legs)l.homeX=measure(l).x;
  let body=standingHeight, pitch=0, roll=0, heave=0, motionBlend=0, appliedStepHeight=24;

  function solve(l,x,y){
    // Solve the actual transformed paw's fore/aft position and its lowest
    // surface height together. Keep the established knee-bend branch.
    const eps=.0001;
    let error=Infinity;
    for(let n=0;n<14;n++){
      const p=measure(l),ex=x-p.x,ey=y-p.y;
      error=Math.hypot(ex,ey);if(error<.002)break;
      const h=l.hip.rotation.y,k=l.knee.rotation.y;
      l.hip.rotation.y=h+eps;const ph=measure(l);l.hip.rotation.y=h;
      l.knee.rotation.y=k+eps;const pk=measure(l);l.knee.rotation.y=k;
      const ax=(ph.x-p.x)/eps,ay=(ph.y-p.y)/eps,bx=(pk.x-p.x)/eps,by=(pk.y-p.y)/eps;
      const det=ax*by-ay*bx;if(Math.abs(det)<.01)break;
      const dh=(ex*by-ey*bx)/det,dk=(ax*ey-ay*ex)/det;
      const scale=Math.min(1,.18/Math.max(Math.abs(dh),Math.abs(dk)));
      l.hip.rotation.y=clamp(h+dh*scale,-1.6,2.2);
      l.knee.rotation.y=clamp(k+dk*scale,-2.85,-.08);
    }
    const p=measure(l);
    l.contactGap=p.y;l.ikError=Math.hypot(x-p.x,y-p.y);
    l.commandedPlant=l.target.lift<.01;
    l.isStance=l.commandedPlant&&Math.abs(p.y)<.1;
    l.telemetry={forward:l.target.x,down:filtered.body,sideDegrees:l.target.side};
    return error;
  }
  // Calibrate both mirrored feet to the same floor before the first frame.
  legs.forEach(l=>solve(l,l.homeX,0));

  function path(cycle,stride,lift,duty){
    if(cycle<duty)return {x:stride*(.5-smooth(cycle/duty)),lift:0,side:4};
    const u=(cycle-duty)/(1-duty),arc=Math.sin(Math.PI*u)**2;
    return {x:stride*(-.5+smooth(u)),lift:lift*arc,side:4+3*arc};
  }
  function snapshot(){return {mode,phase,heading,bodyY:root.position.y,pitch,roll,appliedStepHeight,requestedStepHeight:settings.height,legs:legs.map(l=>({name:l.name,sx:l.sx,sy:l.sy,x:l.target.x,lift:l.target.lift,gap:l.contactGap,stance:l.isStance,error:l.ikError,angles:[l.side.rotation.x,l.hip.rotation.y,l.knee.rotation.y]}))};}
  function setMode(next){
    if(next==="reset")next="stand";
    if(next===mode)return;
    // Pose reset preserves heading and camera. Only Reset view owns the camera.
    transition={targets:legs.map(l=>({...l.target})),body:body-heave,pitch,roll};
    mode=next;age=0;
    if(!moving(mode))phase=0;
  }
  function advance(dt){
    if(mode==="stop")return;
    clock+=dt;age+=dt;
    const blend=1-Math.exp(-4*dt);
    for(const key of Object.keys(filtered))filtered[key]+=(settings[key]-filtered[key])*blend;
    const isMoving=moving(mode),turn=mode==="turnLeft"||mode==="turnRight";
    const rate=(mode==="sprint"?1.15:mode==="trot"?.85:.60)*filtered.speed;
    if(isMoving)phase=(phase+dt*rate)%1;
    const mix=transition?smooth(age/.9):1;
    // Heel/sole geometry contributes to measured height. The body setting
    // controls this shared chassis height; every leg solves to the same floor.
    const desiredBody=Math.max(standingHeight-35,standingHeight+filtered.body-112-(mode==="sit"?30:0));
    const baseBody=transition?THREE.MathUtils.lerp(transition.body,desiredBody,mix):desiredBody;
    // Conservative mesh-tested workspace envelope: a low body cannot also
    // clear a tall step without folding through the retained knee branch.
    // Reserve clearance for the paw geometry and the body lean/heave below.
    appliedStepHeight=Math.min(filtered.height,Math.max(8,baseBody-40));
    motionBlend+=(Number(isMoving)-motionBlend)*(1-Math.exp(-4*dt));
    const offsets=(mode==="trot"||mode==="sprint")?trot:crawl;
    const duty=(mode==="trot"||mode==="sprint")?.62:.76;
    const targets=legs.map((l,i)=>{
      const inside=turn&&((mode==="turnLeft"&&l.sy>0)||(mode==="turnRight"&&l.sy<0));
      const stride=filtered.length*(inside?.4:1);
      let t=isMoving?path((phase+offsets[i])%1,stride,appliedStepHeight,duty):{x:0,lift:0,side:mode==="sit"?16:4};
      if(mode==="backward")t.x=-t.x;
      if(transition){const from=transition.targets[i];t={x:THREE.MathUtils.lerp(from.x,t.x,mix),lift:THREE.MathUtils.lerp(from.lift,t.lift,mix),side:THREE.MathUtils.lerp(from.side,t.side,mix)};}
      if(t.lift<.00001)t.lift=0;
      return t;
    });
    // Small damped lean toward the current support centroid. Feet are solved
    // after this body transform, so tilt cannot pull a stance paw off the floor.
    const support=legs.filter((l,i)=>targets[i].lift<.01);
    const centroidX=support.reduce((sum,l)=>sum+l.sx,0)/Math.max(1,support.length);
    const centroidSide=support.reduce((sum,l)=>sum+l.sy,0)/Math.max(1,support.length);
    const lean=rad(3)*motionBlend;
    pitch+=(centroidX*lean+rad(.5)*Math.sin(phase*4*Math.PI)*motionBlend-pitch)*(1-Math.exp(-7*dt));
    roll+=(centroidSide*lean-roll)*(1-Math.exp(-7*dt));
    // Smooth visual compliance, not an impact impulse or a rigid-body solver.
    // Starts from zero; stance IK is evaluated after the complete body pose.
    heave+=(-1.5*(1-Math.cos(phase*4*Math.PI))*motionBlend-heave)*(1-Math.exp(-8*dt));
    body=baseBody+heave;
    if(turn)heading+=(mode==="turnLeft"?1:-1)*rad(9)*filtered.speed*dt*mix;
    root.position.y=body;root.rotation.set(roll,heading,pitch,"YXZ");
    legs.forEach((l,i)=>{l.target=targets[i];l.side.rotation.x=l.sy*rad(l.target.side);solve(l,l.homeX+l.target.x,l.target.lift);});
    const wag=mode==="wag"||isMoving;
    assembly.tailJoint.rotation.z+=( (wag?Math.sin(clock*5)*.3:0)-assembly.tailJoint.rotation.z)*(1-Math.exp(-8*dt));
    if(mix===1)transition=null;
  }
  function update(dt){
    // Slow the shared trajectory clock when any joint reaches its speed limit.
    // Capping each servo separately would make feet lag behind their targets
    // and would reintroduce the asymmetric touchdown bug.
    let remaining=Math.min(Math.max(dt,0),.1);
    while(remaining>1e-8){
      const step=Math.min(1/120,remaining);
      const saved={phase,age,heading,clock,body,pitch,roll,heave,motionBlend,appliedStepHeight,filtered:{...filtered},transition,
        targets:legs.map(l=>({...l.target})),tail:assembly.tailJoint.rotation.z,angles:legs.map(l=>[l.side.rotation.x,l.hip.rotation.y,l.knee.rotation.y])};
      const restore=()=>{
        ({phase,age,heading,clock,body,pitch,roll,heave,motionBlend,appliedStepHeight,transition}=saved);filtered={...saved.filtered};
        assembly.tailJoint.rotation.z=saved.tail;
        root.position.y=body;root.rotation.set(roll,heading,pitch,"YXZ");
        legs.forEach((l,i)=>{l.target={...saved.targets[i]};[l.side.rotation.x,l.hip.rotation.y,l.knee.rotation.y]=saved.angles[i];});
      };
      let trial=step,accepted=false;
      for(let attempt=0;attempt<8;attempt++){
        if(attempt)restore();advance(trial);
        const delta=Math.max(...legs.flatMap((l,i)=>[l.side.rotation.x,l.hip.rotation.y,l.knee.rotation.y].map((a,j)=>Math.abs(a-saved.angles[i][j]))));
        const limit=rad(mode==="sprint"?360:240)*step;
        const converged=legs.every(l=>l.ikError<.03);
        if(converged&&delta<=limit+1e-7){accepted=true;break;}
        trial*=converged?Math.max(.05,limit/delta*.94):.5;
      }
      // Never commit a failed solve after exhausting retries.
      if(!accepted){restore();legs.forEach(l=>solve(l,l.homeX+l.target.x,l.target.lift));}
      remaining-=step;
    }
  }
  return {update,setMode,snapshot,get mode(){return mode;},setSettings(next){Object.assign(settings,next);}};
}
