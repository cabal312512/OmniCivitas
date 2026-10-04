const random = () => globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : Math.random();
export const choose = (count, rng = random) => Math.min(count - 1, Math.max(0, Math.floor(rng() * count)));
export function shuffle(values, rng = random) { const copy = [...values]; for (let i = copy.length - 1; i > 0; i--) { const j = choose(i + 1, rng); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function createTicTacToe() {
  const board = Array(9).fill(''); let turn = 'X', state = 'playing', winner = '';
  const snapshot = () => ({ board: [...board], turn, state, winner });
  return { snapshot, move(index) { if (!Number.isInteger(index) || index < 0 || index > 8) throw Error('位置无效'); if (state !== 'playing' || board[index]) return snapshot(); board[index] = turn;
    if (lines.some(line => line.every(i => board[i] === turn))) { winner = turn; state = 'won'; } else if (board.every(Boolean)) state = 'draw'; else turn = turn === 'X' ? 'O' : 'X'; return snapshot(); } };
}
const neighbors = index => { const x = index % 9, y = Math.floor(index / 9), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < 9 && y + dy >= 0 && y + dy < 9) out.push((y + dy) * 9 + x + dx); return out; };
export function createMines(rng = random) {
  const mines = new Set(), opened = new Set(), flags = new Set(); let state = 'ready';
  const snapshot = () => ({ state, rows: 9, columns: 9, mineCount: 10, flags: flags.size, opened: opened.size, cells: Array.from({length:81}, (_, index) => ({ index, open: opened.has(index), flagged: flags.has(index), value: opened.has(index) ? mines.has(index) ? '*' : neighbors(index).filter(i => mines.has(i)).length : state === 'lost' && mines.has(index) ? '*' : null })) });
  const valid = i => { if (!Number.isInteger(i) || i < 0 || i >= 81) throw Error('位置无效'); };
  return { snapshot, flag(i) { valid(i); if (state === 'lost' || state === 'won' || opened.has(i)) return snapshot(); if (flags.has(i)) flags.delete(i); else if (flags.size < 10) flags.add(i); return snapshot(); }, reveal(i) { valid(i); if (state === 'lost' || state === 'won' || flags.has(i) || opened.has(i)) return snapshot();
    if (state === 'ready') { for (const m of shuffle(Array.from({length:81}, (_, n) => n).filter(n => n !== i), rng).slice(0,10)) mines.add(m); state = 'playing'; }
    if (mines.has(i)) { opened.add(i); state = 'lost'; return snapshot(); }
    const queue = [i], seen = new Set(); while (queue.length) { const n = queue.pop(); if (seen.has(n)) continue; seen.add(n); if (flags.has(n) || mines.has(n)) continue; opened.add(n); if (!neighbors(n).some(j => mines.has(j))) queue.push(...neighbors(n).filter(j => !seen.has(j))); }
    if (opened.size === 71) state = 'won'; return snapshot(); } };
}
export function slide2048(board, direction) {
  if (!['left','right','up','down'].includes(direction) || !Array.isArray(board) || board.length !== 16 || board.some(n => !Number.isInteger(n) || n < 0 || n && Math.log2(n) % 1)) throw Error('棋盘无效');
  const next = [...board]; let gained = 0;
  for (let row = 0; row < 4; row++) { const indexes = Array.from({length:4}, (_, col) => direction === 'left' ? row*4+col : direction === 'right' ? row*4+3-col : direction === 'up' ? col*4+row : (3-col)*4+row);
    const values = indexes.map(i => board[i]).filter(Boolean), merged = [];
    for (let i = 0; i < values.length; i++) { if (values[i] === values[i+1]) { const value = values[i]*2; merged.push(value); gained += value; i++; } else merged.push(values[i]); }
    indexes.forEach((i, col) => { next[i] = merged[col] || 0; }); }
  return { board: next, gained, changed: next.some((n,i) => n !== board[i]) };
}
export function create2048(rng = random) {
  let board = Array(16).fill(0), score = 0, moves = 0;
  const spawn = () => { const free = board.flatMap((n,i) => n ? [] : [i]); if (free.length) board[free[choose(free.length, rng)]] = rng() < 0.9 ? 2 : 4; };
  spawn(); spawn();
  const snapshot = () => ({ board: [...board], score, moves, won: board.some(n => n >= 2048), state: ['left','right','up','down'].some(dir => slide2048(board, dir).changed) ? 'playing' : 'lost' });
  return { snapshot, move(dir) { const result = slide2048(board, dir); if (result.changed) { board = result.board; score += result.gained; moves++; spawn(); } return snapshot(); } };
}
const directions = { left:[-1,0], right:[1,0], up:[0,-1], down:[0,1] };
export function createSnake(rng = random) {
  const size = 18; let body = [[6,9],[5,9],[4,9]], direction = 'right', queued = 'right', score = 0, state = 'paused', food;
  const place = () => { const free = []; for (let y=0;y<size;y++) for (let x=0;x<size;x++) if (!body.some(([a,b]) => a===x && b===y)) free.push([x,y]); food = free.length ? free[choose(free.length, rng)] : null; };
  place(); const snapshot = () => ({ size, body: body.map(p => [...p]), food: food ? [...food] : null, direction, score, state });
  return { snapshot, turn(dir) { if (!directions[dir]) throw Error('方向无效'); const [dx,dy] = directions[dir], [ox,oy] = directions[direction]; if (dx !== -ox || dy !== -oy) queued = dir; return snapshot(); }, start() { if (state === 'paused') state='playing'; return snapshot(); }, pause() { if (state === 'playing') state='paused'; return snapshot(); }, step() { if (state!=='playing') return snapshot(); direction=queued; const [dx,dy]=directions[direction], head=[body[0][0]+dx,body[0][1]+dy], eating=food && head[0]===food[0] && head[1]===food[1];
    const occupied = eating ? body : body.slice(0,-1); if (head[0]<0 || head[0]>=size || head[1]<0 || head[1]>=size || occupied.some(([x,y]) => x===head[0] && y===head[1])) { state='lost'; return snapshot(); }
    body.unshift(head); if (eating) { score++; place(); if (!food) state='won'; } else body.pop(); return snapshot(); } };
}
export function createBreakout() {
  const width=480,height=320,paddleWidth=84,radius=6; let paddle=198,ball={x:240,y:274,vx:155,vy:-225},lives=3,score=0,state='paused';
  const bricks=Array.from({length:24},(_,i)=>({x:24+(i%8)*55,y:36+Math.floor(i/8)*23,width:48,height:15,alive:true}));
  const snapshot=()=>({width,height,paddle,paddleWidth,radius,ball:{...ball},bricks:bricks.map(b=>({...b})),lives,score,state});
  function tick(dt) { ball.x+=ball.vx*dt; ball.y+=ball.vy*dt; if(ball.x<radius){ball.x=radius;ball.vx=Math.abs(ball.vx);} if(ball.x>width-radius){ball.x=width-radius;ball.vx=-Math.abs(ball.vx);} if(ball.y<radius){ball.y=radius;ball.vy=Math.abs(ball.vy);}
    if(ball.vy>0 && ball.y+radius>=292 && ball.y-radius<=303 && ball.x>=paddle-radius && ball.x<=paddle+paddleWidth+radius){ball.y=292-radius;const offset=(ball.x-(paddle+paddleWidth/2))/(paddleWidth/2);ball.vx=offset*245;ball.vy=-Math.sqrt(Math.max(18000,275*275-ball.vx*ball.vx));}
    for(const brick of bricks)if(brick.alive&&ball.x+radius>=brick.x&&ball.x-radius<=brick.x+brick.width&&ball.y+radius>=brick.y&&ball.y-radius<=brick.y+brick.height){brick.alive=false;score++;ball.vy=-ball.vy;break;}
    if(score===bricks.length)state='won'; else if(ball.y-radius>height){lives--;state=lives?'paused':'lost';ball={x:paddle+paddleWidth/2,y:274,vx:155,vy:-225};}}
  return {snapshot,move(x){if(!Number.isFinite(x))throw Error('位置无效');paddle=Math.max(0,Math.min(width-paddleWidth,x));if(state==='paused')ball.x=paddle+paddleWidth/2;return snapshot();},start(){if(state==='paused')state='playing';return snapshot();},pause(){if(state==='playing')state='paused';return snapshot();},step(milliseconds){if(!Number.isFinite(milliseconds)||milliseconds<0)throw Error('时间无效');const amount=Math.min(milliseconds,100),steps=Math.ceil(amount/8);for(let i=0;i<steps&&state==='playing';i++)tick(amount/steps/1000);return snapshot();}};
}
export function createGuess(rng = random) { const answer=choose(100,rng)+1;let attempts=0,state='playing',hint='1–100',last=null;
  const snapshot=()=>({state,attempts,hint,last,...(state==='won'?{answer}:{})});return{snapshot,guess(raw){const value=Number(raw);if(String(raw).trim()===''||!Number.isInteger(value)||value<1||value>100)throw Error('请输入 1–100 的整数');if(state==='won')return snapshot();if(attempts>=1000)throw Error('请重新运行');attempts++;last=value;if(value===answer){state='won';hint='猜中了';}else hint=value<answer?'太小':'太大';return snapshot();}}; }
export function createReaction(now = () => performance.now()) { let state='idle',readyAt=null,elapsed=null;
  const snapshot=()=>({state,elapsed});return{snapshot,start(){state='waiting';readyAt=elapsed=null;return snapshot();},ready(){if(state==='waiting'){state='ready';readyAt=now();}return snapshot();},press(){if(state==='waiting')state='early';else if(state==='ready'){elapsed=Math.max(0,now()-readyAt);state='done';}return snapshot();},cancel(){if(state==='waiting'||state==='ready'){state='idle';readyAt=elapsed=null;}return snapshot();}}; }
export function typingResult(target, typed, elapsed) { const expected=Array.from(target),characters=Array.from(typed),correct=characters.filter((value,i)=>value===expected[i]).length;return{characters:characters.length,elapsed:Math.max(0,elapsed),correct,accuracy:Math.max(expected.length,characters.length)?correct/Math.max(expected.length,characters.length)*100:100,perMinute:elapsed>0?characters.length*60000/elapsed:0}; }
export function createMemory(rng = random) { const values=shuffle(Array.from({length:16},(_,i)=>i%8+1),rng),matched=new Set();let open=[],moves=0,state='playing';const snapshot=()=>({state,moves,matched:matched.size,cards:values.map((value,i)=>({index:i,matched:matched.has(i),open:open.includes(i)||matched.has(i),value:open.includes(i)||matched.has(i)?value:null}))});
  return{snapshot,flip(i){if(!Number.isInteger(i)||i<0||i>15)throw Error('位置无效');if(state==='won'||open.length===2||matched.has(i)||open.includes(i))return snapshot();open.push(i);if(open.length===2){moves++;if(values[open[0]]===values[open[1]]){open.forEach(j=>matched.add(j));open=[];if(matched.size===16)state='won';}}return snapshot();},hide(){open=[];return snapshot();}}; }
export function createQuietScore(now = () => performance.now()) { let start=now(),bank=0,paused=false,resets=0;const elapsed=()=>bank+(paused?0:Math.max(0,now()-start));return{snapshot:()=>({score:Math.floor(elapsed()/1000),resets,state:paused?'paused':'playing'}),press(){bank=0;start=now();resets++;return this.snapshot();},pause(){if(!paused){bank=elapsed();paused=true;}return this.snapshot();},resume(){if(paused){start=now();paused=false;}return this.snapshot();}}; }
