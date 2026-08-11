# Breakthrough battlefield instancing validation

## Scope and invariant

This wave changes presentation batching in `breakthrough-demo*` only. Simulation state, commands, picking, authored level data, the y=0 navigation/collision plane, event timing, VFX pools, GLB models, turrets, sockets, rigs and doors are unchanged.

The deterministic browser comparison remains:

- route: `?fixture=breakthrough-demo&quality=high`;
- desktop viewport: 1440×900, with a 1124×900 stage canvas and fixed 316 px sidebar;
- asset baseline: 40/40 loaded, 0 failed, 0 material conflicts;
- pre-instancing heavy-impact-v2 reference: 3 simultaneous heavy effects, 661 calls, 114,118 triangles, 424 geometries and 142 textures;
- pre-instancing 10 second combat range: 598–700 calls.

## Static battlefield dressing: 39 semantic decals → 8 batches

All original transforms, y values, scales, rotations, render order, geometry family and material meaning are retained. Every batch uses `StaticDrawUsage`, carries stable ordered `userData.instanceIds`, and is explicitly presentation-only with `collision='none'` and `navigation='none'`.

| Batch | Instances | Geometry / material | Draw-call delta |
| --- | ---: | --- | ---: |
| command pad | 1 | box / concrete | 0 |
| command borders | 4 | box / enemy team | -3 |
| ground-scar churn | 3 | 28-segment disc / ground scar | -2 |
| dust-patch churn | 3 | 28-segment disc / dust patch | -2 |
| assault track marks | 10 | box / track mark | -9 |
| shell scars | 8 | 24-segment disc / scorch | -7 |
| shell rims | 8 | 24-segment ring / ground scar | -7 |
| defense footprints | 2 | 32-segment ring / defense footprint | -1 |
| **Total** | **39** | **8 batches** | **-31** |

The maximum authored instance origin remains y=0.015 m. No decoration is consulted by movement, collision, target selection or pathfinding.

## Dynamic contact shadows: 29 semantics → 1 batch

- Breakthrough entity roots no longer own one shadow mesh each.
- One `DynamicDrawUsage` instanced batch reuses the existing 28-segment circle geometry and contact-shadow material.
- Opacity remains 0.22, footprint scale remains 0.84, and unit/building ellipse depth ratios remain 0.76/0.96.
- Matrices are written only after entity position interpolation and LOD visibility are finalized.
- A single reusable `Object3D.matrix` writes every transform; the frame update allocates no arrays, geometry or materials.
- Hidden, removed, culled and resource visuals are filtered before writing instances. Disclosed visible enemies keep shadows; hidden enemies cannot enter the batch.
- Initial capacity is 32 for the representative 29 visible entities. Capacity grows by powers of two only when required; the replaced `InstancedMesh` is removed and disposed while shared geometry/material remain owned by the scene.

Representative draw-call delta: 29 → 1, or **-28 calls**.

## Compact group selection: 10 semantics → 1 player batch

- Selections of one through five retain their original independent rings.
- For six or more selected player entities in the breakthrough fixture, independent rings are hidden and one `DynamicDrawUsage` player batch renders the existing narrow compact ring.
- Selection, command dispatch, entity picking and fallback pick radii remain rooted in the original entity visuals; the presentation batch is never pickable.
- Initial capacity is 16 for the representative 10-ring selection, with the same grow-only/dispose policy as contact shadows.
- Hidden/removed visuals and hidden enemies are excluded. Non-player semantics keep the existing independent-ring path.

Representative draw-call delta: 10 → 1, or **-9 calls**.

## Budget and runtime telemetry

The representative theoretical reduction is:

`(39 - 8) + (29 - 1) + (10 - 1) = 68 draw calls`

No semantic instance, triangle, texture or geometry source was added. Expected browser targets at a comparable combat state are stable calls ≤560 and a 10 second peak ≤640. If active-event density differs from the baseline sample, report the observed effect counts and call range rather than normalizing the result.

Development canvas telemetry separates semantics from draw batches:

- `staticBattlefieldInstances` / `staticBattlefieldBatches`;
- `contactShadows` / `contactShadowBatches`;
- `compactSelectionRings` / `compactSelectionRingBatches`.

Existing `presentationContactShadows`, `presentationBreakthroughDecals`, `defenseMarkerCount`, VFX, LOD and render counters remain available.

## Desktop browser evidence

Final desktop evidence: [breakthrough-instanced-v1-1440x900-high.png](qa/breakthrough-instanced-v1-1440x900-high.png).

The high-quality `breakthrough-demo` browser run reported:

- 40/40 assets loaded, 0 failed, 0 retries, 0 material conflicts and 0 cross-owner material reuse;
- 0 console errors or warnings;
- 39 `staticBattlefieldInstances` in 8 `staticBattlefieldBatches`;
- 10 compact selection rings in 1 batch initially, then 9/1 after combat losses;
- 17–19 visible contact shadows in 1 batch across samples. Hidden, culled and deleted visuals were correctly absent rather than being padded to the authored entity count;
- screenshot frame: 577 calls, 113,360 triangles, 407 geometries and 142 textures;
- later dynamic frame: 588 calls, 120,238 triangles, 444 geometries and 158 textures, demonstrating that renderer uploads and combat state continued to change after the screenshot;
- 10 second combat sample: 567–645 calls, maximum 3 simultaneous heavy effects and maximum 118,320 triangles.

The earlier readable-VFX reference window measured 598–700 calls, maximum 2 simultaneous heavy effects and maximum 130,956 triangles. The two windows occurred at different mission times and carried different effect density, so this is **indicative improvement only**, not a strict same-frame subtraction. The fixed structural reduction remains the independently verified 68-call theoretical delta.

Runtime target status is **partial**: the stable target of ≤560 calls was not reached because the observed minimum was 567, and the ≤640 peak target was exceeded by 5 calls at 645. The result is materially lower than the earlier reference range, but it must not be recorded as a full budget pass.

The production build also passed. Its only warning was the existing Three.js chunk exceeding 500 kB.

## Automated validation

- TypeScript: `npx tsc --noEmit -p tsconfig.app.json` — pass.
- Targeted: 3 files, 25 tests — pass.
- Full single-worker suite: 18 files, 181 tests — pass.
- Deterministic simulation, replay and formal breakthrough fixture/hash tests are included in the full pass and remain unchanged.
- New pure contract tests cover 39→≤8 planning, stable unique IDs, plane y bounds, collision/navigation exclusion, hidden/removed/resource filtering, no hidden-enemy leakage, fixed representative capacity, grow-only capacity and the 68-call budget.
