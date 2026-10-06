export const TOWNS=Object.freeze([
 {id:'t01',x:-1200,z:2000,ground:28,lanes:3,rows:10,spacing:44,laneSpacing:146},
 {id:'t02',x:1300,z:-900,ground:30,lanes:3,rows:12,spacing:44,laneSpacing:146},
 {id:'t03',x:-2200,z:-3400,ground:40,lanes:3,rows:10,spacing:44,laneSpacing:146},
 {id:'t04',x:2700,z:4600,ground:24,lanes:3,rows:11,spacing:44,laneSpacing:146},
 {id:'t05',x:5150,z:1600,ground:34,lanes:3,rows:10,spacing:44,laneSpacing:146},
 {id:'t06',x:-5000,z:4100,ground:72,lanes:3,rows:12,spacing:44,laneSpacing:146},
].map(t=>Object.freeze({...t,width:(t.lanes-1)*t.laneSpacing+150,length:t.rows*t.spacing+100})));
export const townContains=(t,x,z,margin=0)=>Math.abs(x-t.x)<t.width/2+margin&&Math.abs(z-t.z)<t.length/2+margin;
export function townHouseSites(t){const sites=[];for(let lane=0;lane<t.lanes;lane++)for(let row=0;row<t.rows;row++)for(const side of [-1,1])sites.push({x:t.x+(lane-(t.lanes-1)/2)*t.laneSpacing+side*44,z:t.z+(row-(t.rows-1)/2)*t.spacing,lane,row,side,palette:(lane*3+row+(side===1?2:0))%7});return sites;}
