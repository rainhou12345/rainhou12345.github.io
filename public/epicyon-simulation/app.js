import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createMotionController } from "./motion.mjs?v=22";
import { createLoadEstimator } from "./loads.mjs?v=19";
import { createTravelController } from "./travel.mjs?v=22";
import { createObstacleField } from "./obstacles.mjs?v=24";

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const legNames={frontLeft:"FRONT LEFT",frontRight:"FRONT RIGHT",rearLeft:"REAR LEFT",rearRight:"REAR RIGHT"};
$("#telemetryGrid").innerHTML=Object.entries(legNames).map(([key,label])=>`<article class="telemetry-card" id="telemetry-${key}"><h4>${label}</h4><div><span>J1</span><span>— kg</span><span>— kg·cm</span></div><div><span>J2</span><span>— kg</span><span>— kg·cm</span></div><div><span>J3</span><span>— kg</span><span>— kg·cm</span></div></article>`).join("");

const CAD={rollX:97.3,rollY:55.8,carrierOffsetX:21.2,carrierPitchY:55.9,kneeY:35.8,kneeZ:-60,jointZ:24,coverZ:56,headX:134,headZ:10,tailX:-89.1,tailZ:31.4};
const files=["main_lower_chassis","top_cover","head","hc_sr04_sensor_holder","tail","hip_bracket_left","hip_bracket_right","upper_leg_left","upper_leg_right","lower_leg_left","lower_leg_right"];
const loader=new STLLoader();
const geometries={};
await Promise.all(files.map(name=>new Promise((resolve,reject)=>loader.load("./assets/stl/"+name+".stl",g=>{g.computeVertexNormals();geometries[name]=g;resolve()},undefined,reject))));
$("#viewerLoading").style.display="none";

function material(color, opacity=1){return new THREE.MeshStandardMaterial({color,roughness:.52,metalness:.08,transparent:opacity<1,opacity,side:THREE.DoubleSide})}
const colors={body:0xd8e6ee,hip:0x257fb5,upper:0x2ee8ff,lower:0x233747,detail:0x12202d,tail:0x4168ff};
function mesh(name,mat){const m=new THREE.Mesh(geometries[name],mat);m.castShadow=true;m.receiveShadow=true;return m}
function createJointTriad(length=48){
  const guide=new THREE.Group(),radius=1.35,tip=4.2,shaftLength=length-tip;
  const axes=[
    {color:0xff4966,rotate:m=>m.rotation.z=-Math.PI/2,place:(m,v)=>m.position.x=v},
    {color:0x55f09b,rotate:()=>{},place:(m,v)=>m.position.y=v},
    {color:0x49a7ff,rotate:m=>m.rotation.x=Math.PI/2,place:(m,v)=>m.position.z=v}
  ];
  axes.forEach(({color,rotate,place})=>{
    const mat=new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:.98});
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,shaftLength,14),mat);
    const arrow=new THREE.Mesh(new THREE.ConeGeometry(3.2,tip,16),mat);
    rotate(shaft);rotate(arrow);place(shaft,shaftLength/2);place(arrow,length-tip/2);
    shaft.renderOrder=20;arrow.renderOrder=20;guide.add(shaft,arrow);
  });
  const center=new THREE.Mesh(new THREE.SphereGeometry(3.25,16,12),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false}));
  center.renderOrder=21;guide.add(center);guide.userData.jointAxisGuide=true;guide.visible=false;
  return guide;
}
function buildAssembly(interactive=false){
  const root=new THREE.Group(),cadRoot=new THREE.Group();root.rotation.order="YXZ";cadRoot.rotation.x=-Math.PI/2;root.add(cadRoot);
  const mats={body:material(colors.body),hip:material(colors.hip),upper:material(colors.upper),lower:material(colors.lower),detail:material(colors.detail),tail:material(colors.tail)};
  const chassis=mesh("main_lower_chassis",mats.body),cover=mesh("top_cover",mats.body),head=mesh("head",mats.body),sensor=mesh("hc_sr04_sensor_holder",mats.detail),tail=mesh("tail",mats.tail);
  cadRoot.add(chassis);cover.position.z=CAD.coverZ;cadRoot.add(cover);head.position.set(CAD.headX,0,CAD.headZ);cadRoot.add(head);sensor.position.set(CAD.headX+13,0,CAD.headZ+17);cadRoot.add(sensor);
  const tailJoint=new THREE.Group();tailJoint.position.set(CAD.tailX,0,CAD.tailZ);tail.rotation.z=Math.PI;tailJoint.add(tail);cadRoot.add(tailJoint);
  const legs={}; const servoMarkers=[];
  const servoBodyMaterial=material(0xff9c42,.32),servoBossMaterial=material(0xffc16c,.55);
  function servoReference(parent,size,position,bossPosition,bossAxis="z"){
    const marker=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(...size),servoBodyMaterial);
    const boss=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.1,4,18),servoBossMaterial);
    if(bossAxis==="x")boss.rotation.z=Math.PI/2;
    else if(bossAxis==="z")boss.rotation.x=Math.PI/2;
    body.position.set(...position);boss.position.set(...bossPosition);
    marker.add(body,boss);marker.visible=false;parent.add(marker);servoMarkers.push(marker);
    return marker;
  }
  function leg(name,sx,sy){
    const side=new THREE.Group();side.position.set(sx*(CAD.rollX+CAD.carrierOffsetX),sy*CAD.rollY,CAD.jointZ);
    side.add(mesh(sy>0?"hip_bracket_left":"hip_bracket_right",mats.hip));
    const liftAxis=createJointTriad(52);liftAxis.position.set(sx*(CAD.rollX+13.75),sy*CAD.rollY,CAD.jointZ);cadRoot.add(liftAxis);
    servoReference(side,[23,24.5,12.5],[-5.5,sy*CAD.kneeY,0],[0,sy*CAD.kneeY,0],"y");
    // J2 rotates at the upper-leg horn / hip-carrier interface, not at the
    // centre of the pitch-servo case.  The child offsets preserve the exact
    // neutral STL assembly while moving the true kinematic pivot outward.
    const hip=new THREE.Group();hip.position.set(0,sy*CAD.carrierPitchY,0);side.add(hip);
    const upper=mesh(sy>0?"upper_leg_left":"upper_leg_right",mats.upper);upper.position.set(0,0,-30);
    const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2),qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);upper.quaternion.copy(qY).multiply(qX);hip.add(upper);
    servoReference(upper,[23,12.5,24.5],[24.5,0,0],[30,0,sy*14.25],"z");
    const knee=new THREE.Group();knee.position.set(0,sy*(CAD.kneeY-CAD.carrierPitchY),CAD.kneeZ);hip.add(knee);
    const lower=mesh(sy>0?"lower_leg_left":"lower_leg_right",mats.lower);lower.rotation.z=-Math.PI/2;knee.add(lower);cadRoot.add(side);
    legs[name]={name,side,hip,knee,upper,lower,sx,sy,isStance:true,commandedPlant:true,contactGap:0,telemetry:{forward:0,down:112,sideDegrees:4},meshes:[...side.children]};
    hip.add(createJointTriad(47));knee.add(createJointTriad(43));
  }
  leg("frontLeft",1,1);leg("frontRight",1,-1);leg("rearLeft",-1,1);leg("rearRight",-1,-1);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sy])=>{
    servoReference(cadRoot,[24.5,12.5,23],[sx*CAD.rollX,sy*CAD.rollY,18.5],[sx*(CAD.rollX+13.75),sy*CAD.rollY,24],"x");
  });
  servoReference(cadRoot,[23,12.5,24.5],[CAD.tailX,0,12.25],[CAD.tailX,0,27.2],"z");
  const com=new THREE.Mesh(new THREE.SphereGeometry(5,20,12),material(0xff4f6d));com.position.set(0,0,28);com.visible=false;cadRoot.add(com);
  const bodyMeshes=[chassis,cover,head];
  return {root,cadRoot,legs,tailJoint,mats,bodyMeshes,servoMarkers,com};
}
function solveIK(forward,down){const a=60,b=72.778,d2=forward*forward+down*down,c=THREE.MathUtils.clamp((d2-a*a-b*b)/(2*a*b),-.985,.985),k=-Math.acos(c),h=Math.atan2(forward,down)-Math.atan2(b*Math.sin(k),a+b*Math.cos(k));return {h,k}}
function pose(assembly,forward=0,down=112,sideDeg=4,smooth=1){
  const sol=solveIK(forward,down);
  Object.values(assembly.legs).forEach(l=>{l.isStance=true;l.commandedPlant=true;l.telemetry={forward,down,sideDegrees:sideDeg};l.side.rotation.x+=(l.sy*THREE.MathUtils.degToRad(sideDeg)-l.side.rotation.x)*smooth;l.hip.rotation.y+=(sol.h-l.hip.rotation.y)*smooth;l.knee.rotation.y+=(sol.k-l.knee.rotation.y)*smooth});
}

function createView(canvas,assembly,hero=false,withGround=true){
  const compactViewport=matchMedia('(max-width: 700px)').matches;
  const ground=[];
  const scene=new THREE.Scene();scene.background=new THREE.Color(hero?0x050c12:0x03080d);scene.add(assembly.root);
  scene.add(new THREE.HemisphereLight(0xbfefff,0x07101a,2.1));const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(95,430,130);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-360,right:360,top:360,bottom:-360,near:1,far:1200});key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-.0003;key.shadow.normalBias=0;scene.add(key);const rim=new THREE.DirectionalLight(0x2ee8ff,1.8);rim.position.set(-180,100,-220);scene.add(rim);
  if(withGround){
    const floorExtent=hero?2600:12000;
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(floorExtent,floorExtent),new THREE.MeshStandardMaterial({color:0x2ee8ff,transparent:true,opacity:.10,roughness:1,metalness:0,side:THREE.DoubleSide,depthWrite:false}));
    plane.rotation.x=-Math.PI/2;plane.position.y=0;plane.receiveShadow=true;scene.add(plane);
    ground.push(plane);
    const shadowPlane=new THREE.Mesh(new THREE.PlaneGeometry(floorExtent,floorExtent),new THREE.ShadowMaterial({color:0x000000,opacity:.22,transparent:true}));
    shadowPlane.rotation.x=-Math.PI/2;shadowPlane.position.y=.01;shadowPlane.receiveShadow=true;scene.add(shadowPlane);
    ground.push(shadowPlane);
    const grid=new THREE.GridHelper(1500,60,hero?0x39dff3:0x326477,hero?0x17495b:0x326477);grid.material.transparent=true;grid.material.opacity=hero?.22:.30;grid.position.y=.025;scene.add(grid);
    ground.push(grid);
  }
  const camera=new THREE.PerspectiveCamera(hero?34:38,1,.1,4000);camera.position.set(hero?500:455,hero?300:270,hero?575:510);const renderer=new THREE.WebGLRenderer({canvas,antialias:!compactViewport,alpha:true,powerPreference:compactViewport?'low-power':'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,compactViewport?1.25:2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=!compactViewport;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=150;controls.maxDistance=900;controls.target.set(0,10,0);
  const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(canvas);resize();
  scene.add(key.target,rim.target);
  return {scene,camera,renderer,controls,home:camera.position.clone(),target:controls.target.clone(),hero,ground,lights:[{light:key,base:key.position.clone()},{light:rim,base:rim.position.clone()}]};
}
const labAssembly=buildAssembly(true);pose(labAssembly);
const motion=createMotionController(THREE,labAssembly);
const liveLoads=createLoadEstimator(THREE,labAssembly);
$("#liveTelemetry>p").textContent="kg = ground load carried; airborne feet carry 0 kg. Torque includes estimated leg self-weight and actual pose. Equal support sharing, quasi-static only; excludes acceleration, impacts and friction.";
const labView=createView($("#labCanvas"),labAssembly,false);
const travel=createTravelController(THREE,labAssembly),cameraFollow=new THREE.Vector3();
const obstacleCone=await loader.loadAsync('./assets/obstacles/traffic-cone.stl').catch(()=>null);
const obstacles=createObstacleField(THREE,labView.scene,labAssembly,obstacleCone);
const objectsButton=document.createElement('button');objectsButton.textContent='Objects';objectsButton.dataset.tool='objects';objectsButton.setAttribute('aria-pressed','false');
$("[data-tool=resetView]").after(objectsButton);
const sensorStatus=document.createElement('div');sensorStatus.className='sensor-status';sensorStatus.hidden=true;
sensorStatus.innerHTML='<strong role="status" aria-live="polite">Sensor clear</strong><span>Illustrative forward sensor · steer manually</span>';
$(".model-stage").append(sensorStatus);
let lastSensor=0;
function updateSensor(t,force=false){
  if(!force&&t-lastSensor<100)return;lastSensor=t;
  const reading=obstacles.sense();sensorStatus.hidden=!reading.enabled;sensorStatus.classList.toggle('detected',reading.warning);
  const message=reading.warning?'Obstacle detected — turn left or right':'Sensor clear';
  if(sensorStatus.firstElementChild.textContent!==message)sensorStatus.firstElementChild.textContent=message;
  sensorStatus.lastElementChild.textContent=reading.object?`${reading.object} · ${(reading.distanceMm/10).toFixed(0)} cm ahead · no auto-brake`:'Forward path clear · sensor demo · no auto-brake';
  if(motionDiagnostics)document.documentElement.dataset.obstacles=JSON.stringify(reading);
}
objectsButton.addEventListener('click',()=>{obstacles.setEnabled(!obstacles.enabled);objectsButton.classList.toggle('active',obstacles.enabled);objectsButton.setAttribute('aria-pressed',String(obstacles.enabled));updateSensor(performance.now(),true);});
let mode="stand",bodyHeight=112,lastMotionFrame=null;
const sliders={speed:["speedOut",v=>Number(v).toFixed(1)+"×"],length:["lengthOut",v=>v+" mm"],height:["heightOut",v=>v+" mm"],body:["bodyOut",v=>v+" mm"]};
Object.entries(sliders).forEach(([id,[out,fmt]])=>{$("#"+id+"Slider").addEventListener("input",e=>{const v=Number(e.target.value);$("#"+out).textContent=fmt(v);motion.setSettings({[id]:v});if(id==="body")bodyHeight=v;})});
function setMode(next){motion.setMode(next);mode=motion.mode;$$("[data-motion]").forEach(b=>b.classList.toggle("active",b.dataset.motion===mode));}
$$("[data-motion]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.motion)));
function updateLab(t){
  const dt=lastMotionFrame===null?0:Math.max(0,(t-lastMotionFrame)/1000);lastMotionFrame=t;
  travel.beginFrame();motion.update(dt);const position=travel.endFrame(motion.snapshot());
  obstacles.update(dt);
  const nextFollow=cameraFollow.clone().lerp(position,1-Math.exp(-5*Math.min(dt,.1)));
  const cameraDelta=nextFollow.clone().sub(cameraFollow);cameraFollow.copy(nextFollow);
  labView.camera.position.add(cameraDelta);labView.controls.target.add(cameraDelta);
  // Recycle the floor bounds in whole grid cells: grid lines stay world-fixed.
  labView.ground.forEach(o=>{o.position.x=Math.round(position.x/25)*25;o.position.z=Math.round(position.z/25)*25;});
  labView.lights.forEach(({light,base})=>{light.position.copy(base).add(position);light.target.position.copy(position);});
}

let lastTelemetry=0;
function updateLiveTelemetry(t){
  if(t-lastTelemetry<90)return;lastTelemetry=t;
  const motionState=motion.snapshot(),limited=motionState.appliedStepHeight<motionState.requestedStepHeight-.5;
  $("#heightOut").textContent=limited?`${motionState.requestedStepHeight} → ${motionState.appliedStepHeight.toFixed(1)} mm`:motionState.requestedStepHeight+" mm";
  $("#heightOut").title=limited?"Applied step height is limited by clearance at this body height.":"Requested step height is within the preview workspace.";
  const loads=liveLoads.sample();
  $(".sim-warning").textContent=`${(travel.snapshot().distanceMm/1000).toFixed(2)} m TRAVEL · SIMULATION ONLY`;
  loads.legs.forEach(leg=>{
    const rows=$$(".telemetry-card div",$("#telemetry-"+leg.name));
    rows.forEach((row,i)=>{
      const joint=leg.joints[i],spans=$$("span",row);
      spans[1].textContent=joint.supportKg.toFixed(2)+" kg";
      spans[2].textContent=joint.torqueKgCm.toFixed(2)+" kg·cm";
      row.title=`${leg.stance?"Planted":"Airborne"} · ground-force lever arm ${joint.armMm.toFixed(1)} mm · downstream mass estimate ${joint.distalKg.toFixed(2)} kg · holding torque ${joint.torqueNm.toFixed(3)} N·m`;
    });
  });
  $(".telemetry-head b").textContent=loads.totalMass.toFixed(2)+" kg · "+loads.supportCount+" supporting leg"+(loads.supportCount===1?"":"s");
  if(motionDiagnostics)document.documentElement.dataset.loads=JSON.stringify(loads);
}
$("[data-tool=resetView]").addEventListener("click",()=>{cameraFollow.copy(travel.carrier.position);labView.camera.position.copy(labView.home).add(cameraFollow);labView.controls.target.copy(labView.target).add(cameraFollow);labView.controls.update()});
$("[data-tool=axes]").addEventListener("click",e=>{const active=e.currentTarget.classList.toggle("active");labAssembly.cadRoot.traverse(o=>{if(o.userData.jointAxisGuide)o.visible=active})});
$("[data-tool=servos]").addEventListener("click",e=>{const active=e.currentTarget.classList.toggle("active");labAssembly.servoMarkers.forEach(marker=>marker.visible=active)});
$("[data-tool=com]").addEventListener("click",e=>{labAssembly.com.visible=e.currentTarget.classList.toggle("active")});
$("[data-tool=transparent]").addEventListener("click",e=>{const active=e.currentTarget.classList.toggle("active");labAssembly.bodyMeshes.forEach(m=>{m.material.transparent=active;m.material.opacity=active?.2:1;m.material.depthWrite=!active})});
$("#telemetryToggle").addEventListener("click",e=>{
  const collapsed=$("#liveTelemetry").classList.toggle("collapsed");
  e.currentTarget.textContent=collapsed?"+":"−";
  e.currentTarget.setAttribute("aria-expanded",String(!collapsed));
  e.currentTarget.setAttribute("aria-label",collapsed?"Expand live joint load panel":"Minimize live joint load panel");
});

const motionDiagnostics=new URLSearchParams(location.search).has("qa");
function animate(t){
  requestAnimationFrame(animate);updateLab(t);updateLiveTelemetry(t);updateSensor(t);
  if(motionDiagnostics){document.documentElement.dataset.kinematics=JSON.stringify(motion.snapshot());document.documentElement.dataset.travel=JSON.stringify(travel.snapshot());}
  labView.controls.update();
  labView.renderer.render(labView.scene,labView.camera);
}
animate(0);
