// Shared static street furniture. No independent animation or distant AI.
export function addCityDetails({cities,records,add,box,cylinder,sphere,wheel,mats,clear,solid}) {
  const {paving,white,metal,glass,seat,leaf,lamp,blue,red,amber,rubber}=mats;
  const counts={},districts=[];
  let current;
  const count=kind=>{counts[kind]=(counts[kind]||0)+1;current.counts[kind]=(current.counts[kind]||0)+1;};
  function prop(kind,x,y,z,variant=0) {
    count(kind);
    const part=(geometry,mat,dx,dy,dz,sx,sy,sz,rx=0,ry=0,rz=0)=>add(geometry,mat,x+dx,y+dy,z+dz,sx,sy,sz,rx,ry,rz);
    switch(kind) {
      case 'streetLights':
        part(cylinder,metal,0,4.5,0,.18,9,.18);part(box,metal,1.3,8.95,0,2.7,.15,.15);
        part(box,white,2.5,8.88,0,1.2,.23,.6);part(box,lamp,2.5,8.74,0,.95,.04,.42);break;
      case 'benches':
        part(box,seat,0,.62,0,3.2,.18,.85);part(box,seat,0,1.05,.38,3.2,.68,.13);
        for(const s of [-1,1]){part(box,metal,s*1.2,.33,0,.13,.65,.72);part(box,metal,s*1.5,.85,0,.1,.12,.83);}
        solid(x,z,3.2,1,y,1.4,'street-bench');break;
      case 'bins':
        for(const s of [-1,1]) {part(box,s<0?blue:leaf,s*.48,.66,0,.83,1.3,.75);part(box,metal,s*.48,1.33,0,.92,.12,.83);part(box,rubber,s*.48,1.15,-.386,.54,.12,.03);}
        solid(x,z,1.85,.9,y,1.4,'street-bin');break;
      case 'planters':
        part(box,white,0,.38,0,3.8,.76,2);part(box,rubber,0,.77,0,3.5,.03,1.7);
        for(let i=-2;i<=2;i++){part(sphere,leaf,i*.63,.94,0,.49,.29,.58);part(cylinder,leaf,i*.63,1.31,.15,.035,.76,.035);part(sphere,i%2?amber:red,i*.63,1.69,.15,.19,.09,.19);}
        solid(x,z,3.8,2,y,.8,'street-planter');break;
      case 'hydrants':
        part(cylinder,red,0,.62,0,.43,1.15,.43);part(sphere,red,0,1.22,0,.26,.19,.26);
        part(cylinder,metal,0,.82,0,.2,.9,.2,0,0,Math.PI/2);solid(x,z,.85,.7,y,1.4,'hydrant');break;
      case 'bicycleRacks':
        for(let i=-1;i<=1;i++){part(cylinder,metal,i*1.15,.48,0,.08,.95,.08);part(box,metal,i*1.15,.94,0,.1,.08,1.4);for(const s of [-1,1])part(cylinder,metal,i*1.15,.48,s*.66,.08,.95,.08);}
        for(const dz of [-.82,.82])part(wheel,rubber,.4,.46,dz,.44,.44,.44,0,Math.PI/2);
        part(box,blue,.4,.71,0,.075,.075,1.8,-.3);part(box,blue,.4,.76,0,.075,1.1,.075,0,0,-.2);
        part(box,metal,.4,1.3,-.73,.72,.08,.08);part(box,seat,.4,1.3,.38,.45,.09,.3);break;
      case 'kiosks':
        part(box,white,0,1.5,0,1.45,3,1);part(box,blue,0,1.8,-.52,1.19,1.76,.05);
        part(box,glass,0,1.88,-.56,.98,1.27,.02);part(box,metal,0,.7,-.57,.68,.12,.04);
        part(box,lamp,0,3.08,0,1.9,.14,1.32);solid(x,z,1.6,1.3,y,3.2,'kiosk');break;
      case 'mailboxes':
        part(box,blue,0,1.22,0,.97,1.19,.79);part(cylinder,metal,0,.42,0,.17,.84,.17);
        part(box,rubber,0,1.48,-.41,.65,.07,.025);part(box,white,0,1.1,-.42,.48,.16,.025);break;
      case 'bollards':
        for(let i=-1;i<=1;i++){part(cylinder,metal,i*1.3,.48,0,.16,.96,.16);part(cylinder,white,i*1.3,.76,0,.18,.16,.18);}break;
      case 'parkedCars':
        part(box,variant%2?blue:white,0,.74,0,2.05,.63,4.35);part(box,glass,0,1.26,-.15,1.76,.66,2.35);
        part(box,white,0,1.64,-.15,1.85,.1,2.45);
        for(const s of [-1,1])for(const dz of [-1.4,1.4])part(cylinder,rubber,s*1.02,.43,dz,.7,.18,.7,0,0,Math.PI/2);
        for(const s of [-1,1]){part(box,lamp,s*.66,.78,-2.2,.49,.2,.04);part(box,red,s*.66,.78,2.2,.49,.16,.04);}
        solid(x,z,2.1,4.4,y,1.7,'parked-car');break;
      case 'busShelters':
        for(const s of [-1,1])part(cylinder,metal,s*3,2.2,.9,.14,4.4,.14);
        part(box,glass,0,2.2,1.05,6,4.1,.09);part(box,white,0,4.4,0,6.7,.16,3.3);
        part(box,seat,0,.63,.46,4.5,.17,.73);part(box,blue,3.8,2.65,-.7,.86,1.17,.12);
        part(cylinder,metal,3.8,1.2,-.7,.08,2.4,.08);break;
      case 'utilityCabinets':
        part(box,white,0,.83,0,1.55,1.65,.68);part(box,metal,.04,.83,-.35,.025,1.45,.025);
        for(let i=0;i<5;i++)part(box,metal,-.36,.53+i*.14,-.35,.44,.035,.025);solid(x,z,1.6,.7,y,1.7,'utility');break;
      case 'trafficSignals':
        part(cylinder,metal,0,2.3,0,.14,4.6,.14);part(box,metal,0,4.5,0,.5,1.5,.45);
        for(let i=0;i<3;i++)part(sphere,i===variant%3?lamp:[red,amber,leaf][i],0,4.96-i*.44,-.25,.16,.16,.07);break;
      case 'drains':
        part(box,metal,0,.012,0,1.25,.018,.72);for(let i=-3;i<=3;i++)part(box,rubber,i*.15,.027,0,.055,.008,.52);break;
      case 'manholes':
        part(cylinder,metal,0,.014,0,1.04,.025,1.04);for(let i=-1;i<=1;i++)part(box,rubber,i*.22,.03,0,.04,.008,.64);break;
    }
  }
  for(const city of cities){
    current={id:city.id,counts:{},sites:[]};districts.push(current);
    const buildings=records.find(r=>r.id===city.id).buildingRecords,y=city.ground+.095;
    // Streets run between the surveyed building rows. The tower/plaza stays open.
    for(let axis=0;axis<2;axis++)for(let row=1;row<city.n;row+=2){
      const across=(row-city.n/2)*city.spacing;
      for(let segment=0;segment<city.n;segment++){
        const along=(segment-(city.n-1)/2)*city.spacing,x=city.x+(axis?along:across),z=city.z+(axis?across:along);
        if(city.clearing&&Math.hypot(x-city.x,z-city.z)<city.clearing+city.spacing*.75)continue;
        add(box,paving,x,y+.015+axis*.008,z,axis?city.spacing:22,.03,axis?22:city.spacing);count('streetSegments');
        for(const s of [-1,1]){
          add(box,white,x+(axis?0:s*13),y+.085,z+(axis?s*13:0),axis?city.spacing:3.3,.16,axis?3.3:city.spacing);
          add(box,white,x+(axis?0:s*10),y+.04,z+(axis?s*10:0),axis?city.spacing:.19,.015,axis?.19:city.spacing);
        }
        for(let mark=-2;mark<=2;mark++)add(box,white,x+(axis?mark*city.spacing/5:0),y+.044+axis*.008,z+(axis?0:mark*city.spacing/5),axis?7:.22,.008,axis?.22:7);
      }
    }
    const kinds=['benches','bins','planters','bicycleRacks','hydrants','kiosks','mailboxes','parkedCars','utilityCabinets','busShelters','bollards'];
    for(let i=0;i<buildings.length;i+=2){
      const b=buildings[i],x=b.x,z=b.z-b.depth/2-11;
      if(!clear(x,z,7,city))continue;
      prop(kinds[(Math.floor(i/2)+city.seed)%kinds.length],x,y,z,i);
      if(clear(x+7,z,1,city))prop('streetLights',x+7,y,z);
      prop('drains',x-4,y,z+3);current.sites.push({x,z});
      // Door canopies and inset entrance glazing attach to the building facade.
      add(box,glass,b.x,city.ground+2.3,b.z-b.depth/2-.12,3.6,4.4,.18);
      add(box,white,b.x,city.ground+4.75,b.z-b.depth/2-1.7,5.7,.22,3.6);count('entranceCanopies');
    }
    // Three usable arterial crossings per district, outside central monuments.
    let junctions=0;
    for(let row=1;row<city.n&&junctions<3;row+=2)for(let col=1;col<city.n&&junctions<3;col+=2){
      const x=city.x+(row-city.n/2)*city.spacing,z=city.z+(col-city.n/2)*city.spacing;
      if(!clear(x,z,19,city))continue;
      for(const s of [-1,1]){
        for(let stripe=-5;stripe<=5;stripe++)add(box,white,x+stripe*1.55,y+.062,z+s*8, .85,.009,4.2);
        prop('trafficSignals',x+s*15,y,z-s*15,junctions);prop('bollards',x+s*15,y,z+s*15);
      }
      prop('manholes',x+3,y,z+3);count('crosswalks');junctions++;
    }
    current.sites=Object.freeze(current.sites.map(Object.freeze));Object.freeze(current.counts);Object.freeze(current);
  }
  return Object.freeze({counts:Object.freeze(counts),districts:Object.freeze(districts),total:Object.values(counts).reduce((a,b)=>a+b,0)});
}
