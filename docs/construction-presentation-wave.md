# Three-stage construction presentation

This wave replaces the old full-building Y-axis compression with a presentation-only, three-stage construction system. Simulation `buildProgress`, footprint, cancellation, destruction, and completion remain authoritative.

## Stage contract

| Authoritative progress | Stage | Presentation |
| --- | --- | --- |
| `[0, 0.28)` | foundation | footprint-sized slab; authored body hidden |
| `[0.28, 0.68)` | frame | slab plus twelve reusable frame members; authored body hidden |
| `[0.68, 0.995)` | shell | slab, frame, full-height translucent shell proxy, and the authored body at its natural `scaleY = 1` |
| `[0.995, 1]` | complete | all construction overlays released; authored body remains at natural proportion |

The shell uses a safe module reveal instead of material clipping. No imported/shared GLB material is cloned, mutated, or given a clipping plane. This avoids cross-entity material leakage during asset hot replacement and keeps authored textures untouched.

## Runtime and lifecycle

- Foundation, frame, shell, and scan are four shared `InstancedMesh` batches using cached box geometry.
- The construction representation is procedural runtime dressing. It adds no textures and changes no collision, navigation, footprint, or gameplay height.
- Each frame rebuilds batch counts from the currently disclosed, live entity visuals. Cancellation/removal, destruction, completion, and authored-model hot replacement therefore drop obsolete instances without per-site GPU ownership.
- Batch instance attributes are disposed with the scene. The two presentation-only materials are owned by the scene and disposed exactly once through the normal material registry.
- The scan receives a short activation window only when authoritative `buildProgress` moves forward. An unchanged value, regression, completion, or cosmetic time alone cannot wake it.
- Reduced-motion keeps the same stage information and a static scan marker; only scan rotation/pulse is removed.

## Budget

Worst case per visible construction site is one foundation box, twelve frame boxes, one shell box, and one scan box. Six simultaneous sites are therefore bounded at:

- 4 additional draw calls;
- 1,080 visible triangles (box upper bound);
- 0 additional textures.

The shared batches reserve room for 64 disclosed construction sites. Sites beyond that defensive ceiling keep their authoritative building state but do not allocate unbounded presentation geometry.

## Development metrics

The battlefield canvas exposes:

- `data-construction-presentation-version="construction-stages-v1"`;
- `data-presentation-construction-foundation`, `-frame`, and `-shell`;
- `data-presentation-construction-natural-scale`;
- `data-construction-batch-calls`, `-instances`, and `-triangles`;
- `data-construction-textures`;
- existing `data-presentation-active-construction-scans`.

## Verification

`scene-construction-presentation.test.ts` locks stage boundaries, additive stage semantics, natural authored-body scale, forward-progress-only scan activation, reduced-motion equivalence, cleanup at completion, and the six-site rendering budget.

The desktop-only `construction-review` fixture loads the sixteen player/enemy building masters plus a non-combat engineer observer asset. It lays out all fourteen buildable faction variants at progress `0.15 / 0.48 / 0.82`, disables only the visual fog overlay for inspection, and keeps enemy disclosure on the normal visibility system.

### Desktop browser evidence

- `1280×720 / high`: 17/17 assets ready; 14 construction sites and 7 enemy sites remained stable beyond 1:40; foundation/frame/shell = 6/4/4; natural scale = 14/14; 3 construction calls / 114 instances / 1,368 triangles / 0 textures; full frame 222 calls / 25,266 triangles / 74 textures.
- `1280×720 / reduced`: 14/7 and 6/4/4 remain readable; natural scale = 14; active scans = 0; the construction batches remain 3 / 114 / 1,368 with no animated pulse.
- `dynamic-review / high`: one authoritative in-progress shell site, natural scale = 1, active scan = 1; 4 construction calls / 15 instances / 180 triangles; full frame 401 calls / 83,656 triangles / 219 textures.
- All three runs reported zero authored-asset failures, retries, and browser console errors.
