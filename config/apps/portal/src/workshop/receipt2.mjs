export function interpolateFrame(a,b,time,smooth){
 if(!smooth||!a||!b||!Number.isFinite(time)||b.t<=a.t)return a;
 const q=Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t)));
 return {...a,t:a.t+(b.t-a.t)*q,bodies:a.bodies.map(body=>{
  const next=b.bodies.find(other=>other.id===body.id);if(!next)return body;
  let turn=next.angle-body.angle;const expected=(body.omega+next.omega)*.5*(b.t-a.t);
  turn+=Math.floor((expected-turn)/(2*Math.PI)+.5)*(2*Math.PI);
  return {...body,x:body.x+(next.x-body.x)*q,y:body.y+(next.y-body.y)*q,angle:body.angle+turn*q,
   vx:body.vx+(next.vx-body.vx)*q,vy:body.vy+(next.vy-body.vy)*q,omega:body.omega+(next.omega-body.omega)*q};
 })};
}
export function frameAtTime(samples,time){
 if(!Array.isArray(samples)||!samples.length||samples.length>256||!Number.isFinite(time)||time<samples[0].t||time>samples.at(-1).t)return null;
 let index=0;while(index+1<samples.length&&samples[index+1].t<time)index++;
 const a=samples[index],b=samples[index+1];
 if(!b)return a;
 if(b.t<=a.t)return null;
 return interpolateFrame(a,b,time,true);
}
