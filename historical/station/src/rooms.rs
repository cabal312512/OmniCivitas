#[derive(Clone, Copy)]
pub struct Slot { pub id: u8, pub route: &'static str, pub say: &'static str, pub pitch: u8, pub x: u8, pub y: u8 }
macro_rules! slot { ($n:expr,$r:expr,$s:expr,$p:expr,$x:expr,$y:expr) => { Slot{id:$n,route:$r,say:$s,pitch:$p,x:$x,y:$y} }; }
pub const SLOTS: [Slot; 30] = [
 slot!(0,"/","ERR 0x00：此处没有入口。",64,73,62),
 slot!(1,"/functions/","Null corridor. Do not count the echoes.",67,18,74),
 slot!(2,"/portals/light/","しずかな欠損。まだ閉じていない。",60,82,38),
 slot!(3,"/portals/unified/","Vek-tora / nilum / ara-keth.",72,63,83),
 slot!(4,"/media/","这里的影子比页面先加载。",65,14,61),
 slot!(5,"/maze/","KERNEL PANIC · retour sans origine.",69,78,72),
 slot!(6,"/maze/cache/","缓存命中：不存在的昨天。",62,57,28),
 slot!(7,"/maze/cache/l1/","░▒▓ 7f:echo 00:00 ▓▒░",76,23,81),
 slot!(8,"/maze/cache/l1/l2/","Deux niveaux. Aucune sortie enregistrée.",61,86,62),
 slot!(9,"/maze/offices/settings/","문은 없는데 두드리는 소리가 난다.",70,28,38),
 slot!(10,"/maze/approval/","WARN: process survived its own deletion.",63,70,77),
 slot!(11,"/maze/display/","Ποιος άλλαξε τη σκιά;",74,83,54),
 slot!(12,"/maze/notifications/","ACK / ACK / ACK / 接收者为空。",66,16,84),
 slot!(13,"/maze/table/","这一格在等待一个删掉的名字。",71,62,36),
 slot!(14,"/maze/empty/","Vacío ocupado. No mirar dos veces.",58,39,67),
 slot!(15,"/maze/aside/","Thren-va; olum-kai; tor-em.",73,74,24),
 slot!(16,"/maze/window/","Close denied: something remains outside.",68,21,57),
 slot!(17,"/maze/route/","Der Rückweg hat keine Zeitstempel.",75,84,79),
 slot!(18,"/functions/json/","SyntaxError: expected silence, got echo.",65,59,73),
 slot!(19,"/functions/calculator/","Σ = 0；余项正在墙后增长。",67,27,84),
 slot!(20,"/functions/csv/","col[3] = ∅；读到了第零行的回声。",60,80,45),
 slot!(21,"/functions/regex/","RegExpError：捕获组里还有东西。",72,14,73),
 slot!(22,"/functions/base64/","decode: ⟦∅⟧ / шёпот без источника.",64,71,83),
 slot!(23,"/functions/markdown/","Titel fehlt. Die Seite antwortet trotzdem.",69,86,32),
 slot!(24,"/functions/image-crop/","边界以内，没有原图。",61,56,77),
 slot!(25,"/functions/sqlite/","SELECT echo FROM nowhere; -- 1 row",74,20,47),
 slot!(26,"/functions/pipeline/","La señal sigue debajo de la página.",66,79,70),
 slot!(27,"/functions/uuid/","UUID COLLISION：同一个空缺出现两次。",70,26,29),
 slot!(28,"/functions/hash/","Hash mismatch. Le reflet se souvient.",63,64,84),
 slot!(29,"/functions/xml/","Zhur-an / vel ekhra / 封口已失效。",76,82,58),
];
pub fn room_name(n: usize) -> &'static str { SLOTS[n % SLOTS.len()].say }
pub fn old_lookup(route: &str) -> Option<&'static Slot> { SLOTS.iter().find(|r| r.route == route) }
pub fn fold_ids(input: &[u8]) -> u32 { input.iter().filter(|n| **n < 30).fold(0,|a,n|a|(1<<n)) }
