const bilingual = (en, zh) => Object.freeze({ en, zh });

const star = (id, en, zh, descriptionEn, descriptionZh, aliases = []) =>
  Object.freeze({
    id,
    en,
    zh,
    aliases: Object.freeze(aliases),
    description: bilingual(descriptionEn, descriptionZh),
  });

export const STAR_IDENTITIES = Object.freeze([
  star(
    32349,
    "Sirius",
    "天狼星",
    "The brightest star in Earth's night sky. Its faint companion, Sirius B, is a white dwarf.",
    "地球夜空中最亮的恒星。它暗弱的伴星天狼星 B 是一颗白矮星。",
    ["Dog Star", "α CMa"],
  ),
  star(
    91262,
    "Vega",
    "织女星",
    "The brilliant anchor of Lyra. Together with Altair and Deneb, it forms the Summer Triangle.",
    "天琴座明亮的标志星，与牛郎星和天津四组成夏季大三角。",
    ["α Lyr"],
  ),
  star(
    11767,
    "Polaris",
    "北极星",
    "Close to the north celestial pole, Polaris is a useful direction marker. It is not the brightest star in the sky.",
    "它接近北天极，是辨认北方的方便标志；北极星并不是夜空中最亮的恒星。",
    ["North Star", "勾陈一", "α UMi"],
  ),
  star(
    27989,
    "Betelgeuse",
    "参宿四",
    "A red supergiant at Orion's shoulder. Its changing brightness makes it a well-known variable star.",
    "位于猎户肩部的红超巨星，亮度会随时间变化。",
    ["α Ori"],
  ),
  star(
    24436,
    "Rigel",
    "参宿七",
    "A brilliant blue-white star at Orion's foot. Its color contrasts with the reddish Betelgeuse across the constellation.",
    "猎户脚部明亮的蓝白色恒星，与另一侧偏红的参宿四形成鲜明对比。",
    ["β Ori"],
  ),
  star(
    69673,
    "Arcturus",
    "大角星",
    "An orange-red giant in Boötes. Its warm color stands out among the surrounding northern stars.",
    "牧夫座中的橙红色巨星，温暖的色调在周围星群中十分醒目。",
    ["α Boo"],
  ),
  star(
    97649,
    "Altair",
    "牛郎星",
    "Aquila's bright central star and one corner of the Summer Triangle. It rotates so rapidly that its shape is flattened.",
    "天鹰座的明亮主星，也是夏季大三角的一角；快速自转让它呈现扁球形。",
    ["河鼓二", "α Aql"],
  ),
  star(
    102098,
    "Deneb",
    "天津四",
    "The bright tail of Cygnus, the Swan. It joins Vega and Altair in the Summer Triangle.",
    "位于天鹅尾部的亮星，与织女星和牛郎星组成夏季大三角。",
    ["α Cyg"],
  ),
  star(
    80763,
    "Antares",
    "心宿二",
    "A red supergiant at the heart of Scorpius. Its reddish glow is a striking contrast to nearby blue-white stars.",
    "位于天蝎心脏位置的红超巨星，红色光芒与附近蓝白色恒星形成对比。",
    ["α Sco"],
  ),
  star(
    65474,
    "Spica",
    "角宿一",
    "Virgo's bright blue-white landmark. It is an easy starting point for tracing the constellation's long outline.",
    "室女座醒目的蓝白色亮星，可以从这里辨认星座舒展的轮廓。",
    ["α Vir"],
  ),
  star(
    21421,
    "Aldebaran",
    "毕宿五",
    "A red giant marking the eye of Taurus. Its orange glow is a familiar landmark near Orion.",
    "标记金牛眼睛的红巨星，橙色光芒是猎户座附近醒目的夜空标志。",
    ["α Tau"],
  ),
  star(
    24608,
    "Capella",
    "五车二",
    "Auriga's bright golden point is a multiple-star system. Its prominent central pair consists of two giant stars.",
    "御夫座这颗金色亮星实际是多星系统，其中最显著的一对由两颗巨星组成。",
    ["α Aur"],
  ),
  star(
    113368,
    "Fomalhaut",
    "北落师门",
    "A bright star in the Southern Fish. Telescopes have revealed dusty debris belts surrounding it.",
    "南鱼座的亮星，望远镜发现它周围存在由尘埃与碎屑构成的带状结构。",
    ["α PsA"],
  ),
  star(
    37279,
    "Procyon",
    "南河三",
    "Canis Minor's bright star has a faint white-dwarf companion. It forms the Winter Triangle with Sirius and Betelgeuse.",
    "小犬座的亮星拥有一颗暗弱的白矮伴星，与天狼星、参宿四组成冬季大三角。",
    ["α CMi"],
  ),
  star(
    30438,
    "Canopus",
    "老人星",
    "A brilliant southern star in Carina. Its far-southern position means it stays below the horizon at many northern locations.",
    "船底座的明亮南天恒星；由于位置偏南，在许多北方地点始终位于地平线以下。",
    ["α Car"],
  ),
  star(
    7588,
    "Achernar",
    "水委一",
    "The bright southern end of the winding constellation Eridanus. Look far south of Orion to find it.",
    "位于蜿蜒波江座南端的亮星，需要沿着星座向猎户座以南很远处寻找。",
    ["α Eri"],
  ),
  star(
    37826,
    "Pollux",
    "北河三",
    "The warmer-colored member of Gemini's famous pair. Compare its golden hue with neighboring Castor.",
    "双子座著名双星标志中颜色较暖的一颗，可以比较它的金色与邻近北河二的色调。",
    ["β Gem"],
  ),
  star(
    36850,
    "Castor",
    "北河二",
    "One of Gemini's two bright head stars. Its paler color helps distinguish it from neighboring Pollux.",
    "双子座两颗明亮头部恒星之一，较浅的色调使它容易与邻近北河三区分。",
    ["α Gem"],
  ),
  star(
    49669,
    "Regulus",
    "轩辕十四",
    "A bright star at the base of Leo's curved head. It makes a useful anchor for finding the Lion's outline.",
    "狮子座弯曲头部底端的亮星，是辨认狮子轮廓的方便起点。",
    ["α Leo"],
  ),
  star(
    65378,
    "Mizar",
    "开阳",
    "A star in the bend of the Big Dipper's handle. Look nearby for its fainter visual neighbor, Alcor.",
    "位于北斗斗柄弯折处，附近可以找到更暗的视觉邻星辅星。",
    ["ζ UMa"],
  ),
  star(
    54061,
    "Dubhe",
    "天枢",
    "One of the Big Dipper's two pointer stars. A line from Merak through Dubhe leads toward Polaris.",
    "北斗两颗指极星之一，从天璇经过天枢延伸，可以找到北极星。",
    ["α UMa"],
  ),
  star(
    60718,
    "Acrux",
    "十字架二",
    "A brilliant blue-white point at the foot of the Southern Cross. The Cross is a familiar southern-sky direction guide.",
    "南十字长轴底部明亮的蓝白色恒星，南十字是南天著名的辨向标志。",
    ["α Cru"],
  ),
  star(
    71683,
    "Rigil Kentaurus",
    "南门二 A",
    "The brighter catalogue component of Alpha Centauri. The neighboring Toliman entry represents the system's other bright component.",
    "半人马座 α 星较亮的目录分量，邻近的托利曼条目表示该系统另一颗明亮分量。",
    ["Alpha Centauri A", "α Cen A", "南门二"],
  ),
  star(
    71681,
    "Toliman",
    "南门二 B",
    "A companion component of Alpha Centauri. At the scale of an ordinary sky view, the pair appears almost at the same point.",
    "半人马座 α 星的伴星分量；在普通天幕尺度下，这一对恒星几乎出现在同一个位置。",
    ["Alpha Centauri B", "α Cen B", "托利曼"],
  ),
]);

const cabal312512StarLookup = new Map(
  STAR_IDENTITIES.map((item) => [String(item.id), item]),
);

export const POPULAR_STAR_IDS = Object.freeze(
  STAR_IDENTITIES.map((item) => item.id),
);

export const CONSTELLATION_DESCRIPTIONS = Object.freeze({
  And: bilingual(
    "A chain of stars adjoining Pegasus. Alpheratz marks the end nearest the Great Square.",
    "紧邻飞马座的一串恒星，壁宿二标记了靠近飞马大四边形的一端。",
  ),
  Ant: bilingual(
    "A faint southern figure named for an air pump. Its few connected stars form an open angle.",
    "以空气泵命名的暗淡南天星座，几颗连线恒星构成一个敞开的夹角。",
  ),
  Aps: bilingual(
    "A compact far-southern constellation representing a bird of paradise.",
    "代表极乐鸟的紧凑南天星座，位置非常接近南天极区域。",
  ),
  Aqr: bilingual(
    "The Water Bearer stretches across a broad part of the sky. Its outline is made mainly of relatively faint stars.",
    "宝瓶座的轮廓横跨一片广阔天区，主要由相对暗淡的恒星组成。",
  ),
  Aql: bilingual(
    "The Eagle is anchored by Altair. Two nearby stars form a short line through this bright Summer Triangle landmark.",
    "天鹰座以牛郎星为醒目标志，邻近两颗恒星与它构成一条短线。",
  ),
  Ara: bilingual(
    "The Altar is a compact southern figure. Its connected stars form a bent loop.",
    "天坛座是紧凑的南天星座，连线恒星构成弯折的环状轮廓。",
  ),
  Ari: bilingual(
    "The Ram is recognizable as a short bent line of stars, with bright Hamal near one end.",
    "白羊座可以辨认为一条短而弯折的星线，较亮的娄宿三位于一端附近。",
  ),
  Aur: bilingual(
    "Auriga's broad outline is crowned by Capella. Its bright stars make a useful landmark north of Taurus.",
    "御夫座宽阔的轮廓以五车二为醒目标志，位于金牛座以北。",
  ),
  Boo: bilingual(
    "A kite-like northern figure anchored by warm-colored Arcturus.",
    "牧夫座呈风筝般的北天轮廓，暖色的大角星是最醒目的标志。",
  ),
  Cae: bilingual(
    "A small southern figure representing a sculptor's engraving tool. Its faint stars form a narrow chain.",
    "代表雕刻工具的小型南天星座，暗淡恒星构成狭长的星链。",
  ),
  Cam: bilingual(
    "The Giraffe occupies a high northern sky region. Its outline is easier to trace after neighboring bright constellations are found.",
    "鹿豹座位于偏北天区，可以先辨认邻近亮星座，再追踪它较暗的轮廓。",
  ),
  Cnc: bilingual(
    "A faint branching figure between Gemini and Leo. None of its main stars rivals its bright neighbors.",
    "巨蟹座是双子座与狮子座之间较暗的分叉轮廓，主星没有邻近星座的亮星醒目。",
  ),
  CVn: bilingual(
    "The Hunting Dogs are drawn here as a simple two-star line south of the Big Dipper.",
    "猎犬座在这里以一条简洁的双星连线表示，位于北斗以南。",
  ),
  CMa: bilingual(
    "The Greater Dog contains Sirius, the brightest night-sky star. Its outline extends southward from this brilliant point.",
    "大犬座包含夜空最亮的恒星天狼星，其轮廓从这颗亮星向南展开。",
  ),
  CMi: bilingual(
    "The Lesser Dog has a short, simple outline. Bright Procyon is its easiest landmark.",
    "小犬座的轮廓短而简单，南河三是最容易辨认的标志。",
  ),
  Cap: bilingual(
    "The Sea Goat is traced as a broad, angular outline. Its principal stars are less conspicuous than nearby bright sky landmarks.",
    "摩羯座呈宽阔的折角轮廓，主要恒星没有附近的夜空亮星那么醒目。",
  ),
  Car: bilingual(
    "The Keel is a sprawling southern figure anchored by Canopus.",
    "船底座的轮廓在南天舒展展开，老人星是最明亮的标志。",
  ),
  Cas: bilingual(
    "A familiar W-shaped group in the northern sky. Its apparent orientation changes as the sky turns.",
    "北天熟悉的 W 形星群，随着天幕转动，它看起来会改变朝向。",
  ),
  Cen: bilingual(
    "A broad southern figure containing the closely spaced Alpha Centauri components.",
    "半人马座的南天轮廓十分宽阔，包含位置极为接近的南门二恒星分量。",
  ),
  Cep: bilingual(
    "A house-like northern outline near Cassiopeia. Its stars surround a region close to the north celestial pole.",
    "仙王座的轮廓像一座小屋，紧邻仙后座，位置接近北天极区域。",
  ),
  Cet: bilingual(
    "A large figure representing a sea monster. Its long branches stretch across the sky south of Pisces.",
    "鲸鱼座的传统形象是海怪，长长的分支在双鱼座以南延展。",
  ),
  Cha: bilingual(
    "The Chameleon is a small figure deep in the southern sky, drawn as a low angular chain.",
    "蝘蜒座位于很偏南的天区，连线构成低矮的折角星链。",
  ),
  Cir: bilingual(
    "A narrow southern figure named for drawing compasses. Two slender arms meet at its main star.",
    "圆规座以绘图圆规命名，两条细长分支在主星处会合。",
  ),
  Col: bilingual(
    "The Dove is a southern constellation below the region of Orion. Its connected stars form a branching outline.",
    "天鸽座位于猎户座区域以南，连线恒星形成分叉轮廓。",
  ),
  Com: bilingual(
    "Berenice's Hair is represented by a sparse outline. Its understated stars contrast with nearby Arcturus and the Lion.",
    "后发座的连线轮廓稀疏，较暗的恒星与附近大角星和狮子座形成对比。",
  ),
  CrA: bilingual(
    "The Southern Crown is a compact curved chain of stars beneath Sagittarius.",
    "南冕座是一段紧凑的弧形星链，位于人马座以南。",
  ),
  CrB: bilingual(
    "The Northern Crown forms a small arc beside Boötes. Its shape is easy to recognize once Arcturus is found.",
    "北冕座在牧夫座旁形成一段小弧线，可以先找到大角星，再辨认这顶王冠。",
  ),
  Crv: bilingual(
    "The Crow is a compact angular figure south of Virgo. Its simple outline makes it a handy nearby landmark.",
    "乌鸦座位于室女座以南，紧凑的折角轮廓便于辨认。",
  ),
  Crt: bilingual(
    "The Cup is drawn as an open vessel-shaped figure above Hydra's long body.",
    "巨爵座以敞开的杯状轮廓表示，位于长蛇座的长躯体上方。",
  ),
  Cru: bilingual(
    "The Southern Cross is a compact, bright direction guide. Its long axis can help locate the south celestial pole.",
    "南十字座是明亮而紧凑的辨向标志，长轴可以帮助寻找南天极。",
  ),
  Cyg: bilingual(
    "Cygnus spreads across the sky as the Northern Cross. Deneb marks the Swan's tail and a Summer Triangle corner.",
    "天鹅座展开成北十字形，天津四标记天鹅尾部，也是夏季大三角的一角。",
  ),
  Del: bilingual(
    "The Dolphin is a small diamond-like group with a short tail, close to the region of Aquila.",
    "海豚座由一小段菱形星群和短尾巴组成，靠近天鹰座区域。",
  ),
  Dor: bilingual(
    "A far-southern constellation representing a fish. Its outline is a short, gently bent chain.",
    "剑鱼座代表一条鱼，位于偏南天区，轮廓是一条略微弯折的短星链。",
  ),
  Dra: bilingual(
    "The Dragon winds through the northern sky. Its long chain curls around the region of the Little Bear.",
    "天龙座在北天蜿蜒伸展，长长的星链绕过小熊座所在的区域。",
  ),
  Equ: bilingual(
    "The Little Horse is a very compact figure near Pegasus, built from a few faint stars.",
    "小马座靠近飞马座，少量暗星构成一个非常紧凑的轮廓。",
  ),
  Eri: bilingual(
    "The River is a long winding star chain. It reaches from the region of Orion far into the southern sky.",
    "波江座是一条很长的蜿蜒星链，从猎户座附近一直延伸到遥远的南天。",
  ),
  For: bilingual(
    "The Furnace is a faint southern constellation. Its main outline is a simple bend of three stars.",
    "天炉座是较暗的南天星座，主要轮廓由三颗恒星构成简单的弯折。",
  ),
  Gem: bilingual(
    "The Twins are recognized by Castor and Pollux. Two long chains extend from these bright head stars.",
    "双子座以北河二与北河三为标志，两条长星链从明亮的头部恒星展开。",
  ),
  Gru: bilingual(
    "The Crane is a southern branching figure. Its long central line suggests a slender neck and body.",
    "天鹤座是南天的分叉轮廓，细长的中央星线勾勒出颈部与身体。",
  ),
  Her: bilingual(
    "Hercules has a central four-star Keystone. Long arms and legs branch outward from this recognizable shape.",
    "武仙座中央有四星构成的楔形轮廓，长长的四肢从这里向外展开。",
  ),
  Hor: bilingual(
    "The Clock is a faint southern figure, drawn as a narrow zigzag.",
    "时钟座是较暗的南天星座，连线形成狭长的锯齿形轮廓。",
  ),
  Hya: bilingual(
    "The Water Snake is an exceptionally long star chain. A small head gives way to a body stretching far across the sky.",
    "长蛇座的星链非常长，小巧的头部连着横跨广阔天区的躯体。",
  ),
  Hyi: bilingual(
    "The Lesser Water Snake is a separate far-southern figure. Its main stars make a broad triangle.",
    "水蛇座是独立的偏南星座，主要恒星形成一个宽阔三角形。",
  ),
  Ind: bilingual(
    "A southern constellation with an angular branching outline, traditionally named Indus.",
    "印第安座位于南天，恒星连线形成带有分支的折角轮廓。",
  ),
  Lac: bilingual(
    "The Lizard is a narrow zigzag of stars between Cygnus and Cassiopeia.",
    "蝎虎座是天鹅座与仙后座之间一段狭长的锯齿状星链。",
  ),
  Leo: bilingual(
    "The Lion's curved head resembles a backward question mark. Regulus anchors one end, with the body extending toward Denebola.",
    "狮子座弯曲的头部像反向问号，轩辕十四位于一端，躯体向五帝座一延伸。",
  ),
  LMi: bilingual(
    "The Lesser Lion is a modest northern star chain above Leo's much brighter outline.",
    "小狮座是一段不太醒目的北天星链，位于更明亮的狮子座轮廓以北。",
  ),
  Lep: bilingual(
    "The Hare is a compact figure immediately south of Orion. Several short branches form its outline.",
    "天兔座紧邻猎户座南侧，是由几段短分支构成的紧凑轮廓。",
  ),
  Lib: bilingual(
    "The Scales have a broad angular outline between Virgo and Scorpius.",
    "天秤座位于室女座与天蝎座之间，构成宽阔的折角轮廓。",
  ),
  Lup: bilingual(
    "The Wolf is a densely branched southern outline beside Centaurus.",
    "豺狼座紧邻半人马座，南天轮廓中有多条密集分支。",
  ),
  Lyn: bilingual(
    "The Lynx is a long, faint zigzag in the northern sky. Its outline rewards careful tracing between brighter neighbors.",
    "天猫座是北天一条暗淡而漫长的锯齿状星链，适合借助周围亮星逐段辨认。",
  ),
  Lyr: bilingual(
    "The Lyre is a small figure beside brilliant Vega. A compact parallelogram forms the main body of its outline.",
    "天琴座位于明亮的织女星旁，紧凑的平行四边形构成主要轮廓。",
  ),
  Men: bilingual(
    "Mensa is a sparse constellation deep in the southern sky, named for Table Mountain.",
    "山案座是南天深处稀疏的星座，以桌山命名。",
  ),
  Mic: bilingual(
    "The Microscope is a modest southern star chain. Its faint outline makes a quiet contrast to brighter surrounding figures.",
    "显微镜座是一段不太醒目的南天星链，暗淡轮廓与周围亮星座形成对比。",
  ),
  Mon: bilingual(
    "The Unicorn's faint branches lie between Orion and the two Dogs.",
    "麒麟座较暗的分支分布在猎户座、大犬座和小犬座之间。",
  ),
  Mus: bilingual(
    "The Fly is a compact far-southern figure, immediately south of the Southern Cross.",
    "苍蝇座是偏南天区的紧凑星座，紧邻南十字座南侧。",
  ),
  Nor: bilingual(
    "The Carpenter's Square is a small southern loop of stars.",
    "矩尺座的南天恒星连线构成一个小型回环，名称来自木工用的直角尺。",
  ),
  Oct: bilingual(
    "Octans contains the south celestial pole. Unlike the north, this region has no comparably bright pole star.",
    "南极座包含南天极，与北天不同，这个区域没有同样明亮的极星标志。",
  ),
  Oph: bilingual(
    "The Serpent Bearer spans a broad area above Scorpius. Serpens is arranged on either side of its outline.",
    "蛇夫座横跨天蝎座以北的广阔天区，巨蛇座分布在其两侧。",
  ),
  Ori: bilingual(
    "Three aligned Belt stars make Orion easy to recognize. Reddish Betelgeuse and blue-white Rigel frame the Hunter's body.",
    "排列整齐的腰带三星使猎户座很容易辨认，偏红的参宿四与蓝白色参宿七勾勒出躯体。",
  ),
  Pav: bilingual(
    "The Peacock is a broad far-southern figure with a long, bent body and branching tail.",
    "孔雀座在偏南天区形成宽阔轮廓，弯折的长躯体连接分叉的尾部。",
  ),
  Peg: bilingual(
    "The Winged Horse spreads out from the Great Square. One corner of that familiar square, Alpheratz, belongs to Andromeda.",
    "飞马座从大四边形向外舒展，熟悉的四边形中有一个角——壁宿二——属于仙女座。",
  ),
  Per: bilingual(
    "Perseus is a branching northern figure beside Cassiopeia and Andromeda.",
    "英仙座是带有多条分支的北天星座，紧邻仙后座和仙女座。",
  ),
  Phe: bilingual(
    "The Phoenix is a broad southern figure with several short branches forming a wing-like outline.",
    "凤凰座是宽阔的南天星座，几段短分支形成类似双翼的轮廓。",
  ),
  Pic: bilingual(
    "The Painter's Easel is represented by a slender southern chain of stars.",
    "绘架座代表画家的画架，在南天以细长的星链表示。",
  ),
  Psc: bilingual(
    "The Fishes are joined by a long angular cord. One end forms the small ring known as the Circlet.",
    "双鱼座的两部分通过长长的折角星线相连，其中一端构成小型环状星群。",
  ),
  PsA: bilingual(
    "The Southern Fish is anchored by Fomalhaut. Its outline extends to one side of this brilliant star.",
    "南鱼座以北落师门为醒目标志，星座轮廓从这颗亮星向一侧展开。",
  ),
  Pup: bilingual(
    "The Stern is a sprawling southern constellation. Together with Carina and Vela, its name recalls parts of a ship.",
    "船尾座在南天舒展展开，它与船底座、船帆座的名称分别对应船的不同部分。",
  ),
  Pyx: bilingual(
    "The Compass is a short southern star chain beside Puppis.",
    "罗盘座是船尾座旁一段简短的南天星链。",
  ),
  Ret: bilingual(
    "The Reticle is a compact southern figure. Its main stars form a small angular loop.",
    "网罟座是紧凑的南天星座，主要恒星构成一个小型折角环。",
  ),
  Sge: bilingual(
    "The Arrow is a tiny, distinctive figure near Aquila. A split tail connects to a short shaft.",
    "天箭座是天鹰座附近小巧而鲜明的星群，分叉尾部连接一段短箭杆。",
  ),
  Sgr: bilingual(
    "Sagittarius includes the familiar Teapot pattern. Its many connected stars trace a busy region of the southern sky.",
    "人马座包含熟悉的茶壶形星群，多条恒星连线在南天形成丰富轮廓。",
  ),
  Sco: bilingual(
    "Scorpius curves around red Antares and ends in a hooked tail. Its shape is one of the sky's most recognizable outlines.",
    "天蝎座围绕红色心宿二弯曲展开，尾部呈钩状，是夜空中极易辨认的轮廓之一。",
  ),
  Scl: bilingual(
    "The Sculptor is a broad, faint southern star chain. Its main outline has a long open bend.",
    "玉夫座由宽阔而暗淡的南天星链组成，主要轮廓形成一个长长的敞开弯折。",
  ),
  Sct: bilingual(
    "The Shield is a compact angular figure near Aquila and Sagittarius.",
    "盾牌座位于天鹰座与人马座附近，构成紧凑的折角轮廓。",
  ),
  Ser: bilingual(
    "Serpens is one constellation split into a Head and a Tail. Ophiuchus lies between its two separate sky regions.",
    "巨蛇座是一个分为蛇头与蛇尾的星座，蛇夫座位于这两片独立天区之间。",
  ),
  Sex: bilingual(
    "The Sextant is a sparse figure south of Leo. Its faint main stars make a short open angle.",
    "六分仪座位于狮子座以南，稀疏的暗星构成一个短而敞开的夹角。",
  ),
  Tau: bilingual(
    "The Bull's V-shaped face is anchored by orange Aldebaran. Long horn-like branches reach toward the region of Auriga.",
    "金牛座的 V 形面部以橙色毕宿五为标志，长长的犄角向御夫座附近延伸。",
  ),
  Tel: bilingual(
    "The Telescope is a faint southern figure, drawn from a small number of connected stars.",
    "望远镜座是暗淡的南天星座，由少量恒星连线构成。",
  ),
  Tri: bilingual(
    "Three main stars make a simple northern triangle. Its compact geometric outline is easy to distinguish from longer star chains.",
    "三颗主要恒星构成一个简单的北天三角形，紧凑的几何轮廓与长星链很好区分。",
  ),
  TrA: bilingual(
    "The Southern Triangle is a separate bright geometric figure deep in the southern sky.",
    "南三角座是南天深处独立的三角形星群，几何轮廓明亮而鲜明。",
  ),
  Tuc: bilingual(
    "The Toucan is a far-southern constellation with a broad, branching outline.",
    "杜鹃座位于偏南天区，连线形成宽阔而带有分支的轮廓。",
  ),
  UMa: bilingual(
    "Ursa Major contains the Big Dipper, a familiar seven-star pattern. The Dipper is only part of the much larger Bear.",
    "大熊座包含熟悉的北斗七星，北斗只是更大熊形轮廓的一部分。",
  ),
  UMi: bilingual(
    "The Little Bear ends at Polaris, close to the north celestial pole. Its small dipper turns around this northern landmark.",
    "小熊座的尾端是接近北天极的北极星，小型斗状轮廓围绕这个北方标志转动。",
  ),
  Vel: bilingual(
    "The Sails have a broad southern outline. Their ship-themed name pairs with Carina, the Keel, and Puppis, the Stern.",
    "船帆座在南天形成宽阔轮廓，名称与船底座、船尾座共同呼应船的不同部分。",
  ),
  Vir: bilingual(
    "Virgo spreads out from blue-white Spica in a long branching figure.",
    "室女座从蓝白色角宿一向外舒展，形成修长的分叉轮廓。",
  ),
  Vol: bilingual(
    "The Flying Fish is a compact far-southern figure with several short connected branches.",
    "飞鱼座是偏南天区的紧凑星座，几段短分支相互连接。",
  ),
  Vul: bilingual(
    "The Fox is a faint, small figure near the Arrow and Cygnus.",
    "狐狸座是天箭座与天鹅座附近一片小巧而暗淡的星群。",
  ),
});

export function starIdentity(id) {
  return cabal312512StarLookup.get(String(id)) ?? null;
}

export function objectDescription(kind, id, language = "en") {
  const description =
    kind === "star"
      ? starIdentity(id)?.description
      : kind === "constellation"
        ? CONSTELLATION_DESCRIPTIONS[id]
        : null;
  return description?.[language === "zh" ? "zh" : "en"] ?? "";
}
