# Research publication experience

2026-10-04. User-authorized website maintenance after Phase 8. Research expansion remains **paused after Stage V**; website Phase 9 is not authorized.

Live entry: `/research/`. The normal portal recommends “研究” and universal search finds the research feature. Three additional maze links are in `/maze/cache/`, `/maze/table/` and `/maze/route/a/b/c/d/e/`.

## Appearance and information architecture

Only this experience is orderly, dark and English, with square frames and an independent stylesheet. Its overview uses an interactive PBR adsorption field, particles, bloom and a full-screen animated shader background. Native Astro view transitions retain the chosen music track across research navigation.

The latest overview revision adds seven compact evidence panels: six-law probability fingerprints, joint kernels, properness topology, recorded prefix branching, feasible capability projection, probability-proportional terminal tessellation and eight certified enclosures. Scientific scope stays visible in short labels; extended explanation belongs in the full readers and expandable methods. Four original figures, three lab previews and the core implementation remain directly visible.

The site provides 30 research routes: Overview, Explore, Atlas, Library, 20 full document readers and six complete source readers. The atlas contains 16 original selected figures plus three derived scientific views, filters and an original-image lightbox. The lab offers five bounded browser demonstrations: seeded adsorption, joint-kernel word probabilities, exact terminal laws, nonnegative support witnesses and a recorded certificate-tree excerpt. Demonstrations do not regenerate the scientific results.

## File map

| Path | Responsibility |
| --- | --- |
| `config/apps/portal/src/pages/research/` | Static routes and full-text/source readers |
| `config/apps/portal/src/research/Layout.astro` | Independent shell, navigation, sound and author credit |
| `config/apps/portal/src/research/research.css`, `reader.css` | Dark square-frame layout and document typography |
| `config/apps/portal/src/research/Dashboard.astro` | Seven data-backed overview panels |
| `config/apps/portal/src/research/Graphic.astro` | Exact-law, topology, tree and feasible-cloud SVGs |
| `config/apps/portal/src/research/data.mjs` | Read-only frozen artifact loading, original Markdown rendering and streamed archives |
| `config/apps/portal/src/research/demo-model.mjs` | Educational browser calculations, separate from frozen research |
| `config/apps/portal/src/research/interface.mjs` | Controls, audio, filters, lightbox and lifecycle cleanup |
| `config/apps/portal/src/research/visual.mjs` | Original Three.js shader/PBR scenes and resource disposal |
| `config/apps/portal/src/research/Accent.astro`, `accent-scenes.mjs` | Explore's orbital transition network, Atlas's layered surfaces and Library's floating archive |
| `config/apps/portal/src/research/accent-controls.mjs` | Pointer capture, rotation, bounded zoom, raycast picking and keyboard/reset controls |
| `config/apps/portal/src/research/overview-interaction.mjs` | Fixed-view lattice illumination, local lift and bounded click ripples |
| `config/apps/portal/public/research/audio/` | Three original music assets and `CREDITS.txt` |
| `scripts/prepare-research.mjs` | Asset generation before Astro copies public files |
| `tests/research-display.test.mjs` | Six focused mathematical/entry checks |
| `tests/browser/research.spec.mjs` | Four focused publication/interface checks |

## Complete evidence and preservation

Four `.tar.gz` downloads contain **every one of the 1,271 indexed retained files**: 226 source/protocol/paper files, 103 raw records, 647 processed/exact-evidence files and 295 figure artifacts. This includes the five seal manifests in addition to 1,266 sealed scientific files. Large evidence loads only on download. Existing historical PDFs are retained; **no new PDF was generated**.

All 1,266 scientific files remain byte-identical to the five research seals. Every archive member was also independently opened with Python's standard `tarfile`, checked against its original size/SHA-256 and covered exactly once. These are artifact integrity checks, not reruns of research experiments. The three original requirement ledgers remain byte-identical; no original requirement was added, deleted or reclassified.

The website freeze embedded in the historical Stage V audit describes the website at that time. The user's subsequent publication request authorizes changing the website. Do not run that historical combined freeze audit and reseal scientific results to conceal the authorized website differences. The independent preservation evidence for this publication is recorded separately.

Scientific interpretation remains bounded: the periodic theorem concerns proper deterministic one-bit feedback and nonnegative support against the complete proper two-state temporal family. It is not raw point inclusion, randomized-feedback equivalence or a thermodynamic theorem. Open finite attainment and the open joint gap remain unresolved. The prefix graphic shows a depth-eight excerpt of a 40,001-node certificate; the feasible cloud is not a complete frontier.

## Music and provenance

The three tracks are **Mutant Club**, **Machines With Feelings** and **Dear Mr Super Computer**, by **Holizna / HoliznaCC0**, from [Retro Wave (Collection)](https://opengameart.org/content/retro-wave-collection), CC0 1.0. Original audio bytes are preserved. One track is selected upon entry and loops; the shell provides mute and volume. If browser policy blocks automatic playback, the first interaction enables that same selected track. Footer credit and `CREDITS.txt` are included.

No external effect implementation was copied. Original effects use the already installed Three.js API, whose existing required notices are preserved. Astro's native code highlighting and view-transition components are used through the existing dependency. The scoped virtual-asset resolver in `astro.config.mjs` addresses the external dependency path mismatch described in [Astro issue 16616](https://github.com/withastro/astro/issues/16616), without modifying Astro or globally changing symlink resolution.

## Build and validation

Existing standard commands still apply: `pnpm install`, `pnpm dev`, `pnpm build`, `docker compose up`. The portal build prepares the research assets automatically. The portal image build context includes the frozen research directory; neither application nor image requires a particular Windows drive. Generated `public/research/files`, `downloads` and `asset-manifest.json` are ignored and rebuilt; original audio assets remain project assets. No new third-party dependency was installed.

The local optional wrapper verified F-drive Docker storage before building just the portal, with the existing bounded 3-GiB builder. Six core services are healthy and the builder is stopped; optional infrastructure was not started. Final verification: six focused unit tests, four focused browser tests, 216-page host and Linux image builds, 30 deployed research HTTP routes, actual deployed WebGL and seven panel presence. The overview and instruments were visually inspected. This is not a full historical website regression, a research rerun or the pending public-release portability audit.

Acceptance: `docs/research-site-acceptance.json`. Local detailed reports and screenshots: dependency-root `runtime/reports/research-site/`; deployment build log: `runtime/reports/research-site-docker.log`. Those runtime artifacts belong outside the public repository.

## Header effects and first-entry fix — 2026-10-04

The user's initial blank Overview was traced to a repeatable lifecycle problem: DOM readiness and Astro's first page-load can both initialize the same page. The former code disposed the first renderer with `forceContextLoss`, then attempted to reuse that canvas. A local probe confirmed that an additional readiness event changed a working canvas into a lost context. An ordinary first visit happened to work in that probe; event timing differs, so the regression test deliberately exercises both initialization paths.

Initialization now recognizes the current main element and mounts once. Real page swaps invalidate that identity and dispose their old resources. ResizeObserver follows the actual header canvas dimensions; zero-size layouts are not rendered, and `data-render-mode="webgl"` is set only after a frame is drawn. A monotonic frame counter provides evidence of rendering, rather than renderer construction alone.

Explore, Atlas and Library each have a distinct interactive 3D header sharing the original teal/violet lighting, PBR materials, particles and bloom: a paired orbital network, four translucent topographic sheets and eighteen floating archive plates. These are explicitly conceptual decorations, separate from the evidence plots. Pointer response, cleanup and reduced-motion handling remain shared; no dependency or research result was added.

The five focused browser checks include first entry, refresh, repeated readiness events, research navigation and history return, a nonlost context and actual frames on all four headers. The initial scene extraction also exposed a particle-colour variable accidentally scoped inside Overview; that implementation error was corrected before deployment. Three header screenshots were visually inspected. See `research-visuals-acceptance.json` for final deployment evidence. Historical publication checks above retain their original scope.

## Larger interactive accents — 2026-10-04

The three added accents now occupy a wider header column and a 445-pixel desktop canvas, with closer camera framing. The earlier Overview lattice is unchanged. Every accent supports captured-pointer drag rotation, wheel zoom bounded to 0.70–1.55, hover response and click interaction. Double-click or Escape resets; arrow keys rotate, +/- zoom and Enter activates the scene. Input listeners are disposed on a real page swap; reduced-motion mode still redraws on interaction.

Explore clicks emit a fixed 24-light burst, enlarge the selected core and toggle faster circulating pulses. Atlas has a pointer-controlled scanning plane, highlighted picked surfaces and a toggle for separating/rejoining its four layers. Library fans/restacks its eighteen plates and pulls the selected plate forwards; clicking reveals the actual paper title and a full-reader link. All decorative behavior stays separate from scientific results.

The enlarged views were visually inspected. The expanded first-entry/navigation browser case checks actual native mouse drag, wheel zoom, click response, reset and Library's document link across all three pages. Initial automated drag attempts sampled a moving header during navigation; the test now waits for Astro's completed page-load and stable hover positioning, rather than using an arbitrary delay. That affected case passed once after this test-only synchronization change; the four other focused checks passed on the same application candidate beforehand. This revision does not claim a single full five-test passing run. Acceptance: `research-interactions-acceptance.json`.

## Tighter placement and fixed Overview interaction — 2026-10-04

User-requested scope: only Overview, Explore and Atlas move upwards and reduce top/section spacing. A page-specific body class scopes those changes; Library and the full readers keep their existing spacing. Desktop Overview's hero becomes 470 pixels high and its visual canvas 430 pixels high. Explore/Atlas keep the enlarged 445-pixel scenes, remove their large header padding and align their text near the top. Their section padding is reduced to 28 pixels.

Overview now reacts immediately to pointer entry and movement with local illumination, lighter nearby tiles and a small vertical lift. Click emits an expanding ring and a travelling lattice-height pulse. At most three pulse rings and 162 existing tile instances are used; geometry and event listeners are released on navigation. Overview's field, halo and particle orientation remain fixed: no drag rotation, pointer tilt or automatic spin. Enter/Space offers the same click pulse without adding visible controls. Other pages retain their previous rotation/zoom interactions.

Two focused browser cases passed in one invocation: the new compact-layout/Overview interaction case and the existing first-entry/all-header native-interaction case. They check hover response, click count, unchanged Overview orientation under dragging, header gaps, actual rendering, navigation, accent interaction and reset. Overview and compact Explore/Atlas screenshots were visually inspected. A surfaced first-frame curve error was fixed by clamping RAF-relative elapsed time to nonnegative values; click-pulse age uses the same guard. No scientific calculation was rerun. See `research-compact-acceptance.json` for final runtime evidence; this is not a full six-case regression.
