// World props, low-friction planar contact, and an illustrative range sensor.
// Does not write to the robot, its joints, travel controller, or camera.
function hull(points){
  points.sort((a,b)=>a.x-b.x||a.z-b.z);
  const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  const lower=half(points),upper=half([...points].reverse());lower.pop();upper.pop();return lower.concat(upper);
}
// Minimum horizontal translation out of a convex footprint. Vertical overlap
// is checked separately: a raised paw must not push something beneath it.
function contact(a,b){
  if(a.maxY<=b.minY||b.maxY<=a.minY)return null;
  if(a.circle&&b.circle){
    const x=b.circle.x-a.circle.x,z=b.circle.z-a.circle.z,distance=Math.hypot(x,z);
    const depth=a.circle.radius+b.circle.radius-distance;
    return depth>0?{x:distance?x/distance:1,z:distance?z/distance:0,depth}:null;
  }
  const bounds=s=>(s.bounds??=[
    Math.min(...s.points.map(p=>p.x)),Math.max(...s.points.map(p=>p.x)),
    Math.min(...s.points.map(p=>p.z)),Math.max(...s.points.map(p=>p.z))]);
  const aa=bounds(a),bb=bounds(b);
  if(aa[1]<=bb[0]||bb[1]<=aa[0]||aa[3]<=bb[2]||bb[3]<=aa[2])return null;
  let best=null;
  for(const polygon of [a.points,b.points])for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],length=Math.hypot(q.x-p.x,q.z-p.z);
    if(length<1e-8)continue;
    const nx=-(q.z-p.z)/length,nz=(q.x-p.x)/length;
    const pa=a.points.map(v=>v.x*nx+v.z*nz),pb=b.points.map(v=>v.x*nx+v.z*nz);
    const amin=Math.min(...pa),amax=Math.max(...pa),bmin=Math.min(...pb),bmax=Math.max(...pb);
    if(amax<=bmin||bmax<=amin)return null;
    const plus=amax-bmin,minus=bmax-amin,sign=plus<minus?1:-1,depth=Math.min(plus,minus);
    if(!best||depth<best.depth)best={x:nx*sign,z:nz*sign,depth};
  }
  return best;
}
export function createObstacleField(THREE,scene,assembly,coneGeometry=null){
  const world=new THREE.Group();world.name='Sliding everyday objects';world.visible=false;scene.add(world);
  const tiles=new Map(),tileSize=1800,anchor=new THREE.Vector3();let enabled=false,initialized=false,heading=0,warning=false;
  const raycaster=new THREE.Raycaster(),sensorPoint=new THREE.Vector3(162,0,27);
  // Only real STL components, never joint axes, servo guides or the whole
  // assembly's oversized bounding box. Motion remains strictly read-only.
  const robotMeshes=[...assembly.bodyMeshes,
    ...assembly.cadRoot.children.filter(m=>m.isMesh&&!assembly.bodyMeshes.includes(m)&&m!==assembly.com),
    ...assembly.tailJoint.children.filter(m=>m.isMesh),
    ...Object.values(assembly.legs).flatMap(l=>[...l.side.children.filter(m=>m.isMesh),l.upper,l.lower])];
  const previous=new Map();
  function footprint(mesh){
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    const b=mesh.geometry.boundingBox,points=[];
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));
    return {points:hull(points),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
  }
  function propFootprint(object){
    // Parcel is a box; round objects use their circular base, not a square
    // envelope that would appear to collide before the surfaces meet.
    if(object.userData.label==='Parcel')return footprint(object.children[0]);
    const radius=object.userData.label==='Water bottle'?32.4:object.userData.label==='Drink can'?31:65;
    const height=object.userData.label==='Water bottle'?188:object.userData.label==='Drink can'?125:145;
    if(object.userData.label==='Traffic cone'){
      const points=[[-65,-65],[65,-65],[65,65],[-65,65]].map(([x,z])=>new THREE.Vector3(x,0,z).applyMatrix4(object.matrixWorld));
      return {points,minY:0,maxY:height};
    }
    return {points:Array.from({length:20},(_,i)=>({x:object.position.x+radius*Math.cos(i*Math.PI/10),z:object.position.z+radius*Math.sin(i*Math.PI/10)})),circle:{x:object.position.x,z:object.position.z,radius},minY:0,maxY:height};
  }
  const mats={box:new THREE.MeshStandardMaterial({color:0xba9470,roughness:.9}),tape:new THREE.MeshStandardMaterial({color:0xd8bd92,roughness:.7}),
    bottle:new THREE.MeshStandardMaterial({color:0x77aab3,roughness:.35}),label:new THREE.MeshStandardMaterial({color:0xd5e4da,roughness:.7}),
    cap:new THREE.MeshStandardMaterial({color:0x274c5c}),can:new THREE.MeshStandardMaterial({color:0xb15f6a,metalness:.35,roughness:.4}),
    metal:new THREE.MeshStandardMaterial({color:0xb6c7cc,metalness:.7,roughness:.3}),cone:new THREE.MeshStandardMaterial({color:0xdb8947,roughness:.8})};
  const templates=[];
  function part(group,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
  const parcel=new THREE.Group();parcel.userData.label='Parcel';
  part(parcel,new THREE.BoxGeometry(135,150,110),mats.box,0,75);
  part(parcel,new THREE.BoxGeometry(23,1,111),mats.tape,0,150.5);
  part(parcel,new THREE.BoxGeometry(23,150,1),mats.tape,0,75,55.5);templates.push(parcel);
  const bottle=new THREE.Group();bottle.userData.label='Water bottle';
  part(bottle,new THREE.CylinderGeometry(32,32,135,24),mats.bottle,0,67.5);
  part(bottle,new THREE.CylinderGeometry(13,32,35,24),mats.bottle,0,152.5);
  part(bottle,new THREE.CylinderGeometry(14,14,18,24),mats.cap,0,179);
  part(bottle,new THREE.CylinderGeometry(32.4,32.4,55,24),mats.label,0,75);templates.push(bottle);
  const can=new THREE.Group();can.userData.label='Drink can';
  part(can,new THREE.CylinderGeometry(31,31,116,28),mats.can,0,60);
  part(can,new THREE.CylinderGeometry(30,30,4,28),mats.metal,0,2);
  part(can,new THREE.CylinderGeometry(30,30,4,28),mats.metal,0,120);
  const tab=part(can,new THREE.TorusGeometry(7,2,6,16),mats.metal,0,123);tab.rotation.x=Math.PI/2;templates.push(can);
  const cone=new THREE.Group();cone.userData.label='Traffic cone';
  if(coneGeometry){
    const normalized=coneGeometry.clone();normalized.computeBoundingBox();const b=normalized.boundingBox;
    normalized.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);normalized.scale(65,65,65);normalized.computeVertexNormals();
    part(cone,normalized,mats.cone);
  }else{part(cone,new THREE.CylinderGeometry(8,58,135,24),mats.cone,0,72.5);part(cone,new THREE.BoxGeometry(130,10,130),mats.cone,0,5);}
  templates.push(cone);
  function createTile(tx,tz){
    const group=new THREE.Group();group.userData.tile=[tx,tz];
    const type=((tx+tz)%4+4)%4;
    const layouts=[[650,0,type],[1400,650,(type+1)%4]];
    for(const [x,z,type] of layouts){
      const object=templates[type].clone(true);
      const px=tx*tileSize+x,pz=tz*tileSize+z;
      object.position.set(anchor.x+Math.cos(heading)*px+Math.sin(heading)*pz,0,anchor.z-Math.sin(heading)*px+Math.cos(heading)*pz);
      object.rotation.y=heading+(type===0?.12:0);
      object.userData.velocity=new THREE.Vector3();
      object.traverse(child=>{if(child.isMesh)child.userData.obstacleName=object.userData.label;});
      group.add(object);
    }
    world.add(group);tiles.set(`${tx},${tz}`,group);
  }
  function refreshTiles(){
    const p=assembly.root.getWorldPosition(new THREE.Vector3()).sub(anchor);
    const x=Math.floor((Math.cos(heading)*p.x-Math.sin(heading)*p.z)/tileSize);
    const z=Math.floor((Math.sin(heading)*p.x+Math.cos(heading)*p.z)/tileSize);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(!tiles.has(`${x+dx},${z+dz}`))createTile(x+dx,z+dz);
    for(const [key,group] of tiles){const [tx,tz]=group.userData.tile;if((Math.abs(tx-x)>2||Math.abs(tz-z)>2)&&group.children.every(o=>o.position.distanceTo(assembly.root.getWorldPosition(new THREE.Vector3()))>tileSize*2)){world.remove(group);tiles.delete(key);}}
    world.updateMatrixWorld(true);
  }
  function update(elapsed){
    if(!enabled)return;
    const dt=Math.min(Math.max(elapsed,0),.05);if(!dt)return;
    assembly.root.updateWorldMatrix(true,true);refreshTiles();
    const shapes=robotMeshes.map(mesh=>{
      const shape=footprint(mesh),center=mesh.getWorldPosition(new THREE.Vector3()),old=previous.get(mesh);
      shape.velocity=old?center.clone().sub(old).divideScalar(dt):new THREE.Vector3();previous.set(mesh,center);return shape;
    });
    const objects=[...tiles.values()].flatMap(group=>group.children);
    function resolveRobot(object){
      const velocity=object.userData.velocity;
      let obstacleShape=propFootprint(object);
      for(const shape of shapes){
        const hit=contact(shape,obstacleShape);if(!hit)continue;
        object.position.x+=hit.x*(hit.depth+.02);object.position.z+=hit.z*(hit.depth+.02);
        const speed=Math.min(450,Math.max(0,shape.velocity.x*hit.x+shape.velocity.z*hit.z,hit.depth/dt));
        const relative=velocity.x*hit.x+velocity.z*hit.z;
        if(relative<speed){velocity.x+=hit.x*(speed-relative);velocity.z+=hit.z*(speed-relative);}
        if(velocity.length()>450)velocity.setLength(450);
        object.updateMatrixWorld(true);obstacleShape=propFootprint(object);
      }
    }
    // Small steps prevent fast-moving props crossing one another between
    // checks. Equal effective masses, low restitution, and no tangential
    // friction: a lightweight planar demonstration, not measured materials.
    const steps=Math.ceil(dt*120),step=dt/steps;
    for(let substep=0;substep<steps;substep++){
      const damping=Math.exp(-.65*step);
      for(const object of objects){
        const velocity=object.userData.velocity;
        object.position.addScaledVector(velocity,(1-damping)/.65);velocity.multiplyScalar(damping);
        object.position.y=0;object.updateMatrixWorld(true);
      }
      // Alternate robot and pair constraints so a pile can transmit a push
      // without the pair solver leaving the nearest prop inside the dog.
      for(let pass=0;pass<10;pass++){
        objects.forEach(resolveRobot);
        const footprints=objects.map(propFootprint);let touching=false;
        for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
          const hit=contact(footprints[i],footprints[j]);if(!hit)continue;touching=true;
          const a=objects[i],b=objects[j],va=a.userData.velocity,vb=b.userData.velocity;
          const correction=(hit.depth+.002)/2;
          a.position.x-=hit.x*correction;a.position.z-=hit.z*correction;
          b.position.x+=hit.x*correction;b.position.z+=hit.z*correction;
          const closing=(vb.x-va.x)*hit.x+(vb.z-va.z)*hit.z;
          if(closing<0){
            // Suppress tiny repeated bounces in resting contact stacks.
            const restitution=closing< -5?.15:0,impulse=-(1+restitution)*closing/2;
            va.x-=impulse*hit.x;va.z-=impulse*hit.z;
            vb.x+=impulse*hit.x;vb.z+=impulse*hit.z;
          }
          a.updateMatrixWorld(true);b.updateMatrixWorld(true);
          footprints[i]=propFootprint(a);footprints[j]=propFootprint(b);
        }
        if(!touching&&pass>=2)break;
      }
    }
    for(const object of objects){
      const velocity=object.userData.velocity;if(velocity.lengthSq()<.25)velocity.set(0,0,0);
    }
  }
  function sense(){
    if(!enabled)return {enabled:false,warning:false,distanceMm:null,object:null};
    assembly.root.updateWorldMatrix(true,true);refreshTiles();
    const origin=sensorPoint.clone().applyMatrix4(assembly.cadRoot.matrixWorld);
    let nearest=null;
    // A small ray fan approximates a cone (24° horizontal, 16° vertical).
    // Illustrative 450 mm range, 260 mm warning / 320 mm release hysteresis;
    // these are demo settings, not calibrated HC-SR04 performance claims.
    for(const yaw of [-12,-6,0,6,12])for(const pitch of [-8,0,8]){
      const y=THREE.MathUtils.degToRad(yaw),p=THREE.MathUtils.degToRad(pitch);
      const direction=new THREE.Vector3(Math.cos(y)*Math.cos(p),Math.sin(y)*Math.cos(p),Math.sin(p)).transformDirection(assembly.cadRoot.matrixWorld);
      raycaster.set(origin,direction);raycaster.near=0;raycaster.far=450;
      const hit=raycaster.intersectObjects(world.children,true)[0];
      if(hit&&(!nearest||hit.distance<nearest.distance))nearest=hit;
    }
    warning=!!nearest&&nearest.distance<=(warning?320:260);
    return {enabled:true,warning,distanceMm:nearest?.distance??null,object:nearest?.object.userData.obstacleName??null};
  }
  return {world,sense,update,setEnabled(value){
    enabled=!!value;world.visible=enabled;warning=false;
    previous.clear();
    if(enabled&&!initialized){
      assembly.root.updateWorldMatrix(true,true);anchor.copy(assembly.root.getWorldPosition(new THREE.Vector3()));anchor.y=0;
      const direction=new THREE.Vector3(1,0,0).transformDirection(assembly.cadRoot.matrixWorld);heading=Math.atan2(-direction.z,direction.x);
      initialized=true;
    }
    return sense();
  },get enabled(){return enabled;}};
}
