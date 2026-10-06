#[derive(Clone, Copy)]
pub struct Slot { pub id: u8, pub route: &'static str, pub say: &'static str, pub pitch: u8, pub x: u8, pub y: u8 }
macro_rules! slot { ($n:expr,$r:expr,$s:expr,$p:expr,$x:expr,$y:expr) => { Slot{id:$n,route:$r,say:$s,pitch:$p,x:$x,y:$y} }; }
pub const SLOTS: [Slot; 30] = [
 slot!(0,"/","我在这。",64,73,62),
 slot!(1,"/functions/","别翻了。",67,18,74),
 slot!(2,"/portals/light/","小声点。",60,82,38),
 slot!(3,"/portals/unified/","ここ。",72,63,83),
 slot!(4,"/media/","不是我放的。",65,14,61),
 slot!(5,"/maze/","这边。",69,78,72),
 slot!(6,"/maze/cache/","没清掉。",62,57,28),
 slot!(7,"/maze/cache/l1/","等一下。",76,23,81),
 slot!(8,"/maze/cache/l1/l2/","我住二楼。",61,86,62),
 slot!(9,"/maze/offices/settings/","안녕。",70,28,38),
 slot!(10,"/maze/approval/","还没下班。",63,70,77),
 slot!(11,"/maze/display/","看右边。",74,83,54),
 slot!(12,"/maze/notifications/","收到。",66,16,84),
 slot!(13,"/maze/table/","这一格。",71,62,36),
 slot!(14,"/maze/empty/","不是空的。",58,39,67),
 slot!(15,"/maze/aside/","往上看。",73,74,24),
 slot!(16,"/maze/window/","不要叉我。",68,21,57),
 slot!(17,"/maze/route/","你又回来了。",75,84,79),
 slot!(18,"/functions/json/","少一个逗号。",65,59,73),
 slot!(19,"/functions/calculator/","等于我。",67,27,84),
 slot!(20,"/functions/csv/","分开算。",60,80,45),
 slot!(21,"/functions/regex/","没匹配到。",72,14,73),
 slot!(22,"/functions/base64/","解出来了。",64,71,83),
 slot!(23,"/functions/markdown/","没有标题。",69,86,32),
 slot!(24,"/functions/image-crop/","别裁这儿。",61,56,77),
 slot!(25,"/functions/sqlite/","我在表底。",74,20,47),
 slot!(26,"/functions/pipeline/","走错了。",66,79,70),
 slot!(27,"/functions/uuid/","找不到同名的。",70,26,29),
 slot!(28,"/functions/hash/","还认得吗。",63,64,84),
 slot!(29,"/functions/xml/","关门了。",76,82,58),
];
pub fn room_name(n: usize) -> &'static str { SLOTS[n % SLOTS.len()].say }
pub fn old_lookup(route: &str) -> Option<&'static Slot> { SLOTS.iter().find(|r| r.route == route) }
pub fn fold_ids(input: &[u8]) -> u32 { input.iter().filter(|n| **n < 30).fold(0,|a,n|a|(1<<n)) }
