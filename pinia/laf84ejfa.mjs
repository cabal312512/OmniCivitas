import {CITIES,cityHalf,routeDistanceTo} from '../pcakage/build2/c0.mjs';

// Survey sites leave the road graph, town footprints and tower approach open.
export function openField(x,z,margin=85){
 return Math.abs(x)<5680&&Math.abs(z)<5680&&Math.hypot(x,z-180)>230
  &&!(Math.abs(x)<210&&z>-680&&z<450)
  &&!CITIES.some(c=>Math.abs(x-c.x)<cityHalf(c)+margin&&Math.abs(z-c.z)<cityHalf(c)+margin)
  &&Math.hypot(x+3000,z-2500)>330&&Math.hypot(x-4200,z-2600)>330
  &&routeDistanceTo(x,z)>margin;
}
function site(x,z,index){for(let i=0;i<24;i++){const a=(i+index)*2.39996,r=i*48,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(openField(px,pz))return {x:px,z:pz};}return null;}
const farms=[[-550,730],[1050,1250],[-1900,600],[2100,-2500],[-2400,-800],[4900,-2700],[-5000,3200],[1100,4900],[4850,4150],[-850,2650],[-900,-3900],[1700,-4950]];
export const TURBINES=Object.freeze(farms.flatMap(([x,z],farm)=>Array.from({length:8},(_,i)=>{const p=site(x+(i%4-1.5)*200,z+(Math.floor(i/4)-.5)*250,farm*8+i);return p&&Object.freeze({...p,id:`wind-${farm}-${i}`,height:180+(farm%4)*28,blade:88+(i%3)*13,phase:i*.9+farm,speed:.16+(farm%5)*.025});}).filter(Boolean)));
const centers=Array.from({length:36},(_,i)=>[-5050+(i%6)*1950,-4950+Math.floor(i/6)*1900]);
const originalGiants=[[-340,740],[-650,1260],...centers].flatMap(([x,z],i)=>Array.from({length:i<2?1:2},(_,j)=>{const p=site(x+j*180,z-j*190,i+j);return p&&Object.freeze({...p,id:`g-${i}-${j}`,kind:(i*2+j)%6,phase:i*.83+j*2,scale:.85+((i+j)%5)*.12});}).filter(Boolean));
export const GIANT_SITES=Object.freeze([...originalGiants,...centers.slice(0,24).flatMap(([x,z],i)=>{const p=site(x-330,z+240,250+i);return p?[Object.freeze({...p,id:`g-extra-${i}`,kind:6+i%4,phase:i*.71,scale:1+(i%3)*.1})]:[];})]);
export const ANOMALIES=Object.freeze(centers.flatMap(([x,z],i)=>{const p=site(x+470,z+380,i+81);return p?[Object.freeze({...p,id:`object-${i}`,kind:i%9,scale:100+(i%5)*32,altitude:[0,210,-48,460][i%4]})]:[];}));
export const GROVES=Object.freeze([[-1100,500],[1750,1500],[-3000,-2200],[5100,700],[-700,2800],[1550,4500]].flatMap(([x,z],i)=>{const p=site(x,z,i+150);return p?[Object.freeze({...p,radius:105+(i%3)*12,seed:i+400})]:[];}));
export const EXTRA_HILLS=Object.freeze(centers.filter((_,i)=>i%2===0).map(([x,z],i)=>Object.freeze({x:x+260,z:z+100,radius:460+(i%3)*130,height:25+(i%4)*12})));
