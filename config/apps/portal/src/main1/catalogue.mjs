import {rooms,address} from '../aaa/map.mjs';
import {tools,toolLink} from '../tool/data.mjs';
import {accidentCatalogue} from '../report/list.mjs';
import {laboratories,labLink} from '../z/map.mjs';
export const aliases={
 'music-studio':'钢琴 简谱 录音 演奏 MIDI WAV 音乐 music piano recording',
 '3d-world':'3D 游戏 开放世界 第一人称 探索 探险 射击 frutiger aero 梦核',
 sweep:'扫除 霉运 清扫 gif',
 sqlite:'SQL 数据库 查询 select group by 聚合 database',
 pivot:'CSV Excel 数据透视 聚合 平均 中位数 统计',
 'json-patch':'JSON diff 差异 比对 比较 补丁 patch RFC6902',
 'pdf-arrange':'PDF 合并 拼接 编排 页码 重排 merge reorder pages',
 'contact-sheet':'拼图 拼版 图集 合图 多图 collage contact sheet',
 'file-manifest':'SHA256 SHA-256 哈希 校验 验证 manifest checksum 文件',
 pipeline:'流程 管道 批处理 workflow pipeline',
 'svg-chart':'SVG 绘图 图表 柱状 折线 散点 plot chart',
 json:'JSON 美化 格式化 校验 format validate',
 base64:'Base64 编码 解码 encode decode',
 regex:'正则 表达式 匹配 regular expression',
};
export const future=[
 {id:'image-compress',title:'图片压缩',keywords:'图像 image compressor jpg png',phase:6,group:'图片'},
 {id:'text',title:'文本工具',keywords:'字数 大小写 去重 text',phase:5,group:'文本'},
 {id:'json',title:'JSON 格式化',keywords:'开发 json format 校验',phase:5,group:'开发'},
 {id:'convert',title:'单位换算',keywords:'转换 温度 长度 convert',phase:5,group:'计算'},
 {id:'clock',title:'时间工具',keywords:'倒计时 秒表 时间 timer',phase:6,group:'时间'},
 {id:'games',title:'小游戏',keywords:'游戏 贪吃蛇 俄罗斯方块 game',phase:7,group:'游戏'},
];
export const catalogue=[
 {id:'profile',title:'个人主页',url:'/profile/',keywords:'头像 昵称 简介 设置 profile avatar',available:true,group:'门户'},
 {id:'workspace',title:'工作台',url:'/workspace/',keywords:'最近打开 便笺 固定 页面 workspace desk',available:true,group:'门户'},
 {id:'favorites',title:'收藏夹',url:'/favorites/',keywords:'收藏 分组 排序 favorites bookmarks',available:true,group:'门户'},
 {id:'research',title:'研究',url:'/research/',keywords:'research 研究 科研 论文 RSA adsorption operational memory exact certificates 互动 演示',available:true,group:'推荐'},
 {id:'media',title:'影音',url:'/media/',keywords:'视频 播放 音效 春日影 老吴',available:true,group:'影音'},
 {id:'background-music',title:'背景音乐',url:'/#systems',keywords:'背景音乐 随机 播放 犯错 囊囊囊 我从南极来 天空 灵感菇',available:true,group:'影音'},
 ...laboratories.map(item=>({id:'lab-'+item.panel,title:item.title,url:labLink(item),keywords:'实验室 lab '+item.path,available:true,group:'实验室'})),
 ...accidentCatalogue,
 ...rooms.map((r,i)=>({id:`room-${i}`,title:r.title,url:address(r),keywords:`迷宫 ${r.path} ${r.feature}`,available:true,group:'目录'})),
 {id:'status',title:'运行状态',url:'/status',keywords:'系统 健康 status',available:true,group:'系统'},
 {id:'unified',title:'新版统一门户',url:'/portals/unified/',keywords:'全部功能 门户 新版',available:true,group:'门户'},
 {id:'light',title:'轻量版',url:'/portals/light/',keywords:'门户 lightweight',available:true,group:'门户'},
 ...future.filter(r=>!tools.some(t=>t.id===r.id)&&!['clock','games'].includes(r.id)).map(r=>({...r,url:`/functions/${r.id}/`,available:false})),
 {id:'clock',title:'时间工具',url:'/functions/clock/',keywords:'倒计时 秒表 时间 timer 番茄',phase:6,group:'时间',available:true},
 {id:'games',title:'小游戏',url:'/functions/games/',keywords:'井字棋 扫雷 2048 贪吃蛇 打砖块 猜数字 反应 打字 翻牌 游戏 game',phase:7,group:'游戏',available:true},
 ...tools.map(t=>({id:t.id,title:t.title,url:toolLink(t),keywords:`${t.title} ${t.id} ${t.group} ${aliases[t.id]||''} ${(t.fields||[]).map(f=>f.label||'').join(' ')}`,group:t.group,phase:t.phase,available:true})),
];
export const recommend=(items=catalogue)=>{const research=items.find(item=>item.id==='research');const sorted=items.filter(item=>item!==research).sort((a,b)=>Array.from(a.title).length-Array.from(b.title).length||a.id.localeCompare(b.id));return research?[research,...sorted.slice(0,6)]:sorted.slice(0,7);};
export function searchFeatures(value){
 const normal=value=>String(value).normalize('NFKC').toLocaleLowerCase();
 const compact=value=>normal(value).replace(/[\s\p{P}]+/gu,'');
 const q=normal(value).trim().slice(0,80);
 if(!q)return recommend();
 const tokens=q.match(/[a-z0-9]+|[^\s\p{P}a-z0-9]+/gu)||[],needle=compact(q);
 if(!needle)return recommend();
 const score=r=>{const title=normal(r.title),id=normal(r.id);return title===q||id===q?0:title.startsWith(q)?1:title.includes(q)?2:3;};
 return catalogue.filter(r=>{const hay=normal(`${r.title} ${r.keywords}`);return tokens.every(t=>hay.includes(t))||compact(hay).includes(needle);}).sort((a,b)=>score(a)-score(b)||a.title.length-b.title.length||a.id.localeCompare(b.id)).slice(0,30);
}

function cabal312512(){return 43;}
