import * as THREE from 'three';

// Original decorative scenes. These are conceptual graphics, not evidence plots.
export function buildAccent(kind,field,geometries,materials){
 const geometry=g=>(geometries.push(g),g),material=m=>(materials.push(m),m);
 const teal=material(new THREE.MeshPhysicalMaterial({color:0x88dbc9,metalness:.4,roughness:.24,emissive:0x153b39,emissiveIntensity:.35,clearcoat:1}));
 const violet=material(new THREE.MeshPhysicalMaterial({color:0xaaa0ef,metalness:.35,roughness:.29,emissive:0x302746,emissiveIntensity:.25,clearcoat:1}));
 const line=material(new THREE.LineBasicMaterial({color:0x82dfcf,transparent:true,opacity:.5}));
 const path=(points,color=0x84e4c8,opacity=.5)=>{const g=geometry(new THREE.BufferGeometry().setFromPoints(points)),m=material(new THREE.LineBasicMaterial({color,transparent:true,opacity})),object=new THREE.Line(g,m);field.add(object);return object;};
 let animate=()=>{};const pickables=[];
 if(kind==='explore'){
  const orb=geometry(new THREE.IcosahedronGeometry(.68,3));
  const cores=[];
  for(const [i,x,mat] of [[0,-1.45,teal],[1,1.45,violet]]){const mesh=new THREE.Mesh(orb,mat);mesh.position.set(x,.16,0);mesh.userData.index=i;pickables.push(mesh);cores.push(mesh);field.add(mesh);const edges=new THREE.LineSegments(geometry(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.83,1))),line);edges.position.copy(mesh.position);field.add(edges);}
  const curves=[],packets=[];
  for(let i=0;i<4;i++){
   const side=i%2?1:-1,y=.45+i*.15;
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.45,.16,0),new THREE.Vector3(-.55,side*(1.3+i*.13),y),new THREE.Vector3(.55,side*(1.3+i*.13),y),new THREE.Vector3(1.45,.16,0)]);curves.push(curve);
   field.add(new THREE.Mesh(geometry(new THREE.TubeGeometry(curve,72,.016,7,false)),i%2?teal:violet));
   const packet=new THREE.Mesh(geometry(new THREE.SphereGeometry(.075,12,8)),material(new THREE.MeshBasicMaterial({color:i%2?0xcbfdeb:0xd0bfff})));field.add(packet);packets.push(packet);
  }
  const rings=[];
  for(let i=0;i<5;i++){const ring=new THREE.Mesh(geometry(new THREE.TorusGeometry(2.4+i*.23,.011,6,128)),i%2?violet:teal);ring.rotation.set(Math.PI/2+i*.2,.12+i*.35,0);field.add(ring);rings.push(ring);}
  const cage=new THREE.LineSegments(geometry(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(3.7))),line);cage.rotation.z=.35;field.add(cage);
  const sparks=[];
  const sparkGeometry=geometry(new THREE.SphereGeometry(.045,8,6)),sparkMaterial=material(new THREE.MeshBasicMaterial({color:0xb8ffe4}));
  for(let i=0;i<24;i++){const dot=new THREE.Mesh(sparkGeometry,sparkMaterial);field.add(dot);sparks.push(dot);}
  animate=(t,s)=>{packets.forEach((p,i)=>{p.position.copy(curves[i].getPoint((t*(s.expanded?.32:.14)+i*.23)%1));p.scale.setScalar(1+s.energy*2);});rings.forEach((r,i)=>{r.rotation.z=t*(i%2?.07:-.05)+s.x*.18;r.scale.setScalar(1+s.energy*.16);});cores.forEach((c,i)=>c.scale.setScalar(1+(s.hovered===i?.16:0)+(s.selected===i?s.energy*.35:0)));sparks.forEach((dot,i)=>{const a=i/24*Math.PI*2+t*.2,r=.8+(1-s.energy)*2.7;dot.visible=s.energy>.035;dot.position.set(Math.cos(a)*r,Math.sin(a)*r*.7,Math.sin(a*2)*s.energy*1.8);dot.scale.setScalar(.5+s.energy*1.4);});};
 }else if(kind==='atlas'){
  const sample=(x,z,l)=>Math.sin(x*1.12+l*.67)*Math.cos(z*.8)*.48+Math.sin(z*1.9+x*.6)*.16+l*.52-.65;
  const layers=[],highlight=material(new THREE.MeshBasicMaterial({color:0xb6f4de,transparent:true,opacity:.55})),scanner=new THREE.Mesh(geometry(new THREE.BoxGeometry(.016,3.2,4.22)),highlight);field.add(scanner);
  for(let layer=0;layer<4;layer++){
   const layerGroup=new THREE.Group();field.add(layerGroup);layers.push(layerGroup);
   const n=48,vertices=[],colors=[],indices=[],color=new THREE.Color();
   for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const xx=(x/n-.5)*5.9,zz=(z/n-.5)*4.2,y=sample(xx,zz,layer);vertices.push(xx,y,zz);color.setHSL(.45+layer*.052+Math.max(0,y-layer*.52)*.04,.43,.27+layer*.055);colors.push(color.r,color.g,color.b);}
   for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
   const g=geometry(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
   const surface=new THREE.Mesh(g,material(new THREE.MeshPhysicalMaterial({vertexColors:true,side:THREE.DoubleSide,metalness:.3,roughness:.28,transparent:true,opacity:.78,clearcoat:1,depthWrite:false})));surface.userData.index=layer;pickables.push(surface);layerGroup.add(surface);
   for(let row=0;row<13;row++){const z=(row/12-.5)*4.2;layerGroup.add(path(Array.from({length:65},(_,j)=>{const x=(j/64-.5)*5.9;return new THREE.Vector3(x,sample(x,z,layer)+.007,z);}),layer%2?0x9e99e0:0x89cfc0,.42));}
  }
  const frame=new THREE.LineSegments(geometry(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.2,3.4,4.5))),line);frame.position.y=.35;field.add(frame);
  animate=(t,s)=>{scanner.position.x=s.x*2.9;scanner.position.y=.35+s.y*.14;scanner.material.opacity=.18+s.energy*.5;layers.forEach((g,i)=>{g.position.y+=( (s.expanded?(i-1.5)*.6:0)+Math.sin(t*.4+i)*.035-g.position.y)*.13;g.rotation.z+=(s.y*.045*(i+1)-g.rotation.z)*.12;g.children[0].material.emissive.setHex(s.hovered===i?0x145041:0x000000);});};
 }else if(kind==='library'){
  const sheet=geometry(new THREE.BoxGeometry(3.4,.045,2.2)),outline=geometry(new THREE.EdgesGeometry(sheet)),sheets=[];
  const glass=material(new THREE.MeshPhysicalMaterial({color:0x88d1ca,metalness:.28,roughness:.19,transparent:true,opacity:.65,depthWrite:false,clearcoat:1}));
  const dot=geometry(new THREE.BoxGeometry(.07,.015,.07));
  for(let i=0;i<18;i++){
   const group=new THREE.Group(),mesh=new THREE.Mesh(sheet,i%5===0?violet:glass);mesh.userData.index=i;pickables.push(mesh);group.add(mesh);group.add(new THREE.LineSegments(outline,line));group.position.set(Math.sin(i*.72)*.27,(i-8.5)*.17,Math.cos(i*.68)*.15);group.rotation.y=(i-8.5)*.024;field.add(group);sheets.push(group);
   for(let j=0;j<6;j++){const d=new THREE.Mesh(dot,j%3?violet:teal);d.position.set(-1.35+j*.45,.037,-.81);group.add(d);}
  }
  const frame=new THREE.LineSegments(geometry(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.25,3.7,3.2))),line);field.add(frame);
  for(let k=0;k<3;k++){path(Array.from({length:140},(_,i)=>{const t=i/139*Math.PI*2;return new THREE.Vector3(Math.cos(t)*(2.5+k*.2),Math.sin(t)*(1.75+k*.11),Math.sin(t*.5+k)*.9);}),k===1?0xa48dde:0x7bbcae,.5);}
  animate=(t,s)=>{sheets.forEach((g,i)=>{const picked=s.hovered===i||s.selected===i;g.position.x+=(Math.sin(i*.72+t*.16)*.27+(s.expanded?(i-8.5)*.095:0)+(picked?.55:0)-g.position.x)*.14;g.position.y+=((i-8.5)*(s.expanded?.255:.17)+(picked?.14:0)-g.position.y)*.14;g.rotation.y=(i-8.5)*(s.expanded?.07:.024)+Math.sin(t*.22+i*.18)*.025+s.x*.045;g.scale.setScalar(picked?1.055:1);});};
 }
 return {animate,pickables};
}
