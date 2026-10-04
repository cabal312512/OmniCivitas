const entries=[
 ['空间索引','topology','sqlite','pivot'],['材质参数','shader','svg-chart','contact-sheet'],['位相','wave','pipeline','svg-chart'],
 ['字节视图','bytes','file-manifest','json-patch'],['分片','stream','sqlite','file-manifest'],['地址映射','bytes','json-patch','sqlite'],
 ['流程图','nodes','pipeline','json-patch'],['排程','timeline','pdf-arrange','pipeline'],['偏振','shader','svg-chart','contact-sheet'],
 ['曲面','shader','svg-chart','contact-sheet'],['截面','contour','pivot','svg-chart'],['体素','voxel','contact-sheet','svg-chart'],
 ['事件轨迹','timeline','file-manifest','pipeline'],['주파수','wave','svg-chart','pivot'],['包络','wave','pipeline','svg-chart'],
 ['样本','data','pivot','sqlite'],['列分布','data','sqlite','svg-chart'],['数据连线','nodes','json-patch','pivot'],
 ['点云','points','svg-chart','contact-sheet'],['καρέ','bytes','file-manifest','pipeline'],['軌道','orbits','svg-chart','pdf-arrange'],
 ['星图','topology','sqlite','svg-chart'],['矩阵','matrix','pivot','json-patch'],['干涉仪','shader','contact-sheet','svg-chart'],
 ['拓扑','topology','sqlite','pipeline'],['流水线','nodes','pipeline','json-patch'],['渲染队列','stream','pdf-arrange','contact-sheet']
];
export const panels=entries.map(([title,kind,...tools],index)=>({index,title,kind,tools,variant:index%3,width:[560,390,740,460][index%4],left:[37,9,55,18,44][index%5],top:[710,930,650,1150,810,420][index%6],skin:index%7===0?'carbon':'glass'}));
export const laboratories=[{path:'field/surface',title:'曲面',panel:9},{path:'field/interference',title:'干涉',panel:23},{path:'data/query',title:'数据',panel:15},{path:'data/graph',title:'拓扑',panel:24},{path:'frames/bytes',title:'字节',panel:3},{path:'signal/bands',title:'频带',panel:13},{path:'flow/steps',title:'流程',panel:25},{path:'space/orbit',title:'轨道',panel:20}];
export const labLink=x=>'/lab/'+x.path+'/';
