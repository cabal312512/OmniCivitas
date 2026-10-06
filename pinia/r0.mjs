const greetings=[['通道正常。','巡查中。','塔顶信号未返回。','等下一轮。'],['三号信件未送达。','接收站在东侧。','回执待补。','信件为空。'],['灯还亮着。','这里没有夜班。','请保持距离。','人数不匹配。'],['货物：零。','正在转运。','目的地已删除。','订单仍有效。'],['此处禁止停车。','终点已过。','路线校验中。','下一站：原地。'],['记录已同步。','没有收到指令。','保持在线。','上一位还没回来。'],['收件人不在。','门牌正常。','地址无法解析。','等待签收。'],['温度合格。','窗户已关闭。','请确认天色。','天色未改变。']];
const injured=['停止。损伤已登记。','请勿重复操作。','外壳异常。','警告 04。','不建议继续。','我没有攻击模块。','回执作废。','权限不足。'];
export function npcLine(kind,id,count,reason,story){
 if(reason==='hit')return injured[(id+count)%injured.length];if(reason==='down')return '单元离线。';
 if((id+count)%13===0)return ['0x00 / ▒▒ / ACK','Ð¿Ð¾ / 01 / 接_','応答なし。▒'][id%3];
 if(kind===1){story.mail=Math.min(3,(story.mail||0)+1);return ['三号信件未送达。','接收站在东侧。','收到空白回执。'][story.mail-1];}
 if(kind===2&&story.mail===3)return '空白回执。已入库。';
 return greetings[kind%greetings.length][count%4];
}
