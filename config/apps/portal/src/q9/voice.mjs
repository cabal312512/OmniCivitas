export function publicNickname(){try{const p=JSON.parse(localStorage.getItem('ocv.profile.v1')||'null');return typeof p?.nickname==='string'&&p.nickname.length<=32&&!/@|(?:\d[\s().-]*){7,}|[\x00-\x1f]/.test(p.nickname)?p.nickname.trim():'';}catch{return '';}}
export function withNickname(text){const name=publicNickname();return name&&!text.includes(name)&&Math.random()<.35?name+'，'+text:text;}
