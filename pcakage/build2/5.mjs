import {BODY_RADIUS,clamp} from './4.mjs';
export function createFlight(){let enabled=false,lastTap=-Infinity,lastForward=-Infinity,fast=false;return{setUnlocked(value){enabled=!!value;},get unlocked(){return enabled;},get fast(){return fast;},forwardTap(time){if(!enabled||!Number.isFinite(time))return;fast=time-lastForward>=0&&time-lastForward<=290;lastForward=time;},releaseForward(){fast=false;},tap(player,time){if(!enabled||!Number.isFinite(time))return false;const double=time-lastTap>=0&&time-lastTap<=290;lastTap=double?-Infinity:time;if(!double)return false;player.flying=!player.flying;player.vy=0;player.flightVX=player.flightVZ=0;player.grounded=false;return true;},resetTap(){lastTap=lastForward=-Infinity;fast=false;}};}
export function stepFlight(p,input,dt,ground,blocked,limit=6000){
 dt=clamp(Number.isFinite(dt)?dt:0,0,.1);const normal=Math.max(1,Math.hypot(input.forward||0,input.strafe||0)),sin=Math.sin(input.yaw||0),cos=Math.cos(input.yaw||0),speed=input.fast?96:32;
 const fx=((input.strafe||0)*cos-(input.forward||0)*sin)/normal*speed,fz=(-(input.forward||0)*cos-(input.strafe||0)*sin)/normal*speed,t=1-Math.exp(-dt*13);
 p.flightVX=(p.flightVX||0)+(fx-(p.flightVX||0))*t;p.flightVZ=(p.flightVZ||0)+(fz-(p.flightVZ||0))*t;
 const dy=((input.up?1:0)-(input.down?1:0))*(input.fast?40:20)*dt;
 const steps=Math.max(1,Math.ceil(Math.max(Math.hypot(p.flightVX,p.flightVZ)*dt,Math.abs(dy))/.32));
 for(let i=0;i<steps;i++){const x=clamp(p.x+p.flightVX*dt/steps,-limit+2,limit-2),z=clamp(p.z+p.flightVZ*dt/steps,-limit+2,limit-2),y=clamp(p.y+dy/steps,-200,6200);
  if(!blocked(x,p.z,BODY_RADIUS,p.y)&&ground(x,p.z,p.y)<=p.y+.12)p.x=x;else p.flightVX=0;
  if(!blocked(p.x,z,BODY_RADIUS,p.y)&&ground(p.x,z,p.y)<=p.y+.12)p.z=z;else p.flightVZ=0;
  const floor=ground(p.x,p.z,p.y);
  if(input.down&&y<=floor+.025&&!blocked(p.x,p.z,BODY_RADIUS,floor)){p.y=floor;p.flying=false;p.grounded=true;p.flightVX=p.flightVZ=0;break;}
  if(!blocked(p.x,p.z,BODY_RADIUS,y))p.y=y;
  if(p.y<=floor+.025)p.y=floor;
 }
 p.vy=0;p.energy=1;if(p.flying)p.grounded=false;return p;
}
