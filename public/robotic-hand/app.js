const video = document.querySelector('#video');
const overlay = document.querySelector('#overlay');
const ctx = overlay.getContext('2d');
const panel = document.querySelector('#three');
const playerMove = document.querySelector('#player-move');
const robotMove = document.querySelector('#robot-move');
const button = document.querySelector('#start');
const status = document.querySelector('#status');

const connections = [
  [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12], [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20], [5,9],[9,13],[13,17],[5,17]
];
const fingerLandmarks = {
  index: [5,6,7,8], middle: [9,10,11,12],
  ring: [13,14,15,16], little: [17,18,19,20], thumb: [1,2,3,4]
};
let THREE, renderer, camera, scene, root, tiltGroup, hand, thumbMount, rig = {}, markers = {}, tracker, lastFrame = -1;
let mechanicalTransition=null;
const tipRadii = {thumb:5.2,index:4.5,middle:4.7,ring:4.5,little:4.2};
const colliders = [];
let collisionGuard = false;
const trackingCanvas = document.createElement('canvas');
const trackingContext = trackingCanvas.getContext('2d', {willReadFrequently:true});
let ready = false;

// Binary STL parser: meshes retain the millimetre coordinates from the ZIP.
function stlGeometry(buffer) {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  if (84 + count * 50 > buffer.byteLength) throw new Error('Incomplete STL file');
  const vertices = new Float32Array(count * 9);
  const normals = new Float32Array(count * 9);
  for (let i = 0; i < count; i++) {
    const start = 84 + i * 50;
    const nx = view.getFloat32(start, true);
    const ny = view.getFloat32(start + 4, true);
    const nz = view.getFloat32(start + 8, true);
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        vertices[i * 9 + j * 3 + k] = view.getFloat32(start + 12 + j * 12 + k * 4, true);
      }
      normals.set([nx, ny, nz], i * 9 + j * 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function materialFor(part) {
  if (part.section === 'palm') return new THREE.MeshStandardMaterial({
    color: 0x8daabe, metalness: 0.60, roughness: 0.33,
    side: THREE.DoubleSide
  });
  if (part.section === 'carriage') return new THREE.MeshStandardMaterial({
    color: 0x7097b2, metalness: 0.70, roughness: 0.27, side: THREE.DoubleSide
  });
  const shades = {proximal: 0xe3e9ee, middle: 0xa3b8c9, distal: 0xd6e0e8};
  return new THREE.MeshStandardMaterial({
    color: shades[part.section], metalness: 0.58, roughness: 0.31,
    side: THREE.DoubleSide
  });
}

async function initializeModel() {
  const [threeModule, manifestResponse] = await Promise.all([
    import('./vendor/three/three.module.js'), fetch('./hand/assembly.json')
  ]);
  if (!manifestResponse.ok) throw new Error('Assembly file could not load');
  THREE = threeModule;
  const manifest = await manifestResponse.json();
  thumbAngle = manifest.thumb_mount.rest_angle_degrees*Math.PI/180;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1728);
  camera = new THREE.OrthographicCamera(-160, 160, 140, -140, 0.1, 1000);
  camera.position.set(-25, 76, 350);
  camera.lookAt(-25, 76, 0);
  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute('aria-label', '3D robotic hand. Drag to rotate, scroll to zoom, double click to reset.');
  renderer.domElement.tabIndex=0;
  renderer.domElement.style.touchAction='none';
  panel.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x324459, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 3.0);
  key.position.set(-90, 145, 180); scene.add(key);
  const fill = new THREE.DirectionalLight(0x66bdff, 1.2);
  fill.position.set(90, 25, 110); scene.add(fill);
  root = new THREE.Group();
  root.position.set(-25,76,0);
  tiltGroup = new THREE.Group();
  root.add(tiltGroup);
  hand = new THREE.Group();
  hand.position.set(25,-76,0);
  tiltGroup.add(hand);
  scene.add(root);
  let drag=null;
  renderer.domElement.addEventListener('pointerdown',event=>{
    drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.style.cursor='grabbing';
  });
  renderer.domElement.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    tiltGroup.rotation.y+=(event.clientX-drag.x)*.009;
    tiltGroup.rotation.x+=(event.clientY-drag.y)*.009;
    drag.x=event.clientX;drag.y=event.clientY;
  });
  function endDrag(event){if(drag?.id===event.pointerId)drag=null;renderer.domElement.style.cursor='grab';}
  renderer.domElement.addEventListener('pointerup',endDrag);
  renderer.domElement.addEventListener('pointercancel',endDrag);
  renderer.domElement.addEventListener('wheel',event=>{
    event.preventDefault();
    camera.zoom=clamp(camera.zoom*Math.exp(-event.deltaY*.0012),.55,3.2);
    camera.updateProjectionMatrix();
  },{passive:false});
  renderer.domElement.addEventListener('dblclick',()=>{
    tiltGroup.rotation.set(0,0,0);camera.zoom=1;camera.updateProjectionMatrix();
  });
  renderer.domElement.addEventListener('keydown',event=>{
    const turns={ArrowLeft:[0,-.15],ArrowRight:[0,.15],ArrowUp:[-.15,0],ArrowDown:[.15,0]};
    if(turns[event.key]){
      event.preventDefault();tiltGroup.rotation.x+=turns[event.key][0];tiltGroup.rotation.y+=turns[event.key][1];
    } else if(event.key==='+'||event.key==='='){
      event.preventDefault();camera.zoom=clamp(camera.zoom*1.15,.55,3.2);camera.updateProjectionMatrix();
    } else if(event.key==='-'){
      event.preventDefault();camera.zoom=clamp(camera.zoom/1.15,.55,3.2);camera.updateProjectionMatrix();
    }
  });
  renderer.domElement.style.cursor='grab';

  const loaded = await Promise.all(manifest.parts.map(async part => {
    const response = await fetch('./hand/stl/' + encodeURIComponent(part.file));
    if (!response.ok) throw new Error('Could not load ' + part.file);
    return {part, geometry: stlGeometry(await response.arrayBuffer())};
  }));
  if (loaded.length !== 16) throw new Error('Expected 16 hand parts');
  const palmItem = loaded.find(item => item.part.section === 'palm');
  hand.add(new THREE.Mesh(palmItem.geometry, materialFor(palmItem.part)));

  for (const finger of Object.keys(fingerLandmarks)) {
    const sections = finger === 'thumb' ? ['proximal','distal'] : ['proximal','middle','distal'];
    let parent = hand;
    let previousPivot = [0,0,0];
    if (finger === 'thumb') {
      const item = loaded.find(x => x.part.finger === 'thumb' && x.part.section === 'carriage');
      if (!item) throw new Error('Missing thumb CMC carriage');
      const [x,y,z] = item.part.pivot;
      const slide = new THREE.Group();
      slide.position.set(x,y,z);
      const mesh = new THREE.Mesh(item.geometry,materialFor(item.part));
      mesh.position.set(-x,-y,-z);
      slide.add(mesh);
      // The traveling CMC has separate yaw, out-of-palm lift and axial roll.
      const basePivot = manifest.thumb_mount.thumb_base_pivot;
      const opposition = new THREE.Group();
      opposition.position.set(basePivot[0]-x,basePivot[1]-y,basePivot[2]-z);
      const yaw = new THREE.Group();
      opposition.add(yaw);
      const lift = new THREE.Group();
      yaw.add(lift);
      const roll = new THREE.Group();
      lift.add(roll);
      slide.add(opposition);
      hand.add(slide);
      thumbMount={slide,opposition,yaw,lift,roll,rollAngle:0,railX:x,slideAmount:0};
      parent=roll;
      previousPivot=basePivot;
    }
    rig[finger] = [];
    for (const section of sections) {
      const item = loaded.find(x => x.part.finger === finger && x.part.section === section);
      if (!item) throw new Error('Missing ' + finger + ' ' + section);
      const pivot = item.part.pivot;
      const hinge = new THREE.Group();
      hinge.position.set(pivot[0]-previousPivot[0], pivot[1]-previousPivot[1], pivot[2]-previousPivot[2]);
      // Splay turns around the hand's Z axis; curl happens at a separate child
      // so the two motions do not overwrite one another.
      const flex = new THREE.Group();
      hinge.add(flex);
      
      const mesh = new THREE.Mesh(item.geometry, materialFor(item.part));
      // The STL has assembled world coordinates. Offset it into its hinge group.
      mesh.position.set(-pivot[0], -pivot[1], -pivot[2]);
      flex.add(mesh);
      const start = new THREE.Object3D();
      hinge.add(start);
      const next = loaded.find(x => x.part.finger === finger &&
        x.part.section === (section === 'proximal' ? (finger==='thumb'?'distal':'middle') : 'distal'));
      const restAngle = finger === 'thumb' ? (manifest.thumb_mount.rest_angle_degrees*Math.PI/180) : 0;
      const direction = finger === 'thumb'
        ? [-Math.sin(restAngle),Math.cos(restAngle)] : [0,1];
      let length;
      if (section === 'distal') {
        const positions=item.geometry.attributes.position.array;
        length=0;
        for(let k=0;k<positions.length;k+=3)
          length=Math.max(length,(positions[k]-pivot[0])*direction[0]+(positions[k+1]-pivot[1])*direction[1]);
        length=Math.max(1,length-3);
      } else {
        length=next ? (next.part.pivot[0]-pivot[0])*direction[0]+
          (next.part.pivot[1]-pivot[1])*direction[1] : 30;
      }
      const end=new THREE.Object3D();
      end.position.set(direction[0]*length,direction[1]*length,0);
      flex.add(end);
      const radius={thumb:8.4,index:7.2,middle:7.5,ring:7.3,little:6.2}[finger];
      colliders.push({finger,section,start,end,radius: section==='distal' ? radius*.9 : radius});
      parent.add(hinge);
      rig[finger].push({hinge, flex, angle:0});
      parent = flex;
      previousPivot = pivot;
    }
    const last = rig[finger].at(-1);
    const endItem = loaded.find(x => x.part.finger === finger && x.part.section === 'distal');
    const restAngle = manifest.thumb_mount?.rest_angle_degrees ?? -79;
    const direction = finger === 'thumb'
      ? [-Math.sin(restAngle*Math.PI/180),Math.cos(restAngle*Math.PI/180)] : [0,1];
    const pivot = endItem.part.pivot;
    const data = endItem.geometry.attributes.position.array;
    let reach = 0;
    for (let i=0; i<data.length; i+=3) {
      reach = Math.max(reach,(data[i]-pivot[0])*direction[0]+(data[i+1]-pivot[1])*direction[1]);
    }
    const marker = new THREE.Object3D();
    marker.position.set(direction[0]*(reach-3),direction[1]*(reach-3),0);
    last.flex.add(marker);
    markers[finger] = marker;
    // The faint shell marks the outer fingertip surface used by the pinch solver.
    const envelope = new THREE.Mesh(new THREE.SphereGeometry(tipRadii[finger],16,12),
      new THREE.MeshBasicMaterial({color:0x76ddf4,wireframe:true,transparent:true,opacity:.12,depthWrite:false}));
    marker.add(envelope);
  }

  function resize() {
    const width = panel.clientWidth, height = panel.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const halfHeight = 140;
    const halfWidth = halfHeight * width / height;
    camera.left = -halfWidth; camera.right = halfWidth;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(panel);
  resize();
  function render() { advanceMechanicalTransition();renderer.render(scene, camera);requestAnimationFrame(render); }
  render();
  ready = true;
  collisionGuard = true;
  if (!video.srcObject) status.textContent = 'Hand model ready. Enable camera to animate it.';
}

function bend(a,b,c) {
  const v1 = [b.x-a.x, b.y-a.y, b.z-a.z];
  const v2 = [c.x-b.x, c.y-b.y, c.z-b.z];
  const n1 = Math.hypot(...v1), n2 = Math.hypot(...v2);
  if (!n1 || !n2) return 0;
  const dot = (v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2])/(n1*n2);
  return Math.acos(Math.max(-1,Math.min(1,dot)));
}
function clamp(v,min,max) { return Math.min(max,Math.max(min,v)); }
function smoothAngle(current,target,rate) {
  return current + Math.atan2(Math.sin(target-current),Math.cos(target-current))*rate;
}
let thumbAngle = -79*Math.PI/180;
const trackedThumbOpenAngle = -65*Math.PI/180;
function applyControl(finger,control,value) {
  const chain = rig[finger];
  const isThumb = finger === 'thumb';
  if (control === 'spread') {
    if (isThumb) thumbMount.yaw.rotation.z = clamp(value,-.15,2.08);
    else chain[0].hinge.rotation.z = clamp(value,-.4,.4);
  } else if (control === 'slide' && isThumb) {
    thumbMount.slideAmount = clamp(value,-16,16);
    thumbMount.slide.position.x = thumbMount.railX + thumbMount.slideAmount;
  } else if (control === 'opposition' && isThumb) {
    // The thumb's long axis starts mostly along X. Turning around X barely
    // lifted it, so rotate around the axis transverse to the thumb instead.
    thumbMount.lift.quaternion.setFromAxisAngle(
      new THREE.Vector3(Math.cos(thumbAngle),Math.sin(thumbAngle),0),clamp(value,0,1.25));
    thumbMount.liftAngle=clamp(value,0,1.25);
  } else if (control === 'roll' && isThumb) {
    thumbMount.rollAngle = clamp(value,-1.32,1.32);
    thumbMount.roll.quaternion.setFromAxisAngle(
      new THREE.Vector3(-Math.sin(thumbAngle),Math.cos(thumbAngle),0),thumbMount.rollAngle);
  } else {
    const index = Number(control);
    const joint = chain[index];
    joint.angle = clamp(value,0,isThumb ? (index===0 ? 1.18 : 1.40) :
      (index===0 ? 1.30 : 1.55));
    const axis = isThumb
      ? new THREE.Vector3(Math.cos(thumbAngle),Math.sin(thumbAngle),0)
      : new THREE.Vector3(1,0,0);
    joint.flex.quaternion.setFromAxisAngle(axis,isThumb ? -joint.angle : joint.angle);
  }
}
function controlValue(finger,control) {
  if (control==='spread') return finger==='thumb'
    ? thumbMount.yaw.rotation.z : rig[finger][0].hinge.rotation.z;
  if (control==='slide') return thumbMount.slideAmount;
  if (control==='opposition') return thumbMount.liftAngle || 0;
  if (control==='roll') return thumbMount.rollAngle;
  return rig[finger][Number(control)].angle;
}
function segmentGap(a,b,c,d) {
  const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c);
  const A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w);
  const denominator=A*C-B*B;
  let s=denominator>1e-8 ? clamp((B*E-C*D)/denominator,0,1) : 0;
  let t=clamp((B*s+E)/(C||1),0,1);
  s=clamp((B*t-D)/(A||1),0,1);
  t=clamp((B*s+E)/(C||1),0,1);
  return w.addScaledVector(u,s).addScaledVector(v,-t).length();
}
function collisionMargins() {
  root.updateMatrixWorld(true);
  const links=colliders.map(c=>({
    ...c,a:c.start.getWorldPosition(new THREE.Vector3()),
    b:c.end.getWorldPosition(new THREE.Vector3())
  }));
  const margins={};
  for(let i=0;i<links.length;i++) for(let j=i+1;j<links.length;j++) {
    const a=links[i],b=links[j];
    if(a.finger===b.finger)continue;
    margins[`${i}:${j}`]=segmentGap(a.a,a.b,b.a,b.b)-a.radius-b.radius;
  }
  for(const [index,link] of links.entries()) {
    const from=hand.worldToLocal(link.a.clone()),to=hand.worldToLocal(link.b.clone());
    let palmGap=Infinity;
    for(const t of [.25,.5,.75,1]) {
      const p=from.clone().lerp(to,t),y=p.y;
      if(y<-16||y>75)continue;
      const width=y<0 ? 29+(y+16)*.55 : y<38 ? 38+y*.23 : 47-(y-38)*.29;
      if(Math.abs(p.x)>width-link.radius*.45)continue;
      // Links enter the palm only when they cross its exterior shell.
      palmGap=Math.min(palmGap,Math.abs(p.z)-9.5-link.radius);
    }
    margins[`palm:${index}`]=palmGap;
  }
  return margins;
}
function poseClearance() {return Math.min(...Object.values(collisionMargins()));}
function marginsAllow(before,after) {
  return Object.keys(after).every(key=>after[key]>=-.05 ||
    (before[key]<-.05 && after[key]>=before[key]));
}
function setControl(finger,control,value) {
  if(!collisionGuard) {applyControl(finger,control,value);return;}
  const original=controlValue(finger,control);
  if(Math.abs(original-value)<1e-5)return;
  const stepLimit=control==='slide' ? 2 : .12;
  const steps=Math.ceil(Math.abs(value-original)/stepLimit);
  for(let step=1;step<=steps;step++) {
    const current=controlValue(finger,control);
    const before=collisionMargins();
    applyControl(finger,control,original+(value-original)*step/steps);
    const end=controlValue(finger,control);
    if(marginsAllow(before,collisionMargins()))continue;
    applyControl(finger,control,current);
    let safe=current,blocked=end;
    for(let i=0;i<10;i++) {
      const middle=(safe+blocked)/2;
      applyControl(finger,control,middle);
      if(marginsAllow(before,collisionMargins()))safe=middle;
      else blocked=middle;
    }
    applyControl(finger,control,safe);
    break;
  }
}
function tipPosition(finger) {
  root.updateMatrixWorld(true);
  return markers[finger].getWorldPosition(new THREE.Vector3());
}
function contactCandidate(points,world) {
  const p=world?.length===21 ? world : points;
  const palm=Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y,p[5].z-p[17].z);
  if (palm<1e-5) return null;
  let closest=null;
  for (const [finger,indices] of Object.entries(fingerLandmarks)) {
    if (finger==='thumb') continue;
    const tip=p[indices[3]],thumb=p[4];
    const distance=Math.hypot(tip.x-thumb.x,tip.y-thumb.y,tip.z-thumb.z)/palm;
    if (!closest || distance<closest.distance) closest={finger,distance};
  }
  return closest?.distance<.35 ? closest : null;
}
function thumbPalmOverlap(points) {
  // Use the wrist-to-index edge as the thumb-side boundary of the palm.
  // Signed penetration across it is independent of thumb splay and hand roll.
  const wrist=points[0],index=points[5],little=points[17];
  const edgeX=index.x-wrist.x,edgeY=index.y-wrist.y;
  const width=edgeX*(little.y-wrist.y)-edgeY*(little.x-wrist.x);
  const lengthSq=edgeX*edgeX+edgeY*edgeY;
  if(Math.abs(width)<1e-6 || lengthSq<1e-6)return 0;
  let overlap=0;
  for(const id of [2,3,4]) {
    const q=points[id],dx=q.x-wrist.x,dy=q.y-wrist.y;
    const along=(dx*edgeX+dy*edgeY)/lengthSq;
    if(along<.05 || along>1.08)continue;
    overlap=Math.max(overlap,(edgeX*dy-edgeY*dx)/width);
  }
  return clamp(overlap,0,1);
}
function fingerPairGap(first,second) {
  root.updateMatrixWorld(true);
  let gap=Infinity;
  for(const a of colliders.filter(c=>c.finger===first))
    for(const b of colliders.filter(c=>c.finger===second))
      gap=Math.min(gap,segmentGap(
        a.start.getWorldPosition(new THREE.Vector3()),a.end.getWorldPosition(new THREE.Vector3()),
        b.start.getWorldPosition(new THREE.Vector3()),b.end.getWorldPosition(new THREE.Vector3()))
        -a.radius-b.radius);
  return gap;
}
const winningMove = {rock:'paper',paper:'scissors',scissors:'rock'};
let pendingGesture=null, pendingFrames=0, currentGesture=null;
const fingerNames=['index','middle','ring','little'];
const thumbControls=['slide','opposition','spread','roll','0','1'];
const neutralThumb={slide:-16,opposition:.25,spread:2.05,roll:0,0:0,1:0};
const rockThumb={slide:-16,opposition:.92,spread:.23,roll:0,0:.66,1:.75};
function capturePose() {
  const pose={};
  for(const finger of fingerNames) {
    pose[finger]={spread:controlValue(finger,'spread')};
    for(let i=0;i<3;i++)pose[finger][i]=controlValue(finger,String(i));
  }
  pose.thumb={};
  for(const control of thumbControls)pose.thumb[control]=controlValue('thumb',control);
  return pose;
}
function targetPose(rock) {
  const pose={};
  for(const finger of fingerNames)
    pose[finger]={spread:0,0:rock?1.2:0,1:rock?1.3:0,2:rock?1:0};
  pose.thumb={...(rock?rockThumb:neutralThumb)};
  return pose;
}
function beginMechanicalTransition(move) {
  mechanicalTransition={start:performance.now(),from:capturePose(),open:targetPose(false),
    end:targetPose(move==='rock'),rock:move==='rock'};
}
function advanceMechanicalTransition() {
  const motion=mechanicalTransition;
  if(!motion)return;
  const opening=clamp((performance.now()-motion.start)/18,0,1);
  const closing=clamp((performance.now()-motion.start-18)/32,0,1);
  const ease=t=>t*t*(3-2*t);
  // Move the physical joints through an open pose before curling into a fist.
  // Preset motion is applied together so contact stops cannot trap individual joints.
  const guard=collisionGuard;
  collisionGuard=false;
  try {
    for(const finger of [...fingerNames,'thumb']) {
      const controls=finger==='thumb'?thumbControls:['spread','0','1','2'];
      for(const control of controls) {
        const open=motion.from[finger][control]+(motion.open[finger][control]-motion.from[finger][control])*ease(opening);
        const value=open+(motion.end[finger][control]-open)*ease(closing);
        applyControl(finger,control,value);
      }
    }
  } finally {collisionGuard=guard;}
  if(opening===1 && closing===1)mechanicalTransition=null;
}
function resetGameHand() {
  mechanicalTransition=null;
  // Reset the whole rig together before a new counter. Moving each joint from
  // the old closed pose can lock against another finger's contact stop.
  const guard=collisionGuard;
  collisionGuard=false;
  try {
    for(const finger of ['index','middle','ring','little']) {
      applyControl(finger,'spread',0);
      for(let i=0;i<3;i++)applyControl(finger,String(i),0);
    }
    for(const [control,value] of Object.entries({slide:-16,opposition:.25,spread:2.05,roll:0,0:0,1:0}))
      applyControl('thumb',control,value);
  } finally {collisionGuard=guard;}
}
function recognizeGesture(points,world) {
  const p=world?.length===21 ? world : points;
  const extended={};const folded={};
  for(const finger of ['index','middle','ring','little']) {
    const [mcp,pip,dip,tip]=fingerLandmarks[finger];
    const length=Math.hypot(p[mcp].x-p[pip].x,p[mcp].y-p[pip].y,p[mcp].z-p[pip].z)+
      Math.hypot(p[pip].x-p[dip].x,p[pip].y-p[dip].y,p[pip].z-p[dip].z)+
      Math.hypot(p[dip].x-p[tip].x,p[dip].y-p[tip].y,p[dip].z-p[tip].z);
    if(length<1e-6)return null;
    const reach=Math.hypot(p[tip].x-p[mcp].x,p[tip].y-p[mcp].y,p[tip].z-p[mcp].z)/length;
    const pipBend=bend(p[mcp],p[pip],p[dip]);
    const dipBend=bend(p[pip],p[dip],p[tip]);
    extended[finger]=reach>.75 && pipBend<.55 && dipBend<.7;
    folded[finger]=reach<.72 || pipBend>.75;
  }
  if(Object.values(folded).every(Boolean))return 'rock';
  if(Object.values(extended).every(Boolean))return 'paper';
  if(extended.index && extended.middle && folded.ring && folded.little)return 'scissors';
  return null;
}
function showCounter(move) {
  if(move==='rock')return;
  const thumbPose=move==='paper'
    ? {slide:-16,opposition:.25,spread:2.05,roll:0,0:0,1:0}
    : {slide:-16,opposition:1,spread:.38,roll:0,0:.82,1:.55};
  for(const [control,target] of Object.entries(thumbPose)) {
    const current=controlValue('thumb',control);
    setControl('thumb',control,current+(target-current)*.3);
  }
  for(const finger of ['index','middle','ring','little']) {
    const open=move==='paper' || (move==='scissors' && (finger==='index'||finger==='middle'));
    const spread=move==='scissors' ? (finger==='index'?.23:finger==='middle'?-.22:0)
      : move==='paper' ? ({index:.32,middle:.09,ring:-.09,little:-.30}[finger]) : 0;
    const currentSpread=rig[finger][0].hinge.rotation.z;
    setControl(finger,'spread',currentSpread+(spread-currentSpread)*.28);
    for(let i=0;i<3;i++) {
      const joint=rig[finger][i];
      const target=open?0:[1.2,1.3,1.0][i];
      setControl(finger,String(i),joint.angle+(target-joint.angle)*.34);
    }
  }
}
function updateGame(points,world) {
  if(!ready)return 'Loading robotic hand…';
  const guess=recognizeGesture(points,world);
  if(guess===pendingGesture)pendingFrames++;
  else {pendingGesture=guess;pendingFrames=1;}
  if(guess && pendingFrames>=5 && currentGesture!==guess) {
    currentGesture=guess;
    beginMechanicalTransition(winningMove[guess]);
  }
  if(currentGesture) {
    const counter=winningMove[currentGesture];
    if(!mechanicalTransition)showCounter(counter);
    playerMove.textContent='You: '+currentGesture.toUpperCase();
    robotMove.textContent='Robot: '+counter.toUpperCase();
    return guess===currentGesture ? 'Robot plays '+counter+' to beat '+currentGesture+'.'
      : 'Hold rock, paper, or scissors clearly to change your move.';
  }
  return 'Show rock, paper, or scissors with your hand.';
}

function drawLandmarks(points) {
  ctx.clearRect(0,0,overlay.width,overlay.height);
  ctx.strokeStyle='#56dcff'; ctx.lineWidth=3;
  for (const [a,b] of connections) {
    ctx.beginPath();ctx.moveTo(points[a].x*overlay.width,points[a].y*overlay.height);
    ctx.lineTo(points[b].x*overlay.width,points[b].y*overlay.height);ctx.stroke();
  }
  ctx.fillStyle='#fff';
  for (const p of points) {
    ctx.beginPath();ctx.arc(p.x*overlay.width,p.y*overlay.height,4,0,Math.PI*2);ctx.fill();
  }
}

async function start() {
  button.disabled=true; status.textContent='Requesting camera access…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable. Open this site directly in Chrome or Safari.');
    // Keep this as the first awaited operation after the click.
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    video.srcObject=stream;
    await video.play();
    overlay.width=video.videoWidth; overlay.height=video.videoHeight;
    trackingCanvas.width=video.videoWidth;trackingCanvas.height=video.videoHeight;
    button.textContent='Camera active';
    status.textContent='Loading hand tracking…';
    await modelPromise;
    const visionModule = await import('./vendor/mediapipe/vision_bundle.mjs');
    const vision = await visionModule.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
    tracker = await visionModule.HandLandmarker.createFromOptions(vision,{
      baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},
      runningMode:'VIDEO',numHands:1
    });
    status.textContent='Show rock, paper, or scissors with your hand.';
    requestAnimationFrame(track);
  } catch(error) {
    console.error(error);
    if(video.srcObject) status.textContent='Camera works, but tracking could not load: '+(error.message||error.name);
    else {status.textContent='Camera access failed: '+(error.message||error.name);button.disabled=false;}
  }
}
function track() {
  if(video.readyState>=2 && video.currentTime!==lastFrame) {
    lastFrame=video.currentTime;
    try {
      // Match the mirrored selfie preview; the gesture classifier uses
      // finger bends and works with either hand.
      trackingContext.setTransform(-1,0,0,1,trackingCanvas.width,0);
      trackingContext.drawImage(video,0,0,trackingCanvas.width,trackingCanvas.height);
      const result=tracker.detectForVideo(trackingCanvas,performance.now());
      if(result.landmarks.length) {
        drawLandmarks(result.landmarks[0]);
        status.textContent=updateGame(result.landmarks[0],result.worldLandmarks?.[0]);
      } else {
        ctx.clearRect(0,0,overlay.width,overlay.height);
        if(currentGesture)resetGameHand();
        pendingGesture=null;pendingFrames=0;currentGesture=null;
        playerMove.textContent='Show your hand';robotMove.textContent='Waiting for your move';
        status.textContent='Show rock, paper, or scissors with your hand.';
      }
    } catch(error) {status.textContent='Tracking paused: '+error.message;console.error(error);return;}
  }
  requestAnimationFrame(track);
}
button.addEventListener('click',start);
const modelPromise=initializeModel().catch(error=>{
  console.error(error);status.textContent='Hand model could not load: '+(error.message||error.name);
  throw error;
});
