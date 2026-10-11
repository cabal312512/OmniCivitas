# Planetarium assets and source notices

The planetarium serves all visual resources from this project. A deployed browser
does not depend on an external image service. The production package contains
25 prepared assets totaling **28,625,242 bytes** (about 27.3 MiB), excluding the
small manifests and license files. This includes an optional 8k Milky Way map;
the current non-8k base set totals **17,640,796 bytes** (about 16.8 MiB), including
the supplemental faint-star catalogue. Solar-system
textures load on demand. The initial wide-field sky uses the 4k map; High quality
or sufficiently close sky zoom requests the 8k map when supported. The entire
asset set does not need to be downloaded for the first sky view.

The machine-readable inventory is
[`manifest.json`](../config/apps/portal/public/planetarium/assets/manifest.json).
Each entry records its deployed URL, source, transformation, size and SHA-256.
Credits are separately exposed by
[`credits.json`](../config/apps/portal/public/planetarium/credits.json), with
publicly accessible notices under `/planetarium/licenses/`. Project-owned MIT
code does not change any third-party image or component license.

## Background music

**Lost in the Snow Wave** by **hatmix** is published under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) at
[OpenGameArt.org](https://opengameart.org/content/lost-in-the-snow-wave).
The author and source are voluntarily credited on the site's asset statement.
The original `lost_in_the_snow_wave.ogg` is copied without conversion or edits to
`/planetarium/audio/`; its **3,478,125 bytes** are separate from the visual-asset
totals above. The audio inventory records its source and SHA-256 in
[`audio/manifest.json`](../config/apps/portal/public/planetarium/audio/manifest.json).

The frontend tries to play the track in a loop when entering the planetarium.
If the browser blocks unprompted audible playback, the next real pointer or
keyboard gesture retries it. A mute control and volume control remain available.
The module uses one audio element, preserves its position over back/forward
cache navigation, pauses it on page exit and releases it when the page is
disposed. Playback has no server, account or recording dependency.

## Visual resources

| Asset | Dimensions | Source and conditions |
| --- | --- | --- |
| `milkyway.jpg`, `starmap.jpg` | 4096 × 2048 each | [NASA SVS Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/), Ernie Wright; NASA/GSFC/SVS and ESA/Gaia/DPAC credits retained. NASA media guidelines, **not a blanket CC0 grant**. |
| `milkyway-high.jpg` | 8192 × 4096 | Optional high-quality NASA Milky Way map, 10,984,446 bytes. Same projection, base exposure and tone map as the 4k version; requested on demand. |
| `earth-day.jpg` | 4096 × 2048 | [Solar System Scope](https://www.solarsystemscope.com/textures/), INOVE, CC BY 4.0; reduced from the 8k source. |
| `earth-night.jpg`, `earth-clouds.jpg`, `earth-normal.jpg`, `earth-specular.jpg` | 2048 × 1024 each | Solar System Scope, INOVE, CC BY 4.0. |
| `sun.jpg`, `mercury.jpg`, `venus.jpg`, `mars.jpg`, `jupiter.jpg`, `saturn.jpg`, `uranus.jpg`, `neptune.jpg` | 2048 × 1024 each | Solar System Scope, INOVE, CC BY 4.0. Venus uses the atmosphere map. Source saturation and artistic completions remain part of the supplied maps. |
| `saturn-ring.png` | 2048 × 125 | Solar System Scope, INOVE, CC BY 4.0. RGBA horizontal radial strip, alpha retained. Ring geometry samples horizontal U as normalized radius. |
| `moon.jpg` | 2048 × 1024 | [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), 2025 LROC color map. NASA/GSFC/SVS, NASA/GSFC/ASU and Ernie Wright credits. |
| `moon-height.jpg` | 1024 × 512 | NASA CGI Moon Kit LOLA visual height image. Original preview resolution retained; suitable for visual surface relief, not geodetic output. |
| `atmosphere/transmittance.exr`, `atmosphere/scattering.exr`, `atmosphere/irradiance.exr` | Native precomputed texture layouts | Unmodified resources from `@takram/three-atmosphere` **0.19.1**. Shota Matsuda / Takram; Eric Bruneton and INRIA atmospheric model. Full upstream licenses are retained. |
| `stars-faint.json` | 36,367 packed star records | Supplemental magnitude-eight catalogue from the pinned d3-celestial source below; BSD-3-Clause. Only new catalogue IDs with `6 < mag <= 8` are retained. 1,298,321 bytes. |

The NASA sky maps were decoded from original full-resolution linear OpenEXR
sources, with existing Three.js EXRLoader. Their data rows were restored to image
top-down order. Reinhard `x / (1 + x)` tone mapping, standard linear-to-sRGB
encoding and JPEG quality 93 produce the distributed images. No synthetic stars
or invented nebulae were added. The Milky Way source deliberately omits the
Hipparcos and Tycho bright-star foreground, so the browser can draw interactive
bright stars separately. The combined star map is also available for contexts
that need a complete background.

The optional 8k source is the authentic `milkyway_2020_8k.exr` linked from the
same NASA source page. It contains more spatial detail and is not an enlargement
of the 4k image. Conversion used half-float storage and 64-row memory-mapped
processing to avoid simultaneous full-size floating-point working copies.
The map uses the same exposure and tone-map formula as the default. The NASA
8k source has lower per-pixel radiance levels than the 4k source, so brightness
normalization when changing resolution belongs to the renderer, alongside its
runtime photographic grading.
An 8k RGBA texture occupies about 128 MiB before mipmaps. Its allocation therefore
depends on the selected quality, the current zoom and the browser's GPU
texture-size limit; the compressed JPEG size is not its GPU-memory requirement.

## Display modes and resolution

The default sky covers the entire **360-degree celestial sphere**. It has no
opaque lower hemisphere or horizon clamp, and free camera roll can carry the
view through either celestial pole. An optional atmosphere/horizon setting
changes to an observer-ground view; selected eclipse replays use that physical
atmosphere separately.

The sky initially uses **Long exposure**, a photographic presentation with GPU
exposure **2.35** and saturation **1.32**. The optional natural mode removes that
photographic enhancement. Catalog stars are drawn independently from their
positions, apparent magnitudes and color indices; enhancing the photographic
background does not invent additional catalog entries or change their coordinates.

Both detail paths require the renderer to report a maximum texture size of at
least **8192**. **High quality** pins the optional 8k Milky Way map. **Balanced**
starts with 4k and requests 8k when a sky-based view's field of view falls below
**35 degrees**. Once active, automatic detail remains until the field of view
exceeds **45 degrees** or the view switches to solar-system rendering, an
eclipse or a Moon close-up. These different
thresholds prevent repeated loading at a single zoom boundary. Unsupported
devices retain 4k. The current non-8k base set is about **16.8 MiB**, and the
optional 8k JPEG adds about **10.5 MiB**; these are package sizes, not first-view
download requirements or GPU-memory measurements.

The 8k source's lower per-pixel radiance is normalized by the shader using
`radianceScale = 4`. For a linear RGB component `c` already mapped by Reinhard,
the equivalent corrected component is `4c / (1 + 3c)`. This is the result of
recovering the original radiance, multiplying it by four and applying Reinhard
again. The same photographic exposure is then applied to either resolution.
The distributed JPEG has no baked fourfold brightness adjustment, so source
preparation and display grading remain separate.

Resolution changes crossfade between normalized maps rather than replacing the
sky abruptly. Automatic detail is faded out before its GPU texture is released;
an in-flight result is disposed if it is no longer needed. A failed optional
download retains the current panorama without repeated requests every frame.

At close zoom, the panorama keeps at least **22%** of its selected presentation
opacity, smoothly increasing from that floor at **2 degrees** to full strength
at **15 degrees**. This gives the sharp star layers more weight at deep zoom
without abruptly replacing the surrounding sky. It no longer disappears at
narrow fields of view. Independently rendered catalog stars remain sharp, with
a bounded **14-pixel** point size and gentle zoom scaling. Equirectangular
texture filtering uses angular pixel footprints, avoiding singular RA
derivatives at celestial poles. The all-sky imagery still has finite angular
resolution; zooming it does not create resolved deep-sky detail or new scientific
measurements. Eclipse and explicitly enabled daylight rendering use their own
physical visibility response. The Moon and shadow studios use a separate sparse
catalogue background in the same renderer, with no photographic panorama or
automatic 8k requests. Automatic sky detail is released while those studios are
open. An explicitly pinned High texture retains its quality-setting lifecycle.

The sky projection is equirectangular ICRF/J2000. Right ascension zero is at the
image center and increases toward the left. For RA and declination in degrees,
`u = (0.5 - RA / 360) mod 1` and `v = 0.5 - Dec / 180` give image coordinates.
Texture conventions can reverse the vertical component; preserve this stated
astronomical orientation when converting it to an engine's UV convention.

Other images were converted into browser-supported formats and encoded as
compact JPEGs, with Saturn ring alpha preserved in PNG. Earth normal-map JPEG
uses quality 93 and no chroma subsampling. Earth clouds is a grayscale coverage
image and can be used as an alpha map on a separate white cloud layer. Normal,
specular and height textures represent data rather than sRGB color.

## Star and constellation data

The flattened catalogs derive from
[`ofrohn/d3-celestial`](https://github.com/ofrohn/d3-celestial/tree/7e720a3de062059d4c5400a379146a601d9010e0),
pinned at commit `7e720a3de062059d4c5400a379146a601d9010e0`. The original BSD-3-Clause
license, Copyright (c) 2015 Olaf Frohn, is retained verbatim. The upstream project
credits its original scientific catalogues and naming sources; these are preserved
in `SOURCE-NOTICES.txt`.

`stars.json` contains **5,044 real stars** from the magnitude-six subset. Its
top-level object has `schemaVersion: 1`, `epoch: "J2000"`,
`coordinateUnits: "degrees"` and a `stars` array. Each record has:

- `id`: original numeric catalogue identifier, corresponding to the upstream ID.
- `ra`, `dec`: equatorial J2000 right ascension in `[0,360)` and declination in
  `[-90,90]`, both in degrees.
- `mag`: visual apparent magnitude.
- `bv`: B-V color index, or `null` when the source did not provide one.
- `name`: supplied proper name or Bayer/designation label when available.
- `constellation`: IAU abbreviation when supplied by the upstream name table.

The source supplies positions rather than a new measurement or a per-star
proper-motion model. Precession and observer transforms belong to the astronomy
calculation layer; the immutable catalogue itself remains at J2000.

`stars-faint.json` supplements the interactive bright catalogue with **36,367
additional real stars**, giving **41,411** rendered catalogue stars when loaded.
Its source is the same pinned commit's
[`data/stars.8.json`](https://github.com/ofrohn/d3-celestial/blob/7e720a3de062059d4c5400a379146a601d9010e0/data/stars.8.json).
The source contains 41,411 features. Existing bright IDs are excluded, and only
visual magnitudes `6 < mag <= 8` are retained; positions are not synthesized.
The compact file stores records as `[id, ra, dec, mag, bv]`, with the same
J2000/degree metadata. Unknown B-V indices remain `null` in the distributed file.
Its manifest entry records both the original and compact-file SHA-256 values.

The supplemental loader enforces **45,000 records** and **2,500,000 streamed
bytes**, including when a response omits its content-length. It rejects invalid
units, duplicate IDs and out-of-range coordinates before creating geometry.
Loading is nonblocking for the original bright-star view. Validated coordinates
become compact typed buffers and one additional point draw per frame: the draw
count is constant, while parsing and upload remain bounded linear work in the
number of records. Magnitudes control small point sizes; zoom gently increases
their visibility. The original 5,044-star naming and picking dataset remains
unchanged. Page disposal aborts pending loading and disposes the GPU resources;
a failed optional catalogue retains the bright-star view.

`constellations.json` has the same schema/epoch/units metadata and a
`constellations` array. There are **88 unique constellation IDs**; the upstream
Serpens head and tail line groups are merged under one ID. Each record has `id`,
the formal English/Latin `name`, Chinese `nameZh`, a `[ra,dec]` label `center`,
and `lines`, an array of coordinate paths. Each path is a sequence of
`[raDegrees,decDegrees]` points. Connecting these points along great-circle arcs
preserves their spherical geometry.

The renderer tessellates those arcs at a maximum angular step of **1.5 degrees**
and uses Three.js wide-line utilities for consistent screen-space edges. Hover
and click picking use the actual spherical segments, including RA wrap and
polar figures, with a tolerance derived from **12 CSS pixels** and the current
field of view. The supplied label centers do not determine the hit region.
Label placement uses a visible geometry-derived anchor. Selected figures retain
their outline after the pointer leaves and use a short line reveal, soft node
halos and a restrained pulse; these effects do not modify catalogue positions.

## Experiences and rendering model

**Sky** and **Solar system** remain the two primary views. Smaller experiences
are grouped into Night sky, Lunar, Dynamics and Celestial events. Their current
controls, bounded object counts and illustrative models are described under
[Interactive experiences](#interactive-experiences) below.

Calculation stays in the frontend: one low-frequency Worker snapshot request is
in flight at a time, ordinarily sampled every **650 ms** during playback.
Bounded ephemeris trajectories and camera-target smoothing run in the shared
animation loop. Solar positions use cubic Hermite interpolation of mature
engine position/velocity samples; sky directions use cached apparent-vector
samples and continuous signed sidereal phase. Each track has at most 122 knots,
with up to three seconds of signed look-ahead capped at 90 simulated days. Two
fixed-grid caches each retain at most 1,024 entries. No astronomy solver runs
on every rendered frame.

At the fastest **30 days per second** setting, dates and orbital positions keep
the selected time rate. Daily sky rotation is visually limited to **0.08 turns
per second**, and texture surface spin to **0.15 turns per second**, because
their actual accelerated rotation exceeds a display's useful temporal sampling.
Pausing or slowing playback smoothly restores the true wrapped phase. Changing
the rate prepares the new trajectory before advancing time; focused solar
cameras follow the moving body during approach and across Worker replies.
These viewing policies are not precision astrometry or a change to celestial
orbital periods. Visual
effects and view navigation do not launch separate animation loops or server
tasks. They remain responsive independently of the selected simulation speed.

The default **Balanced** renderer retains a **2.2-million-pixel** drawing budget
and a maximum pixel ratio of **1.4**. **High** permits **4.2 million pixels** and a
maximum ratio of **1.8**. Automatic 8k texture detail does not increase those
canvas budgets. The Sky-view orientation HUD is a bounded inset using the same
Three.js renderer and loop, displaying observer-local heading, elevation and
camera roll. It contains a geographic Earth globe with a **1024 × 512** derivative
of the credited Earth-day map. The cyan ring lies in the local horizontal plane;
the violet elevation meridian follows the heading; the warm roll ring is
perpendicular to the view ray. Each has its own pickable handle. Layered luminous
ribbons with broader cores, flat ticks and a three-dimensional arrow replace mechanical
gimbal tubes. The arrow follows the complete local viewing vector, including
height and depth; a faint drop line indicates its horizontal projection. Its root
and a luminous observer marker share the selected latitude/longitude on the map.
The Earth and local control rings use the inverse of the **displayed** sky
rotation, including its existing smooth corrections and high-speed visual cap.
There is no independent animation clock that can drift from the sky. The inset
has a fixed celestial reference; geographic location and local angle readouts
stay unchanged as time turns the Earth. Looking around changes the viewing ray,
not the observer's city. Thirty bilingual presets and custom coordinates are
available, including southern and polar locations. The globe is spherical and
the geographic presets are approximate; it is a navigation display, not a survey.
Projected ring planes provide pointer angles, with bounded pointer increments
for edge-on views. Ring selection and focused arrow keys adjust one axis at a
time. The reset action uses the same camera model.
The inset is **226 CSS pixels** across on desktop and **170** on narrow layouts.
It does not add an astronomical calculation or a second canvas.

Twenty-four well-known catalogue stars can be searched and selected separately;
named bright-star hit areas take priority over nearby constellation lines.
The lower-left card contains one or two short bilingual sentences for these
stars and all 88 constellations. Catalogue identities and primary content
sources are recorded in [PLANETARIUM-OBJECT-NOTES.md](PLANETARIUM-OBJECT-NOTES.md).

Sky navigation uses quaternion orientation without a horizon or polar clamp.
Mouse drag, roll gestures, wheel zoom and touch pinch/rotation share that view;
keyboard navigation activates when the canvas has focus and leaves editable
controls and browser modifier shortcuts alone. Input listeners and the HUD are
released with the page.

Solar navigation is a free camera. Left drag changes its orientation while
keeping position fixed; right drag translates in its view plane; wheel movement
dollies along the viewing direction without changing field of view. The default
is a system overview. Explicit double-click or Approach can follow a chosen body,
and the next navigation gesture detaches that follow. Focused-canvas keyboard
and touch controls use the same damped position/quaternion targets. Browser
modifier shortcuts are preserved. Position has a finite 4,096-scene-unit bound;
no orbit target or planet lock is required for ordinary navigation.

## Interactive experiences

The Experiences menu groups seven small views below the two main Sky and Solar
system views. They are local frontend presentations, sharing one WebGL context
and animation loop; none starts a backend task or new astronomical solver.

- **Meteor shower:** Perseids, Geminids and Leonids have different approximate
  radiants. Activity changes the cadence of a fixed pool of 24 luminous flights;
  Burst schedules up to six idle flights. These are illustrative showers, not
  a forecast for the chosen date or observing location.
- **Star trails:** 360 actual catalogue stars form sidereal arcs, up to 64
  segments each. Exposure spans 15 minutes to four hours, at approximately
  15.041 degrees per hour. Acquisition fills over eight display seconds and can
  pause, resume or restart; colour follows catalogue B-V values. Changing
  exposure updates shared GPU uniforms. It is an exposure model, not a saved
  observation or a physical camera integration.
- **Moon phases:** a continuous 90-display-second cycle connects eight accurate
  phase silhouettes. The Moon view uses the existing NASA colour and LOLA
  relief maps on a detailed sphere. The Earth–Moon orbit view adds the existing
  INOVE Earth day, night, cloud, normal and specular textures. The orbit is
  compressed for display; phases do not replace the main sky's dated ephemeris.
- **Shadow theatre:** interactive solar and lunar alignment, finite-Sun umbra
  and penumbra cones, analytic surface coverage and a restrained red lunar
  totality. This explicitly marked scale model is separate from historical
  eclipse replays and does not predict eclipses.
- **Orbit explorer:** inner-planet and whole-system framing, smooth guide curves
  and markers at actual rendered planet positions. Navigation remains free.
- **Historical eclipse replays:** the existing Dallas 2024 solar and 2025 lunar
  events retain calculated contacts and time scrubbing. Solar corona streamers,
  prominences and contact diamond/beads are visual effects. The contact cues
  follow angular alignment, without reconstructing individual lunar valleys.

Entering an experience hides unrelated decoration and captures the original
time, location, display settings and camera pose. Closing it restores that
context. Studio camera gestures detach automatic framing; Reset restores it.
The studios lazily load existing textures in batches of at most two. Their
background uses up to 5,200 real catalogue rows, normally the 5,044-row bright
catalogue. No additional third-party asset or dependency is required.

Physical-device orientation is an opt-in mobile control. It requires a secure
browser context and, where required, a user-gesture permission request. Sensor
samples remain ephemeral in the frontend; unavailable, denied or silent sensors
return control to ordinary interaction. The device-to-camera basis is adapted
from Three.js **r133**
[DeviceOrientationControls](https://github.com/mrdoob/three.js/blob/r133/examples/jsm/controls/DeviceOrientationControls.js).
The original MIT authorship notice is retained; the surrounding input,
calibration, smoothing and lifecycle code is project-specific.

## Component and lookup-texture notices

- **Three.js:** MIT, Three.js authors; installed-version license copied verbatim.
  The mobile device-to-camera orientation basis additionally adapts the r133
  `DeviceOrientationControls` source linked above, under the same MIT license.
- **Astronomy Engine:** MIT, Don Cross; upstream full license retained.
- **Postprocessing 6.39.5:** Zlib, Raoul van Rüschen; installed-version license
  copied verbatim.
- **Takram three-atmosphere 0.19.1:** MIT project layer with BSD-3-Clause
  Eric Bruneton / INRIA atmospheric shader model. The complete upstream package
  notice also contains licenses for additional code paths. It is copied intact
  from commit `b012ad06d858fc035d88aacfd73f092f93c994e4`, because the npm package
  does not include its `LICENSE` file.
- **Takram three-geospatial 0.9.1:** MIT coordinate and rendering utilities,
  imported by the atmosphere package. Its complete upstream `packages/core/LICENSE`
  is copied intact from the same commit, including the separately identified
  Apache-2.0 notice for the additional WebGPU shadow source path.

The npm distributions of Astronomy Engine 2.1.19, Takram three-atmosphere 0.19.1
and Takram three-geospatial 0.9.1 omit their standalone license files. The browser
bundle license collector has narrowly version-pinned mappings to these sourced
notices. All other missing-license packages still fail collection; no generic MIT
permission text or author identity is substituted. The notices accompany emitted
chunks and are also available as standalone public files. The site's existing
`third-party-notices.txt` links to these additional notices and the media manifest.

The atmospheric textures come from the exact versioned npm archive identified
in each manifest entry, with package integrity and original archive paths. They
are not copied from an unpinned current branch. Use the resource set with
`combinedScattering: true` and `higherOrderScattering: false`; the three EXRs total
4,124,561 bytes. Heavy GPU precomputation is unnecessary at page entry.

Original downloads, conversion scratch data and installed packages are build
resources outside the production source tree. Only the prepared assets, their
provenance and license notices are distributed here. A clean deployment can
serve them directly without an author's disk layout or a conversion toolchain.
