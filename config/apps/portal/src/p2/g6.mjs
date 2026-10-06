// Road paint lives on the deck shader, rather than coplanar floating boxes.
export function installRoadPaint(material, onCompile = () => {}) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 roadSurvey;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nroadSurvey=uv;');
    shader.fragmentShader = 'varying vec2 roadSurvey;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float u=roadSurvey.x, metre=roadSurvey.y;
      float aa=max(fwidth(u),.0006);
      float edge=1.-smoothstep(.003,.003+aa,min(abs(u-.12),abs(u-.88)));
      float shoulder=smoothstep(.885,.885+aa,abs(u-.5)+.5);
      float lanes=1.-smoothstep(.004,.004+aa,min(abs(u-.31),abs(u-.69)));
      float dash=1.-smoothstep(9.5,10.5,mod(metre,24.));
      float centre=1.-smoothstep(.003,.003+aa,abs(abs(u-.5)-.009));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.67,.77,.80),shoulder*.42);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.54,.61),max(edge,lanes*dash)*.72);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.66,.36),centre*.8);
    `);
    onCompile();
  };
  material.customProgramCacheKey = () => 'survey-pavement-v2';
}

export function roadUVs(road) {
  const result = new Float32Array(road.points.length * 6);
  let distance = 0;
  for (let i = 0; i < road.points.length; i++) {
    if (i) distance += Math.hypot(road.points[i].x-road.points[i-1].x,road.points[i].z-road.points[i-1].z);
    for (let side=0;side<3;side++) {result[i*6+side*2]=side/2;result[i*6+side*2+1]=distance;}
  }
  return result;
}

// The edge frame uses the actual Float32 miter vertices of the road mesh.
export function roadEdge(road, index, side, inset = 0) {
  const offset=index*9+(side<0?0:6),center=index*9+3,p=road.positions;
  const dx=p[offset]-p[center],dz=p[offset+2]-p[center+2],length=Math.hypot(dx,dz);
  const ratio=(length-inset)/length;
  return {x:p[center]+dx*ratio,y:p[offset+1],z:p[center+2]+dz*ratio,nx:dx/length,nz:dz/length};
}
