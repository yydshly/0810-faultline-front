# Breakthrough desktop performance closeout

## Scope

This pass targets the deterministic desktop route:

`/?fixture=breakthrough-demo&quality=high`

The comparison used a 1440 x 900 viewport at device pixel ratio 1. Both windows
were sampled between five and twelve seconds after a clean reload. The level,
simulation, imported assets, camera, quality profile, selection state, combat
VFX policy, and UI were unchanged.

## Repeatable baseline

The baseline window contained 17 LOD0 visuals, one LOD1 visual, 12 culled
visuals, 18 faction markers, 13 visible health bars, and 0-24 active effects.

| Metric | Baseline window |
| --- | ---: |
| Draw calls | 574-653 |
| Representative median | about 604 |
| Triangles | 112,234-115,158 |
| Geometries | 408-410 |
| Textures | 142 |

Browser-side frame-time sampling was not available in the read-only test
surface, so this pass makes no unsupported frame-time claim.

## Change

Only breakthrough fixtures replace the three meshes of every visible world-space
health bar with three dynamic `InstancedMesh` layers:

1. faction-colored frame;
2. dark health track;
3. health-band fill.

The original health-bar objects still calculate visibility, billboard
orientation, width, health ratio, and healthy/warning/critical state. Their
meshes are presentation sources only; the batches copy their matrices and exact
colors. This keeps selection and damage semantics unchanged while removing
repeated draw submission.

For the representative 13 visible bars, the structural budget changes from 39
source calls to three batch calls, avoiding 36 calls per rendered frame. Batch
capacity grows by powers of two and never allocates inside the per-frame loop.

The review also found that the color-only instanced materials explicitly enabled
vertex colors even though their plane geometry has no vertex-color attribute.
That multiplied player/enemy instance colors to black. Instance colors are
already enabled by `InstancedMesh`, so the redundant flag was removed. Desktop
proof shows blue player diamonds and frames, red enemy diamonds and frames, and
green health fill at the correct remaining ratio.

## Matched post-change window

The post-change window retained the same 17 LOD0, one LOD1, 12 culled, 18 marker,
and 13 visible-health-bar state.

| Metric | Baseline | Batched | Change |
| --- | ---: | ---: | ---: |
| Stable-window peak calls | 653 | 605 | -48 (-7.4%) |
| Representative median calls | about 604 | about 555 | about -49 |
| Health-bar calls | 39 | 3 | -36 |
| Peak triangles | 115,158 | 115,578 | comparable combat-VFX variance |
| Geometries | 408-410 | 403-410 | no regression |
| Textures | 142 | 141 | no new texture |

The matched peak samples both had 21 active effects, 17 LOD0 visuals, one LOD1
visual, 12 culled visuals, 13 visible health bars, and 18 faction markers. The
structural health-bar saving is deterministic; the additional observed change
varies slightly with the exact mix of transient effects.

## Guardrails

- Selection rings remain independent and visible.
- Faction markers remain two instanced layers and now render their intended
  blue/red colors.
- Health bars retain faction frame colors and all three health bands.
- Projectile, muzzle, impact, residue, fog, and gameplay logic are unchanged.
- No GLB, Blender source, level, simulation, main, or UI file was changed.
- Dynamic model shadow-caster policy was deliberately left unchanged. Its
  silhouette value outweighs the unproven benefit after the health-bar target
  was met.

Runtime diagnostics expose `healthBarBatchVersion`, `healthBarBatchInstances`,
`healthBarBatches`, `healthBarSourceDrawCalls`, and
`healthBarAvoidedDrawCalls` on the development canvas dataset.
