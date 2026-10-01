// Read-only quasi-static estimator. Geometry is in mm; forces are in N.
// tau = axis dot ((point - pivot) cross force), the revolute-joint J^T F term.
// Reference: Modern Robotics, 5.2, Statics of Open Chains.
export function createLoadEstimator(THREE,assembly,{totalMass=.85}={}){
  const g=9.80665,legs=Object.values(assembly.legs);
  const origin=o=>o.getWorldPosition(new THREE.Vector3());
  const axis=(o,v)=>new THREE.Vector3(...v).transformDirection(o.matrixWorld);
  const moment=(pivot,direction,point,force)=>new THREE.Vector3().subVectors(point,pivot).multiplyScalar(.001).cross(force).dot(direction);
  function footPoint(l){
    const vertices=l.supportVertices||l.lower.geometry.attributes.position.array;
    const e=l.lower.matrixWorld.elements;
    let min=Infinity;
    for(let i=0;i<vertices.length;i+=3)min=Math.min(min,e[1]*vertices[i]+e[5]*vertices[i+1]+e[9]*vertices[i+2]+e[13]);
    const p=new THREE.Vector3();let count=0;
    // Approximate pressure centre on the visible sole's lowest contact band.
    for(let i=0;i<vertices.length;i+=3){
      const x=vertices[i],y=vertices[i+1],z=vertices[i+2];
      const worldY=e[1]*x+e[5]*y+e[9]*z+e[13];
      if(worldY<=min+.15){p.add(new THREE.Vector3(e[0]*x+e[4]*y+e[8]*z+e[12],worldY,e[2]*x+e[6]*y+e[10]*z+e[14]));count++;}
    }
    return p.divideScalar(count||1);
  }
  return {sample(){
    assembly.root.updateMatrixWorld(true);
    const count=legs.filter(l=>l.isStance).length;
    return {totalMass,supportCount:count,legs:legs.map(l=>{
      const pivots=[origin(l.side),origin(l.hip),origin(l.knee)];
      const axes=[axis(l.side,[1,0,0]),axis(l.hip,[0,1,0]),axis(l.knee,[0,1,0])];
      const foot=footPoint(l),supportKg=l.isStance&&count?totalMass/count:0;
      // Estimated non-overlapping moving groups: hip carrier/servo .03 kg,
      // upper leg/knee servo .06 kg, lower leg/foot .03 kg. These are already
      // included in totalMass, not added to the robot's ground reaction.
      const masses=[.03,.06,.03],centres=[
        pivots[0].clone().lerp(pivots[1],.5),
        pivots[1].clone().lerp(pivots[2],.5),
        pivots[2].clone().lerp(foot,.5)
      ];
      return {name:l.name,stance:l.isStance,supportKg,joints:pivots.map((pivot,j)=>{
        const groundMoment=moment(pivot,axes[j],foot,new THREE.Vector3(0,supportKg*g,0));
        let gravityMoment=0;
        for(let k=j;k<3;k++)gravityMoment+=moment(pivot,axes[j],centres[k],new THREE.Vector3(0,-masses[k]*g,0));
        const signedNm=-(groundMoment+gravityMoment),torqueNm=Math.abs(signedNm);
        const armMm=Math.abs(moment(pivot,axes[j],foot,new THREE.Vector3(0,1,0)))*1000;
        return {supportKg,distalKg:masses.slice(j).reduce((a,b)=>a+b,0),armMm,signedNm,torqueNm,torqueKgCm:torqueNm/.0980665};
      })};
    })};
  }};
}
