import {riverShapeAt} from '../../../../../pinia/j7.mjs';
export const angleDelta=(target,current)=>Math.atan2(Math.sin(target-current),Math.cos(target-current));
export function stepGiantMotion(a,player,time,dt,world,protectedPlayer=false){
 const range=Math.hypot(a.x-player.x,a.z-player.z);
 const floor=a.floor??world.groundAt(a.x,a.z);a.floor=floor;
 const height=Math.abs(player.y-floor);
 a.engaged=a.role.hostile&&!protectedPlayer&&range<(a.engaged?330:260)&&height<(a.engaged?65:45);
 const targetX=a.engaged?player.x:a.homeX+Math.cos(time*.028+a.phase)*150;
 const targetZ=a.engaged?player.z:a.homeZ+Math.sin(time*.035+a.phase)*180;
 const dx=targetX-a.x,dz=targetZ-a.z,d=Math.hypot(dx,dz);
 let desired=a.charge?.angle??(d>.5?Math.atan2(dx,dz):a.heading);
 if(!a.charge&&time<a.avoidUntil)desired=a.avoidHeading;
 const turn=Math.max(-dt*.72,Math.min(dt*.72,angleDelta(desired,a.heading)));
 a.heading+=turn;
 const speed=a.charge?a.role.speed*3.6:a.engaged&&d<45?0:Math.min(a.role.speed,d*.4);
 const travel=speed*dt,oldX=a.x,oldZ=a.z;
 if(travel>0){const x=a.x+Math.sin(a.heading)*travel,z=a.z+Math.cos(a.heading)*travel;
  // Flying creatures check their own altitude, rather than the buildings below.
  const y=a.role.flying?a.y:a.floor;
  const clear=Math.hypot(x-a.homeX,z-a.homeZ)<340&&!world.isBlocked(x,z,18,y)&&(a.role.flying||riverShapeAt(x,z).mask<.5);
  if(clear){a.x=x;a.z=z;a.walked+=travel;}
  else if(time>=a.avoidUntil){a.avoidHeading=a.heading+a.avoidSide*Math.PI*.62;a.avoidUntil=time+1.5;if(a.charge)a.charge.until=time;}
 }
 if(range<400||Math.hypot(a.x-a.floorX,a.z-a.floorZ)>2){a.floor=world.groundAt(a.x,a.z);a.floorX=a.x;a.floorZ=a.z;}
 const desiredY=a.floor+a.role.height*a.scale+(a.role.flying?Math.sin(time*.35+a.phase)*12:0);
 a.y+=(desiredY-a.y)*(1-Math.exp(-dt*4));
 return{range,engaged:a.engaged,oldX,oldZ};
}
