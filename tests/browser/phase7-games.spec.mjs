import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { tools } from '../../config/apps/portal/src/game/game.mjs';
import { reports } from './report-location.mjs';

const proof=(info,name,value)=>fs.writeFileSync(path.join(reports,`phase7-${info.project.name}-${name}.json`),JSON.stringify(value,null,2));
const snapshot=async page=>JSON.parse(await page.locator('#tool-output').inputValue());
async function activate(page, selector) {await page.locator(selector).focus();await page.keyboard.press('Enter');}
async function enter(page,id){await page.emulateMedia({reducedMotion:'reduce'});const response=await page.goto(`/functions/${id}/`);expect(response.status()).toBe(200);await expect.poll(()=>page.evaluate(()=>window.__ocvTools?.id)).toBe(id);await activate(page,'[data-tool-front]');}
async function run(page){const count=await page.evaluate(()=>window.__ocvTools.runs);await activate(page,'#tool-run');await expect.poll(()=>page.evaluate(()=>window.__ocvTools.runs)).toBe(count+1);await expect.poll(()=>page.evaluate(()=>window.__ocvTools.busy)).toBe(false);await expect(page.locator('#tool-status')).toHaveAttribute('data-error','false');}
const action=name=>`[data-game-action="${name}"]`,cell=i=>`[data-game-cell="${i}"]`;

for(const tool of tools)test(`Phase 7 ${tool.requirements[0]} ${tool.id} default game has genuine board, output and lifecycle`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await enter(page,tool.id);await run(page);
  await expect(page.locator(`[data-game="${tool.id}"]`)).toBeVisible();const output=await page.locator('#tool-output').inputValue(),value=JSON.parse(output);
  if(tool.id==='tic-tac-toe')expect(value.board).toEqual(Array(9).fill(''));
  if(tool.id==='mines'){expect(value.cells).toHaveLength(81);expect(value.mineCount).toBe(10);}
  if(tool.id==='2048'){expect(value.board).toHaveLength(16);expect(value.board.filter(Boolean)).toHaveLength(2);}
  if(tool.id==='snake'){expect(value.body).toHaveLength(3);expect(value.state).toBe('paused');}
  if(tool.id==='breakout'){expect(value.bricks).toHaveLength(24);expect(value.state).toBe('paused');}
  if(tool.id==='guess-number')expect(value).not.toHaveProperty('answer');
  if(tool.id==='reaction-test')expect(value).toEqual({state:'idle',elapsed:null});
  if(tool.id==='typing-test')expect(value).toMatchObject({state:'ready',characters:0,elapsed:0,accuracy:0});
  if(tool.id==='memory'){expect(value.cards).toHaveLength(16);expect(value.cards.every(c=>c.value===null)).toBe(true);}
  if(tool.id==='do-not-press')expect(value).toMatchObject({resets:0,state:'playing'});
  const diagnostic=await page.evaluate(()=>window.__ocvTools);expect(Object.keys(diagnostic).sort()).toEqual(['id','runs','successes','busy','cancelled','lastTool','resultLength'].sort());expect(errors).toEqual([]);
  proof(info,`default-${tool.id}`,{id:tool.id,requirements:tool.requirements,output,outputLength:output.length,diagnostic,errors});
  await activate(page,'#tool-cancel');await expect(page.locator('#tool-lab')).toBeHidden();await expect(page.locator('#tool-output')).toHaveValue('');
});

test('Phase 7 B071 tic-tac-toe legal alternating moves win, draw, and download real final board',async({page},info)=>{
  await enter(page,'tic-tac-toe');await run(page);for(const i of [0,3,1,4,2])await activate(page,cell(i));
  const won=await snapshot(page);expect(won).toMatchObject({state:'won',winner:'X',board:['X','X','X','O','O','','','','']});await expect(page.locator(cell(8))).toBeDisabled();
  const canonical=await page.locator('#tool-output').inputValue(),downloading=page.waitForEvent('download');await activate(page,'#tool-export');const download=await downloading,saved=path.join(reports,`phase7-${info.project.name}-tic-tac-toe.json`);await download.saveAs(saved);expect(fs.readFileSync(saved,'utf8')).toBe(canonical);expect(download.suggestedFilename()).toBe('ocv-tic-tac-toe.json');
  await run(page);for(const i of [0,1,2,4,3,5,7,6,8])await activate(page,cell(i));expect(await snapshot(page)).toMatchObject({state:'draw',winner:''});proof(info,'game-tic-tac-toe',{won,draw:await snapshot(page),actualDownload:download.suggestedFilename(),canonical});
});
test('Phase 7 B072 mines has real first-safe reveal and flag control on a fixed 9x9 board',async({page},info)=>{
  await enter(page,'mines');await run(page);await expect(page.locator('[data-game-cell]')).toHaveCount(81);await activate(page,action('flag-mode'));await activate(page,cell(80));expect(await snapshot(page)).toMatchObject({flags:1,opened:0});await expect(page.locator(cell(80))).toHaveText('⚑');await activate(page,cell(80));await activate(page,action('flag-mode'));await activate(page,cell(40));
  const s=await snapshot(page);expect(['playing','won']).toContain(s.state);expect(s.cells[40].open).toBe(true);expect(s.cells[40].value).not.toBe('*');expect(s.opened).toBeGreaterThan(0);expect(s.cells.filter(c=>c.open).length).toBe(s.opened);proof(info,'game-mines',{...s,firstRevealWasSafe:true});
});
test('Phase 7 B073 2048 direction controls move and spawn actual tiles',async({page},info)=>{
  await enter(page,'2048');await run(page);const initial=await snapshot(page);for(const dir of ['left','up','right','down'])await activate(page,action(dir));const s=await snapshot(page);expect(s.moves).toBeGreaterThan(0);expect(s.board).not.toEqual(initial.board);expect(s.board.every(n=>n===0||Number.isInteger(Math.log2(n)))).toBe(true);expect(s.score).toBeGreaterThanOrEqual(0);await expect(page.locator('[data-game-cell]')).toHaveCount(16);proof(info,'game-2048',{initial,after:s,actualDirectionButtons:true});
});
test('Phase 7 B074 snake draws a real canvas, turns with native keys, and pauses actual movement',async({page},info)=>{
  await enter(page,'snake');await run(page);const initial=await snapshot(page);await activate(page,action('start'));await expect.poll(async()=> (await snapshot(page)).body[0][0]).toBeGreaterThan(initial.body[0][0]);await page.locator('.game-canvas').focus();await page.keyboard.press('ArrowUp');await expect.poll(async()=> (await snapshot(page)).body[0][1]).toBeLessThan(9);await activate(page,action('start'));const paused=await snapshot(page);expect(paused.state).toBe('paused');await page.waitForTimeout(350);expect(await snapshot(page)).toEqual(paused);proof(info,'game-snake',{initial,paused,nativeArrowTurn:true,canvasSize:await page.locator('.game-canvas').evaluate(n=>[n.width,n.height])});
});
test('Phase 7 B075 breakout moves its paddle and ball on real canvas with a single 24-brick level',async({page},info)=>{
  await enter(page,'breakout');await run(page);await page.locator('.game-canvas').focus();await page.keyboard.press('ArrowLeft');const controlled=await snapshot(page);expect(controlled.paddle).toBe(170);await activate(page,action('start'));await expect.poll(async()=> (await snapshot(page)).ball.y).toBeLessThan(controlled.ball.y);await activate(page,action('start'));const paused=await snapshot(page);expect(paused.state).toBe('paused');expect(paused.bricks).toHaveLength(24);await page.waitForTimeout(250);expect(await snapshot(page)).toEqual(paused);proof(info,'game-breakout',{controlled,paused,canvasSize:await page.locator('.game-canvas').evaluate(n=>[n.width,n.height]),nativeArrowControl:true});
});
test('Phase 7 B076 guess-number can actually be won using its displayed high/low hints',async({page},info)=>{
  await enter(page,'guess-number');await run(page);let low=1,high=100,final;
  for(let attempt=0;attempt<7;attempt++){const value=Math.floor((low+high)/2);await page.locator('[data-game-guess]').fill(String(value));await activate(page,action('guess'));final=await snapshot(page);if(final.state==='won')break;if(final.hint==='太小')low=value+1;else if(final.hint==='太大')high=value-1;else throw Error('没有真实提示');}
  expect(final.state).toBe('won');expect(final.answer).toBe(final.last);expect(final.attempts).toBeLessThanOrEqual(7);proof(info,'game-guess-number',{final,solvedOnlyFromDisplayedHints:true});
});
test('Phase 7 B077 reaction-test rejects early presses and measures actual ready-to-press milliseconds',async({page},info)=>{
  await enter(page,'reaction-test');await run(page);await activate(page,action('reaction'));await activate(page,action('reaction'));expect(await snapshot(page)).toMatchObject({state:'early',elapsed:null});await activate(page,action('reaction'));await expect(page.locator(action('reaction'))).toHaveAttribute('data-reaction-state','ready',{timeout:15000});await page.waitForTimeout(150);await activate(page,action('reaction'));const final=await snapshot(page);expect(final.state).toBe('done');expect(final.elapsed).toBeGreaterThanOrEqual(120);expect(final.elapsed).toBeLessThan(10000);proof(info,'game-reaction-test',{final,earlyPressRejected:true,genuineMonotonicClock:true});
});
test('Phase 7 B078 typing-test counts actual text characters, elapsed time and positional accuracy',async({page},info)=>{
  await enter(page,'typing-test');await run(page);const target=await page.locator('[data-typing-target]').innerText();await activate(page,action('start'));await page.locator('[data-game-typed]').pressSequentially(target,{delay:7});await page.waitForTimeout(180);await activate(page,action('finish'));const final=await snapshot(page);expect(final.state).toBe('done');expect(final.characters).toBe(Array.from(target).length);expect(final.correct).toBe(final.characters);expect(final.accuracy).toBe(100);expect(final.elapsed).toBeGreaterThanOrEqual(150);expect(final.perMinute).toBeCloseTo(final.characters*60000/final.elapsed,8);proof(info,'game-typing-test',{target,final,nativeSequentialTyping:true});
});
test('Phase 7 B079 memory-game can be won by observing sixteen real cards and matching eight pairs',async({page},info)=>{
  await enter(page,'memory');await run(page);const seen=new Map();
  for(let i=0;i<16;i+=2){for(const j of [i,i+1]){await activate(page,cell(j));const value=Number(await page.locator(cell(j)).innerText());expect(value).toBeGreaterThanOrEqual(1);expect(value).toBeLessThanOrEqual(8);seen.set(j,value);}const s=await snapshot(page);if(!s.cards[i].matched){await expect(page.locator(cell(i))).toHaveAttribute('data-open','false');await expect(page.locator(cell(i+1))).toHaveAttribute('data-open','false');}}
  for(let value=1;value<=8;value++){const indexes=[...seen].filter(([,v])=>v===value).map(([index])=>index);expect(indexes).toHaveLength(2);const s=await snapshot(page);if(!s.cards[indexes[0]].matched)for(const i of indexes)await activate(page,cell(i));}
  const final=await snapshot(page);expect(final).toMatchObject({state:'won',matched:16});expect(final.cards.every(c=>c.matched)).toBe(true);proof(info,'game-memory',{final,observedOnlyViaNativeFlips:true,pairCount:8});
});
test('Phase 7 B080 do-not-press resets real score and suspension, hidden state and cancel stop all work',async({page},info)=>{
  await enter(page,'do-not-press');await run(page);await expect.poll(async()=> (await snapshot(page)).score).toBeGreaterThanOrEqual(1);await activate(page,action('forbidden'));expect(await snapshot(page)).toMatchObject({score:0,resets:1});await expect.poll(async()=> (await snapshot(page)).score).toBeGreaterThanOrEqual(1);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));const suspended=await page.locator('#tool-output').inputValue();await page.waitForTimeout(1200);await expect(page.locator('#tool-output')).toHaveValue(suspended);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await expect.poll(async()=> (await snapshot(page)).score).toBeGreaterThan(JSON.parse(suspended).score);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await page.locator('#tool-output').inputValue();await page.waitForTimeout(1200);await expect(page.locator('#tool-output')).toHaveValue(hidden);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await activate(page,'#tool-cancel');await page.waitForTimeout(1200);await expect(page.locator('#tool-output')).toHaveValue('');await expect(page.locator('#tool-lab')).toBeHidden();
  proof(info,'game-score-lifecycle',{suspended,hidden,scoreReset:true,cancelled:true,syntheticPersistedEvents:true,simulatedHiddenGetter:true,claim:'Exercises actual hooks; not evidence of a real BFCache hit or OS suspension.'});
});
