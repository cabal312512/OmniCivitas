import * as THREE from 'three';
const canvas=document.querySelector('[data-n9-gpu]');
if(canvas){
 const reduce=matchMedia('(prefers-reduced-motion:reduce)'),life=new AbortController();
 const on=(node,event,fn)=>node.addEventListener(event,fn,{signal:life.signal});
 const state=window.__ocvN9GPU={mode:'initializing',frames:0,disposed:false};
 const uniforms={uTime:{value:0},uPointer:{value:new THREE.Vector2()},uRatio:{value:1}};
 let renderer,raf=0,paused=document.hidden,disposed=false;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.1,160);camera.position.z=28;
 const disposable=[];
 function keep(item){disposable.push(item);return item;}
 const cloud=new Float32Array(3400*3),seeds=new Float32Array(3400);
 for(let i=0;i<3400;i++){const a=i*2.3999632,r=2+Math.sqrt(i/3400)*22;cloud[i*3]=Math.cos(a)*r;cloud[i*3+1]=Math.sin(a)*r*.72;cloud[i*3+2]=-9+(i%91)*.2;seeds[i]=(i%131)/131;}
 const pointsGeometry=keep(new THREE.BufferGeometry());pointsGeometry.setAttribute('position',new THREE.BufferAttribute(cloud,3));pointsGeometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
 const pointsMaterial=keep(new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`attribute float aSeed;uniform float uTime;uniform vec2 uPointer;varying float vSeed;void main(){vSeed=aSeed;vec3 p=position;float a=uTime*.045+aSeed*.8;mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));p.xy=r*p.xy;p.z+=sin(uTime*.8+aSeed*20.)*2.;p.xy+=uPointer*(1.+aSeed*2.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.7+aSeed*3.2)*28./-mv.z,1.,9.);}`,fragmentShader:`varying float vSeed;uniform float uTime;void main(){float r=length(gl_PointCoord-.5);float glow=exp(-r*r*22.)*.72;vec3 c=mix(vec3(.0,.25,1.),vec3(.0,.95,1.),vSeed);gl_FragColor=vec4(c,glow*(.6+.4*sin(uTime+vSeed*21.)));}`}));
 scene.add(new THREE.Points(pointsGeometry,pointsMaterial));
 const assembly=new THREE.Group();assembly.position.set(7,-1,-4);scene.add(assembly);
 const ringGeometry=keep(new THREE.TorusGeometry(6.2,.024,4,240));
 for(let i=0;i<13;i++){const material=keep(new THREE.MeshBasicMaterial({color:i%3?0x0868ff:0x09cfdc,transparent:true,opacity:.17+i*.018}));const ring=new THREE.Mesh(ringGeometry,material);ring.rotation.set(i*.21,i*.36,i*.07);ring.scale.setScalar(.52+i*.085);assembly.add(ring);}
 const sheetGeometry=keep(new THREE.PlaneGeometry(34,13,200,45));
 const sheetMaterial=keep(new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,wireframe:true,vertexShader:`uniform float uTime;varying vec3 vP;void main(){vec3 p=position;p.z=sin(p.x*.32+uTime*.7)*cos(p.y*.6-uTime*.3)*1.8;vP=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec3 vP;void main(){float a=.10+.12*cos(vP.x*.19);gl_FragColor=vec4(.015,.42,.98,a);}`}));
 const sheet=new THREE.Mesh(sheetGeometry,sheetMaterial);sheet.position.set(-7,-5,-7);sheet.rotation.set(.85,.12,-.25);scene.add(sheet);
 const wave=document.querySelector('[data-n9-wave]'),waveContext=wave?.getContext('2d');
 function waveFrame(time){if(!waveContext)return;const w=wave.width,h=wave.height;waveContext.clearRect(0,0,w,h);for(let band=0;band<5;band++){waveContext.strokeStyle=band%2?'#008cff':'#5ce4ff';waveContext.globalAlpha=.3+band*.1;waveContext.lineWidth=1;waveContext.beginPath();for(let x=0;x<w;x++){const y=h/2+Math.sin(x*.038+time*(.8+band*.14))*Math.sin(x*.009+band)*h*.37; x?waveContext.lineTo(x,y):waveContext.moveTo(x,y);}waveContext.stroke();}}
 function render(now=0){raf=0;if(disposed||paused)return;const time=reduce.matches?0:now*.001;uniforms.uTime.value=time;assembly.rotation.set(time*.071,time*.043,time*.021);sheet.rotation.z=-.25+Math.sin(time*.2)*.06;if(renderer){renderer.render(scene,camera);state.frames++;}waveFrame(time);if(!reduce.matches)raf=requestAnimationFrame(render);}
 function request(){if(!raf&&!disposed&&!paused)raf=requestAnimationFrame(render);}
 function resize(){const width=innerWidth,height=innerHeight;camera.aspect=width/height;camera.updateProjectionMatrix();renderer?.setSize(width,height,false);request();}
 try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);state.mode='webgl';resize();}catch{state.mode='css-fallback';request();}
 on(window,'pointermove',event=>{uniforms.uPointer.value.set((event.clientX/innerWidth-.5)*1.4,(.5-event.clientY/innerHeight)*1.4);canvas.parentElement.style.setProperty('--n9-x',event.clientX+'px');canvas.parentElement.style.setProperty('--n9-y',event.clientY+'px');if(reduce.matches)request();});
 on(window,'resize',resize);on(reduce,'change',()=>{cancelAnimationFrame(raf);raf=0;request();});
 on(document,'visibilitychange',()=>{paused=document.hidden;if(paused){cancelAnimationFrame(raf);raf=0;}else request();});
 on(window,'pagehide',event=>{paused=true;cancelAnimationFrame(raf);raf=0;if(!event.persisted){disposed=true;state.disposed=true;for(const item of disposable)item.dispose();renderer?.dispose();renderer?.forceContextLoss();life.abort();}});
 on(window,'pageshow',()=>{paused=document.hidden;request();});
}
