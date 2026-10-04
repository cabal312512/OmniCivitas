export const BODY_RADIUS=.48, EYE_HEIGHT=2.2;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createPlayer(x,z,ground){return{x,y:ground(x,z),z,vy:0,grounded:true,energy:1,health:1};}

// Small substeps keep sprinting and a delayed animation frame from tunnelling through walls.
export function stepPlayer(player,input,dt,ground,blocked,limit=6000){
 dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
 const moving=Math.hypot(input.forward||0,input.strafe||0),normal=Math.max(1,moving);
 const speed=input.sprint?58:9;
 const steps=Math.max(1,Math.ceil(dt/.012),Math.ceil(speed*dt/.24)),step=dt/steps;
 if(input.jump&&player.grounded){player.vy=10;player.grounded=false;}
 for(let n=0;n<steps;n++){
  const sin=Math.sin(input.yaw||0),cos=Math.cos(input.yaw||0),forward=(input.forward||0)/normal,strafe=(input.strafe||0)/normal;
  const dx=(strafe*cos-forward*sin)*speed*step,dz=(-forward*cos-strafe*sin)*speed*step;
  const x=clamp(player.x+dx,-limit+2,limit-2),z=clamp(player.z+dz,-limit+2,limit-2);
  if(!blocked(x,player.z,BODY_RADIUS,player.y)&&ground(x,player.z,player.y)-player.y<1.8)player.x=x;
  if(!blocked(player.x,z,BODY_RADIUS,player.y)&&ground(player.x,z,player.y)-player.y<1.8)player.z=z;
  player.vy-=25*step;player.y+=player.vy*step;
  const floor=ground(player.x,player.z,player.y);
  if(player.y<=floor){player.y=floor;player.vy=0;player.grounded=true;}else player.grounded=false;
 }
 // Kept for reading earlier saves; running no longer has a stamina constraint.
 player.energy=1;
 return player;
}

export function raySphere(origin,direction,center,radius){
 const x=origin.x-center.x,y=origin.y-center.y,z=origin.z-center.z;
 const b=x*direction.x+y*direction.y+z*direction.z,c=x*x+y*y+z*z-radius*radius,d=b*b-c;
 if(d<0)return null;const near=-b-Math.sqrt(d),far=-b+Math.sqrt(d);return far<0?null:Math.max(0,near);
}

export function createCycle(count=8){
 let found=new Set();return{add(id){const fresh=!found.has(id);found.add(id);return fresh;},get count(){return found.size;},get complete(){return found.size>=count;},values(){return [...found];},reset(){found=new Set();}};
}
