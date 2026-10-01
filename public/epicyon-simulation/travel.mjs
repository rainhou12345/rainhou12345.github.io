// Presentation-only odometry: keeps the proven joint controller untouched.
// A translation carrier is neutralized before IK and restored after it.
export function createTravelController(THREE,assembly){
  const carrier=new THREE.Group(),parent=assembly.root.parent;
  parent?.add(carrier);carrier.add(assembly.root);
  const position=new THREE.Vector3();let previous=null,distance=0,lastSlip=0;
  function sample(){
    assembly.root.updateWorldMatrix(true,true);
    return Object.values(assembly.legs).map(l=>({
      planted:l.isStance,
      point:l.pawPoint.clone().applyMatrix4(l.lower.matrixWorld)
    }));
  }
  return {
    carrier,
    beginFrame(){carrier.position.set(0,0,0);carrier.updateMatrixWorld(true);},
    endFrame(state){
      const current=sample(),delta=new THREE.Vector3();
      const moving=['walk','backward','trot','sprint','turnLeft','turnRight'].includes(state.mode);
      const pairs=previous?current.map((p,i)=>({p,old:previous[i]})).filter(({p,old})=>p.planted&&old.planted):[];
      if(moving&&pairs.length){
        for(const {p,old} of pairs)delta.add(old.point.clone().sub(p.point));
        delta.divideScalar(pairs.length);delta.y=0;
        // Least-squares stance displacement reduces aggregate horizontal slip.
        // Different fixed leg trajectories cannot all be perfectly pinned by
        // one body translation. Never reverse travel during a pose blend.
        const forward=new THREE.Vector3(Math.cos(state.heading),0,-Math.sin(state.heading)).multiplyScalar(state.mode==='backward'?-1:1);
        const along=delta.dot(forward);
        if(along<0)delta.addScaledVector(forward,-along);
        position.add(delta);distance+=delta.length();
      }
      lastSlip=pairs.length?pairs.reduce((sum,{p,old})=>{
        const d=p.point.clone().add(delta).sub(old.point);d.y=0;return sum+d.length();
      },0)/pairs.length:0;
      previous=current;
      carrier.position.copy(position);carrier.updateMatrixWorld(true);
      return position.clone();
    },
    snapshot(){return {x:position.x,z:position.z,distanceMm:distance,stanceSlipMm:lastSlip};}
  };
}
