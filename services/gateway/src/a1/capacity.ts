import {resolve} from 'node:path';
type TaskCapacity={tier:number;concurrency:number;queueLimit:number;maximumConcurrency:number;source:string;filename:string|null;ambiguous:boolean;malformed:boolean;accessible:boolean};
const {readTaskCapacity}=require('../../src/a1/tier.cjs') as {readTaskCapacity:(root:string)=>TaskCapacity};
function integerSetting(name:string,fallback:number,minimum:number,maximum:number){
 const text=process.env[name];if(text===undefined||!/^\d+$/.test(text))return fallback;
 const value=Number(text);return Number.isSafeInteger(value)?Math.max(minimum,Math.min(maximum,value)):fallback;
}
export function taskCapacity(){return readTaskCapacity(process.env.OCV_TASK_TIER_ROOT||resolve(__dirname,'../../../..'));}
export function queueLimit(){return taskCapacity().queueLimit;}
export function executionLimit(){return taskCapacity().concurrency;}
export function queueTtlSeconds(){return integerSetting('OCV_AFTER_QUEUE_TTL_SECONDS',86400,60,604800);}
export function terminalLimit(){return integerSetting('OCV_AFTER_TERMINAL_LIMIT',Math.max(128,executionLimit()*4),32,10000);}
export const trimTerminalSql="DELETE FROM ocv_after.jobs WHERE id IN(SELECT id FROM ocv_after.jobs WHERE state IN('done','failed','cancelled') ORDER BY seq DESC OFFSET $1)";
export const expireTasksSql="UPDATE ocv_after.jobs SET state='failed',result='{\"reason\":\"expired\"}',updated_at=now() WHERE (state='queued' AND created_at<now()-($1::integer*interval '1 second')) OR (state IN('starting','running') AND updated_at<now()-interval '25 minutes')";
