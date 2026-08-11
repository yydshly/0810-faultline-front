# Desktop Visual Gold Contract

## Design contract

- Entry mode: revision-led visual refinement.
- Request revision: desktop Web first; mobile is retained but is not a release gate for this phase.
- Target user and context: a player judging the game in the first few seconds of a desktop browser skirmish.
- Desired first impression: a readable, grounded industrial RTS battlefield whose headquarters, factory, vehicles, infantry roles, entrances, terrain layers, and faction silhouettes are immediately distinct.
- Visual ambition: immersive.
- Experience architecture: spatial stage.
- Scene base: Three.js WebGL battlefield that remains visible during the primary interaction loop.
- Foreground control model: compact HUD overlays; the review fixture may collapse the normal persistent sidebar so it does not consume the comparison frame.
- State-to-scene mapping: authored loading/fallback, production activity, harvester cargo, enemy visibility, damage, impact, and selection remain truthful to simulation state.
- Supported surfaces: desktop Web at 1440x900 and 1280x720, high quality. Existing mobile behavior is preserved but not visually reworked or used as a blocking gate.
- Visual constraints: original project assets; late-1990s/early-2000s industrial military RTS grammar; no copied commercial-game models, icons, textures, or logos; controlled emissive accents; one key light plus environmental fill.
- Operation constraints: retain mouse selection, command input, production controls, minimap, and deterministic fixture behavior.
- Performance constraints: use the authored 12-asset fixture allowlist, zero cross-owner material reuse, no silent fallback, and stable cold/reload metrics.
- Primary journey: open `visual-gold-review`, identify the base and unit roles, inspect production/cargo/readability, then issue normal battlefield commands without the HUD obscuring the authored lineup.
- Required artifacts: two desktop browser captures, authored Blender previews, published GLB metrics, KTX2/semantic-contract validation, TypeScript/tests/build evidence, and the top remaining visual gaps.
- Autonomy authorization: the user instructed Codex to continue the plan and avoid repeated confirmation. Reversible in-scope visual, asset, fixture, and QA decisions are authorized.
- User-decision boundary: only a new art direction, third-party/copyrighted asset use, irreversible external publishing, or a materially different gameplay scope requires new approval.

## Observable completion criteria

1. The first frame uses the full battlefield width; no empty sidebar shell obscures or compresses the gold fixture.
2. Headquarters and factory read as different functions within three seconds, with visible massing and a recessed production entrance.
3. Tank, harvester, and the three player infantry roles remain distinguishable at the fixed review camera.
4. Minimap and compact command dock do not obscure the gold lineup at either desktop viewport.
5. Authored asset requests complete without fallback, cross-owner material reuse, or console error.
6. Scene lighting reveals material planes and contact grounding without flattening faction/value contrast.
7. Targeted tests, full tests, TypeScript, production build, and 42-asset KTX2 contracts pass.

## Coverage manifest

| Requirement | Surface / state | Evidence | Stage | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| Deterministic gold lineup | `visual-gold-review`, high | source + fixture tests | 1 | pass | retain during visual changes |
| Full-width first-frame composition | 1280x720 desktop | browser screenshot + rects | 2 | pass | stage is full width; sidebar shell is absent |
| Readable authored materials | 1280x720 desktop | browser screenshot | 2 | pass | textured color factors are preserved and review lighting reveals the camera-facing planes |
| Compact HUD without occlusion | both desktop viewports | screenshots + DOM rects | 3 | pass | minimap and command dock stay below the authored lineup |
| Core battlefield interaction | desktop mouse | browser interaction | 5 | defer | production drawer open/close, Escape, and focus return pass; the in-app browser exposes element-level clicks but no coordinate-capable canvas pointer API, so direct box-select/right-click must be retested when that capability is available |
| Truthful loading/production/cargo | gold fixture | runtime metrics | 6 | pass | 12/12 authored assets, active factory door/crane, and three cargo slots are observed |
| 1440x900 and 1280x720 coverage | desktop high | browser captures | 7 | pass | final captures retained in `docs/qa/` |
| Runtime budget/fallback | desktop high | renderer and asset metrics, console | 8 | pass | zero load failure/retry, zero material cross-owner reuse/conflict, and zero console warning/error |
| Engineering closure | repository | tests, tsc, build, GLB contracts | 9 | pass | TypeScript, 162 tests, production build, and 42/42 KTX2 contracts pass |

## Revision 2 — surface and battlefield cohesion

The second desktop-only wave keeps the lineup, camera, HUD, gameplay plane, and published asset identities fixed. It addresses the three remaining first-frame gaps with the smallest coherent asset/level slice:

1. HQ and Factory gain strategic-scale surface breakup: 0.35–1.2 m panel divisions, service structures, edge catches, and controlled wear using the existing material family and texture budget.
2. The gold fixture gains deterministic, non-colliding base aprons, entrance throats, road-edge language, oil/wear marks, and low-profile navigation cues. Every walkable visual remains at or below 0.015 m and cannot alter pathfinding, placement, replay, or state hashes.
3. Detail density is compared at the fixed 44 m orthographic height before any additional tank, harvester, or infantry rebuild is authorized.

| Requirement | Surface / state | Acceptance evidence | Status | Next action |
| --- | --- | --- | --- | --- |
| Building surface hierarchy | HQ/Factory Blender preview and both desktop frames | large planes remain readable without relying on tiny decals or emissive area | partial | HQ/Factory medium-scale divisions, service structures, and edge catches are improved; strategic-camera dark values remain, but the next wave moves to the ore field and enemy sentry instead of adding more building greeble |
| Entrance and route continuity | `visual-gold-review`, high | visible HQ/Factory thresholds connect to flat aprons and road cues | pass | six deterministic dressing batches now connect the building thresholds, service aprons, and Y-shaped route language |
| Flat gameplay invariants | level data and runtime scene | no collision/nav/light/state change; authored visual top ≤0.015 m | pass | 49 instances / 720 triangles, maximum Y 0.014 m, with zero collision, navigation, texture, light, or authoritative-state additions |
| Runtime budget | both desktop frames | +≤6 authored calls, +≤5k visible triangles, no new runtime textures | pass | the 1440 authored comparison is +6 calls / +1,748 triangles at 182 / 60,190 / 237; the wider-aspect 1280 frame observes 183 / 60,302 / 238 because one edge object is also visible; both retain 156 textures |
| Final desktop evidence | 1280x720 and 1440x900 | before/after captures, 12/12 assets, clean console | pass | both v2 captures retain 12 requested/completed/loaded assets, zero failure/retry/material conflict, and a clean console |
| Engineering closure | repository | TypeScript, full tests, production build, 42/42 KTX2 contracts | pass | TypeScript, 15 files / 162 tests, production build, and 42/42 contracts pass; only the known non-blocking Three.js chunk warning remains |

## Revision 3 — ore-field and enemy-sentry silhouette closure

The third desktop-only wave keeps the fixed lineup, camera, HUD, 12-asset allowlist, and authoritative gameplay plane unchanged. It replaces the two remaining toy-like secondary focal points without changing their asset identities or runtime semantic contracts:

1. `FF-ORE-01` removes the regular black disk and uses an irregular grey-olive soil footprint with partially buried rubble and crystal clusters.
2. `FF-EN-SEN-01` removes the saturated red square pad and uses a dark octagonal base, paired supports, and two readable muzzle sockets.
3. Both assets retain exact node, parent-child, socket-extra, transform, and animation contracts before the same two desktop frames are captured.

| Requirement | Surface / state | Acceptance evidence | Status | Next action |
| --- | --- | --- | --- | --- |
| Ore-field silhouette | both desktop frames | no regular black disk; irregular soil, buried rubble, and crystal clusters read at the fixed camera | pass | retain the 6.59% emissive footprint and current 446-triangle budget |
| Enemy-sentry silhouette | both desktop frames | no red square pad; octagonal base, paired supports, and twin muzzles remain legible | pass | retain the current dark-base/value hierarchy |
| Semantic compatibility | published GLBs | exact nodes, parents, socket extras, transforms, and animations | pass | 42/42 published contracts pass without adapter changes |
| Runtime budget | both desktop frames | compare Wave 2 and Wave 3 with the same fixture | pass | each frame records -17 calls / -1,582 triangles with textures fixed at 156; observed geometry deltas are -16 at 1440 and -17 at 1280 |
| Final desktop evidence | 1280x720 and 1440x900 | 12/12 assets, clean console, retained production/cargo state | pass | both Wave 3 captures are retained in `docs/qa/` |
| Engineering closure | repository | TypeScript, full tests, production build, 42/42 contracts | pass | TypeScript/build, 15 files / 162 tests, and 42/42 require-KTX2 contracts pass; only the known non-blocking Three.js chunk warning remains |
