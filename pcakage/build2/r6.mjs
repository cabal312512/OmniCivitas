export const GIANT_ROLES=Object.freeze([
 {kind:'walker',hostile:true,flying:false,hp:42,height:56,speed:13,color:0xe2ecf1,attack:'stomp'},
 {kind:'manta',hostile:false,flying:true,hp:26,height:175,speed:19,color:0xb4e7ed,attack:null},
 {kind:'leviathan',hostile:true,flying:true,hp:64,height:125,speed:15,color:0x96cae8,attack:'salvo'},
 {kind:'snail',hostile:false,flying:false,hp:30,height:28,speed:8,color:0xccddd3,attack:null},
 {kind:'prism',hostile:true,flying:true,hp:38,height:85,speed:22,color:0xc8d9ed,attack:'beam'},
 {kind:'orchid',hostile:true,flying:false,hp:50,height:76,speed:11,color:0xe5dfef,attack:'mines'},
 {kind:'ram',hostile:true,flying:false,hp:58,height:44,speed:12,color:0xb7c9d4,attack:'charge'},
 {kind:'bell',hostile:true,flying:true,hp:52,height:110,speed:10,color:0xc4d8ef,attack:'well'},
 {kind:'lantern',hostile:false,flying:false,hp:34,height:48,speed:7,color:0xcbeae1,attack:null},
 {kind:'ribbon',hostile:false,flying:true,hp:36,height:205,speed:17,color:0xe1e8ef,attack:null},
].map(role=>Object.freeze(role)));
export const GIANT_KINDS=Object.freeze(GIANT_ROLES.map(role=>role.kind));
