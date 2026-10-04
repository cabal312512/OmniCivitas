export function reversedDate(day,year,month){
 const d=Number(day),y=Number(year),m=Number(month);
 if(!Number.isInteger(d)||!Number.isInteger(y)||!Number.isInteger(m)||y<1900||y>9999||m<1||m>12||d<1||d>31)throw Error('请选择日、年、月');
 const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw Error('这个日期不存在');
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function volumeFromDial(raw){const n=Number(raw);if(!Number.isFinite(n)||n<0||n>100)throw Error('旋钮越界');return Math.round(n*n/100);}
export function minutePopulation(time){const minute=Math.floor(time/60000);return ((minute*7919+minute*minute*17)%887+887)%887+23;}
export function fakeClocks(time,offset=43){if(!Number.isFinite(time))throw Error('时间不可用');const t=new Date(time);return {local:t.toLocaleString(),utc:t.toISOString(),platform:new Date(time+offset*1000).toISOString(),offset};}
export function diagnosticText(code){const displayed=`服务器内部非常外部错误\n${code}`;return {displayed,copy:Array.from({length:16},(_,i)=>`[${i+1}] ${displayed}`).join('\n')+'\n建议重新尝试'};}
export const achievementLabels={closed:'成功关闭一个弹窗',refreshed:'第一次刷新页面',triple:'连续点了三次同一个按钮',fake:'发现一个假按钮',waited:'等待加载超过十秒',tools:'使用五种互不相关的工具',tabs:'同时打开三个本站标签页'};
export function cleanAwards(input){
 const empty={version:1,index:'0',awards:[],tools:[],groups:[],compat:false};
 try{const v=typeof input==='string'?JSON.parse(input):input;if(!v||v.version!==1||!/^(0|[1-9]\d*)$/.test(v.index)||!Array.isArray(v.awards)||!Array.isArray(v.tools)||!Array.isArray(v.groups)||typeof v.compat!=='boolean')return empty;
 return {version:1,index:v.index,awards:[...new Set(v.awards.filter(x=>Object.hasOwn(achievementLabels,x)))],tools:[...new Set(v.tools.filter(x=>typeof x==='string'&&/^[a-z0-9-]{1,60}$/.test(x)))].slice(0,128),groups:[...new Set(v.groups.filter(x=>typeof x==='string'&&x.length<20))].slice(0,20),compat:v.compat};}catch{return empty;}
}
export function registerUse(state,id,group){const next=cleanAwards(state);next.index=(BigInt(next.index)+(next.groups.includes(group)?4n:13n)).toString();if(!next.tools.includes(id))next.tools.push(id);if(!next.groups.includes(group))next.groups.push(group);if(next.tools.length>=5&&next.groups.length>=5&&!next.awards.includes('tools'))next.awards.push('tools');return next;}
export function safePosition(raw){try{const p=JSON.parse(raw);if(Number.isFinite(p.x)&&Number.isFinite(p.y))return{x:Math.max(-2000,Math.min(2000,p.x)),y:Math.max(-2000,Math.min(2000,p.y))};}catch{}return{x:0,y:0};}
