import { test, expect } from 'vitest';
import { createTicTacToe, createMines, slide2048, create2048, createSnake, createBreakout, createGuess, createReaction, typingResult, createMemory, createQuietScore, shuffle } from '../config/apps/portal/src/game/model.mjs';
import { tools } from '../config/apps/portal/src/game/game.mjs';

test('phase 7 game catalogue covers exactly ten original game requirements', () => {
  expect(tools).toHaveLength(10); expect(tools.map(t => t.requirements).flat()).toEqual(Array.from({length:10},(_,i)=>`B${String(71+i).padStart(3,'0')}`)); expect(new Set(tools.map(t=>t.id)).size).toBe(10);
});
test('tic-tac-toe alternates turns, rejects occupied squares and terminates at a row victory', () => {
  const game=createTicTacToe();game.move(0);expect(game.move(0)).toMatchObject({turn:'O',board:['X','','','','','','','','']});[3,1,4,2].forEach(i=>game.move(i));expect(game.snapshot()).toMatchObject({state:'won',winner:'X'});expect(game.move(8).board[8]).toBe('');
});
test('tic-tac-toe recognizes columns, both diagonals and a genuine draw', () => {
  for(const sequence of [[0,1,3,2,6],[0,1,4,2,8],[2,0,4,1,6]]){const game=createTicTacToe();sequence.forEach(i=>game.move(i));expect(game.snapshot()).toMatchObject({state:'won',winner:'X'});}
  const game=createTicTacToe();[0,1,2,4,3,5,7,6,8].forEach(i=>game.move(i));expect(game.snapshot()).toMatchObject({state:'draw',winner:''});expect(()=>game.move(-1)).toThrow();
});
test('mines first reveal is safe, fixed board has 81 cells and ten mines', () => {
  const game=createMines(()=>.999999);const s=game.reveal(0);expect(s).toMatchObject({rows:9,columns:9,mineCount:10,state:'playing'});expect(s.cells).toHaveLength(81);expect(s.cells[0]).toMatchObject({open:true,value:3});expect(s.cells[1].value).toBeNull();const lost=game.reveal(1);expect(lost.state).toBe('lost');expect(lost.cells.filter(c=>c.value==='*')).toHaveLength(10);
});
test('mines flags do not reveal cells, toggles are bounded and flood fill reaches a real win', () => {
  const game=createMines(()=>.999999);for(let i=1;i<=11;i++)game.flag(i);expect(game.snapshot().flags).toBe(10);expect(game.reveal(1).opened).toBe(0);game.flag(1);expect(game.snapshot().flags).toBe(9);game.reveal(0);for(let i=11;i<=80;i++)game.reveal(i);expect(game.snapshot()).toMatchObject({state:'won',opened:71});expect(()=>game.reveal(81)).toThrow();
});
test('2048 merges each original tile at most once and reports only merge score', () => {
  expect(slide2048([2,2,2,2,...Array(12).fill(0)],'left')).toMatchObject({board:[4,4,0,0,...Array(12).fill(0)],gained:8,changed:true});
  expect(slide2048([2,2,4,0,...Array(12).fill(0)],'left').board.slice(0,4)).toEqual([4,4,0,0]);
});
test('2048 uses correct horizontal and vertical orientation', () => {
  const board=[2,0,2,0,2,0,0,0,...Array(8).fill(0)];expect(slide2048(board,'right').board.slice(0,4)).toEqual([0,0,0,4]);expect(slide2048(board,'up').board.slice(0,4)).toEqual([4,0,2,0]);expect(slide2048(board,'down').board.slice(12,16)).toEqual([4,0,2,0]);expect(()=>slide2048(Array(16).fill(3),'left')).toThrow();
});
test('2048 invalid moves do not spawn tiles or increment move count', () => {
  const game=create2048(()=>0);expect(game.snapshot().board.slice(0,4)).toEqual([2,2,0,0]);game.move('left');expect(game.snapshot()).toMatchObject({score:4,moves:1});expect(game.snapshot().board.slice(0,4)).toEqual([4,2,0,0]);game.move('left');expect(game.snapshot()).toMatchObject({score:4,moves:1});expect(game.snapshot().board.slice(0,4)).toEqual([4,2,0,0]);
});
test('2048 full unmergeable board has no valid direction', () => {
  const board=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];for(const direction of ['left','right','up','down'])expect(slide2048(board,direction).changed).toBe(false);
});
test('snake prevents instant reversal and multiple queued turns cannot reverse into the body', () => {
  const game=createSnake(()=>0);game.start();game.turn('left');game.step();expect(game.snapshot().body[0]).toEqual([7,9]);game.turn('up');game.turn('left');game.step();expect(game.snapshot().body[0]).toEqual([7,8]);expect(game.snapshot().direction).toBe('up');
});
test('snake actually eats placed food, grows once and relocates food outside its body', () => {
  const game=createSnake(()=>0);game.start();game.turn('up');for(let i=0;i<9;i++)game.step();game.turn('left');for(let i=0;i<6;i++)game.step();const s=game.snapshot();expect(s).toMatchObject({score:1,state:'playing'});expect(s.body).toHaveLength(4);expect(s.body[0]).toEqual([0,0]);expect(s.body.some(([x,y])=>x===s.food[0]&&y===s.food[1])).toBe(false);
});
test('snake pauses without moving and a wall collision ends the game', () => {
  const game=createSnake();const initial=game.snapshot();game.step();expect(game.snapshot()).toEqual(initial);game.start();for(let i=0;i<18;i++)game.step();expect(game.snapshot().state).toBe('lost');const end=game.snapshot();game.start();game.step();expect(game.snapshot()).toEqual(end);
});
test('snake permits moving into the old tail when it vacates on that step', () => {
  const game=createSnake(()=>.99999);game.start();game.turn('up');game.step();game.turn('left');game.step();game.turn('down');game.step();expect(game.snapshot().state).toBe('playing'); // the vacating tail is safe
  game.turn('right');game.step();expect(game.snapshot().state).toBe('playing');
});
test('snake detects a genuine occupied-body collision after food grows its body', () => {
  const game=createSnake(()=>0);game.start();game.turn('up');for(let i=0;i<9;i++)game.step();game.turn('left');for(let i=0;i<6;i++)game.step();game.turn('down');game.step();game.turn('right');for(let i=0;i<4;i++)game.step();game.turn('up');game.step();expect(game.snapshot().score).toBe(2);game.turn('left');game.step();game.turn('down');game.step();expect(game.snapshot().state).toBe('lost');
});
test('breakout has one finite 24-brick level, bounded paddle and real ball movement', () => {
  const game=createBreakout();expect(game.snapshot().bricks).toHaveLength(24);game.move(-1000);expect(game.snapshot().paddle).toBe(0);game.move(1000);expect(game.snapshot().paddle).toBe(396);game.move(198);const before=game.snapshot().ball;game.start();game.step(40);expect(game.snapshot().ball.x).toBeCloseTo(before.x+6.2);expect(game.snapshot().ball.y).toBeCloseTo(before.y-9);
});
test('breakout collides with actual bricks and score equals destroyed bricks', () => {
  const game=createBreakout();game.start();for(let i=0;i<65;i++)game.step(16);const s=game.snapshot();expect(s.score).toBeGreaterThan(0);expect(s.score).toBe(s.bricks.filter(b=>!b.alive).length);expect(s.ball.vy).toBeGreaterThan(0);
});
test('breakout pause freezes physics, huge frame gaps are bounded and invalid times rejected', () => {
  const first=createBreakout(),second=createBreakout();first.start();second.start();first.step(999999);second.step(100);expect(first.snapshot()).toEqual(second.snapshot());first.pause();const paused=first.snapshot();first.step(100);expect(first.snapshot()).toEqual(paused);expect(()=>first.step(-1)).toThrow();expect(()=>first.step(Infinity)).toThrow();
});
test('breakout exhausted lives terminate rather than allocating another level or ball loop', () => {
  const game=createBreakout();for(let life=0;life<3;life++){game.move(0);game.start();for(let tick=0;tick<1000&&game.snapshot().state==='playing';tick++)game.step(16);}
  expect(game.snapshot()).toMatchObject({state:'lost',lives:0});const finished=game.snapshot();game.start();game.step(100);expect(game.snapshot()).toEqual(finished);
});
test('guess number keeps its answer hidden until a correct guess and gives genuine ordering hints', () => {
  const game=createGuess(()=>.5);expect(game.snapshot()).not.toHaveProperty('answer');expect(game.guess('20').hint).toBe('太小');expect(game.guess('99').hint).toBe('太大');expect(game.guess('51')).toMatchObject({state:'won',answer:51,attempts:3});expect(game.guess('2').attempts).toBe(3);
});
test('guess number rejects blanks, non-integers and out-of-range values without counting attempts', () => {
  const game=createGuess(()=>0);for(const input of ['',' ','0','101','2.5','NaN'])expect(()=>game.guess(input)).toThrow();expect(game.snapshot().attempts).toBe(0);expect(game.guess('1').state).toBe('won');
});
test('reaction test distinguishes early presses from genuine monotonic reaction time', () => {
  let now=100;const game=createReaction(()=>now);game.start();expect(game.press().state).toBe('early');game.start();now=1000;game.ready();now=1234.5;expect(game.press()).toEqual({state:'done',elapsed:234.5});now=2000;expect(game.press().elapsed).toBe(234.5);
});
test('reaction cancellation invalidates a hidden pending round and stale ready calls cannot revive it', () => {
  const game=createReaction();game.start();game.cancel();expect(game.ready()).toEqual({state:'idle',elapsed:null});
});
test('typing measures Unicode characters, elapsed time and positional accuracy without claiming language analysis', () => {
  expect(typingResult('A🌍B','A🌍B',2000)).toEqual({characters:3,elapsed:2000,correct:3,accuracy:100,perMinute:90});expect(typingResult('ABC','ABX',1000).accuracy).toBeCloseTo(200/3);expect(typingResult('AB','ABC',1000).accuracy).toBeCloseTo(200/3);expect(typingResult('AB','',0)).toMatchObject({characters:0,perMinute:0,accuracy:0});
});
test('memory is exactly 4x4 with eight pairs, hides values and does not count re-clicks', () => {
  const game=createMemory(()=>.999999);expect(game.snapshot().cards).toHaveLength(16);expect(game.snapshot().cards.every(c=>c.value===null)).toBe(true);game.flip(0);game.flip(0);expect(game.snapshot().moves).toBe(0);game.flip(1);expect(game.snapshot().moves).toBe(1);game.flip(2);expect(game.snapshot().cards[2].open).toBe(false);game.hide();expect(game.snapshot().cards.every(c=>!c.open)).toBe(true);
});
test('memory matches genuine pairs and reaches a finite win with eight legal turns', () => {
  const game=createMemory(()=>.999999);for(let i=0;i<8;i++){game.flip(i);game.flip(i+8);}expect(game.snapshot()).toMatchObject({state:'won',moves:8,matched:16});expect(game.snapshot().cards.map(c=>c.value)).toEqual([1,2,3,4,5,6,7,8,1,2,3,4,5,6,7,8]);expect(()=>game.flip(16)).toThrow();
});
test('do-not-press score grows with actual active seconds, resets to zero and excludes hidden intervals', () => {
  let now=1000;const game=createQuietScore(()=>now);now+=3200;expect(game.snapshot().score).toBe(3);game.pause();now+=60000;expect(game.snapshot().score).toBe(3);game.resume();now+=1200;expect(game.snapshot().score).toBe(4);expect(game.press()).toMatchObject({score:0,resets:1});now+=999;expect(game.snapshot().score).toBe(0);now++;expect(game.snapshot().score).toBe(1);
});
test('random shuffling preserves every item without in-place mutation', () => {
  const original=[1,2,3,4,5];const changed=shuffle(original,()=>0);expect(changed).not.toEqual(original);expect([...changed].sort()).toEqual(original);expect(original).toEqual([1,2,3,4,5]);
});
