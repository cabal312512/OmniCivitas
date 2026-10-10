# Planetarium object notes

The selected-object card contains short, original English and Chinese descriptions for 24 recognizable stars and all 88 constellation identifiers in the bundled catalogue. Each note is one or two sentences. They emphasize identification, color, familiar shapes, and a few established stellar properties; they do not present the planetarium as a precision observing instrument.

## Catalogue identity

Stars are keyed by the existing Hipparcos identifiers in `config/apps/portal/public/planetarium/assets/stars.json`. No coordinates, magnitudes, constellation geometry, or original catalogue entries are changed to provide the notes. The 24 selected English names were checked against their actual catalogue records.

| HIP identifier | English name | Chinese display name |
| --- | --- | --- |
| 32349 | Sirius | 天狼星 |
| 91262 | Vega | 织女星 |
| 11767 | Polaris | 北极星 |
| 27989 | Betelgeuse | 参宿四 |
| 24436 | Rigel | 参宿七 |
| 69673 | Arcturus | 大角星 |
| 97649 | Altair | 牛郎星 |
| 102098 | Deneb | 天津四 |
| 80763 | Antares | 心宿二 |
| 65474 | Spica | 角宿一 |
| 21421 | Aldebaran | 毕宿五 |
| 24608 | Capella | 五车二 |
| 113368 | Fomalhaut | 北落师门 |
| 37279 | Procyon | 南河三 |
| 30438 | Canopus | 老人星 |
| 7588 | Achernar | 水委一 |
| 37826 | Pollux | 北河三 |
| 36850 | Castor | 北河二 |
| 49669 | Regulus | 轩辕十四 |
| 65378 | Mizar | 开阳 |
| 54061 | Dubhe | 天枢 |
| 60718 | Acrux | 十字架二 |
| 71683 | Rigil Kentaurus | 南门二 A |
| 71681 | Toliman | 南门二 B |

The two Alpha Centauri records remain distinct catalogue components. Their almost coincident sky positions are not artificially separated. Constellation notes describe the displayed star-line figures rather than implying that their lines are official constellation boundaries, or that each figure is a physically connected group of stars. The `Ser` note refers to both parts of Serpens, not to an additional 89th constellation.

## Factual sources

Descriptions were checked on 10 October 2026 against the bundled catalogue and the following primary institutional sources. Source prose, illustrations, and article layouts have not been copied into the application.

| Source | Facts used |
| --- | --- |
| [IAU: The Constellations](https://iauarchive.eso.org/public/themes/constellations/) | The 88 standardized identifiers, traditional figure names, constellation regions and the distinction between a figure and its official boundary. |
| [NASA: What Are Asterisms?](https://science.nasa.gov/solar-system/what-are-asterisms/) | Summer and Winter Triangle membership; the Big Dipper as part of Ursa Major. |
| [NASA: What Is the North Star and How Do You Find It?](https://science.nasa.gov/solar-system/skywatching/what-is-the-north-star-and-how-do-you-find-it/) | Polaris near the north celestial pole; its usefulness for direction; Southern Cross navigation. |
| [NASA: Summer Triangle Corner — Altair](https://science.nasa.gov/solar-system/skywatching/night-sky-network/summer-triangle-corner-altair/) | Vega, Deneb and Altair; Altair's rapid rotation and flattened shape. |
| [NASA: Betelgeuse and the Crab Nebula](https://science.nasa.gov/solar-system/skywatching/night-sky-network/betelgeuse-and-the-crab-nebula/) | Betelgeuse as a red supergiant and variable star; contrast with Rigel. |
| [NASA: The Dog Star, Sirius, and Its Tiny Companion](https://science.nasa.gov/asset/hubble/the-dog-star-sirius-and-its-tiny-companion/) | Bright Sirius and its white-dwarf companion Sirius B. |
| [NASA: Star Types](https://science.nasa.gov/universe/stars/types/) | Arcturus as a giant; Procyon B as a white dwarf. |
| [ESO: Best Ever Image of a Star's Surface and Atmosphere](https://www.eso.org/public/news/eso1726/) | Antares as a red supergiant. |
| [NASA: Flickering Aldebaran](https://science.nasa.gov/photojournal/flickering-aldebaran-1/) | Aldebaran as a red giant. |
| [NASA NTRS: Outer Atmospheres of Cool Stars — Capella](https://ntrs.nasa.gov/citations/19810029950) | The prominent Capella pair consists of two giants. |
| [NASA: Webb Looks for Fomalhaut's Asteroid Belt and Finds Much More](https://science.nasa.gov/missions/webb/webb-looks-for-fomalhauts-asteroid-belt-and-finds-much-more/) | Circumstellar dust and debris belts, without asserting that the disputed Fomalhaut b signal is a planet. |
| [NASA NTRS: Hubble Space Telescope Astrometry of the Procyon System](https://ntrs.nasa.gov/search.jsp?R=20160002444&hterms=open+systems+theory) | Procyon A and its white-dwarf companion. |
| [NASA: The Big Dipper](https://science.nasa.gov/image-article/apod-2011-june-24-the-big-dipper/) | The Merak–Dubhe pointer toward Polaris. |
| [NASA: A Hero, a Crown, and Possibly a Nova](https://science.nasa.gov/solar-system/skywatching/night-sky-network/night-sky-notes-july2024/) | The central Keystone pattern of Hercules. |

Other short shape, relative-position, and color notes describe the actual bundled J2000 line coordinates and star color indices. They avoid precise distances, predicted supernova dates, planet claims around stars, or claims about what is currently visible from every location. Northern and southern in these notes describe celestial position, not a guarantee of visibility for every terrestrial observer.

## Module contract

`config/apps/portal/src/planetarium/object-descriptions.mjs` exports:

- `objectDescription(kind, id, language)`: a string for a known star or constellation; `language` accepts `en` or `zh` and defaults to English. Unknown identifiers and other object types return an empty string.
- `starIdentity(id)`: a frozen name, Chinese name, aliases and description record for a known numeric or string HIP identifier; otherwise `null`.
- `STAR_IDENTITIES`: the 24 frozen records in presentation order.
- `POPULAR_STAR_IDS`: the corresponding frozen list of HIP identifiers.
- `CONSTELLATION_DESCRIPTIONS`: the 88 bilingual notes keyed by constellation abbreviation.

The module has no runtime network calls, framework imports, timers, astronomy calculations, sensor access, storage, or rendering work. All public text is supplied as plain strings so the card can render it with `textContent`. Its original source and wording are covered by the project's MIT license; linked articles retain their own rights and notices.
