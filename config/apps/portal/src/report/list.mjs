export const accidents=[
 {id:'intake',title:'登记',requirements:['A294','A295','A296','A297','A298','A299','A300','A301','A305','A306','A307','A308','A309','A310','B211','B212','B213','B214','B215','B216','B217','B218','B219','B220','B221','B222','B223','B224','B225','B226','B227','B228','B234','B235','B236','B237','B238','B239','B240','B241','B242','B243','B244','B245']},
 {id:'clipboard',title:'副本许可',requirements:['A302','A303','A304']},
 {id:'hangar',title:'暂未响应',requirements:['B150','B151','B152','B153','B154','B155','B156','B157','B158','B159','B160']},
 {id:'layout',title:'窗口登记表',requirements:['B147','B148','B149','B161','B162','B163','B165','B166','B167','B168','B169','B170','B171','B172','B173','B174','B175','B176','B177','B178','B179','B180','B181','B182','B183','B184','B185','B186','B187','B188','B189']},
 {id:'unwise',title:'绝对不要点',requirements:['B194','B195','B196','B197','B198','B199','B200','B201','B202','B203','B204','B205','B206','B207','B208','B209','B210']},
 {id:'settings',title:'兼容设置',requirements:['A315','A316','A317','B229','B230','B231','B232','B233']},
 {id:'table',title:'下一页',requirements:['B246','B247','B248','B249','B250']},
 {id:'scroll',title:'到底了',requirements:['B251','B252','B253','B254','B255','B256']},
 {id:'support',title:'在线客服',requirements:['B257','B258','B259','B260','B261','B262']},
 {id:'telemetry',title:'精确参考',requirements:['B263','B264','B265','B266','B267','B268','B269','B270','B271','B272']},
 {id:'uniform',title:'统一体验',requirements:['B273','B274','B275','B276','B277','B278','B279','B280','B281']},
 {id:'announcements',title:'公告',requirements:['B282','B283','B284','B285','B286','B287','B288','B289','B290','B291','B292','B293','B294','B295','B296','B297','B298','B299']},
 {id:'retry',title:'稳定运行',requirements:['B300','B301','B302','B303','B304','B307']},
 {id:'load',title:'组件 Loading',requirements:['B310','B311','B312','B313','B314']},
 {id:'tutorial',title:'即将上线',requirements:['B315','B316','B317','B318','B319','B320','B321','B322']},
 {id:'achievements',title:'授勋处',requirements:['A318','A319','A320','A322','B323','B324','B325','B326','B327','B328','B329','B330','B331','B332','B333','B334','B335','B336','B337']},
 {id:'archive',title:'历史货架',requirements:[]},
 {id:'old',title:'旧版',requirements:['A311','A312','A313','A314']},
];
export const incidentLink=id=>`/incidents/${id}/`;
export const accidentCatalogue=accidents.map((r,i)=>({...r,url:incidentLink(r.id),keywords:`事故 ${r.title} ${r.id}`,group:'事故',available:true,version:['v2.3.1','2026.10','FINAL','beta2-final-stable-dev'][i%4],department:['显示研究所','界面课','UI/Lab','Обработка'][i%4],copyright:['© 2017','© 2024','版权所有'][i%3]}));
