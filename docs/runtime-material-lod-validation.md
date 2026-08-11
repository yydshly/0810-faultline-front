# Runtime material ownership and presentation LOD

Imported GLB materials are keyed by the ownership and descriptor APIs in
`imported-materials.ts`. The default owner is the authored GLB label. A runtime
descriptor includes the material/shader parameters plus the UUID of every
texture and texture source, so identical authored names cannot connect an asset
to another asset's texture. Cross-owner material reuse is forbidden and is
reported by `materialCrossOwnerReuse`; the expected value is always `0`.

Entity presentation LOD uses orthographic projected pixel height, planar
distance from the camera target, an expanded ground-view boundary, and 15%
hysteresis. Selected, firing, hit, constructing, and producing entities force
LOD0 while they remain in the expanded view. Current assets expose only LOD0
geometry, so LOD1/LOD2 safely retain that silhouette while hiding explicitly
decorative nodes, disabling dynamic mesh shadows, and updating rig/secondary
mechanism animation at 1/2/4-frame cadence. Position interpolation, body and
turret aim, selection rings, health bars, picking, and simulation remain
full-rate.

Development canvas metrics:

- `lod0`, `lod1`, `lod2`, `lodCulled`
- `lodAnimated`, `lodShadowCaster`, `lodSwitches`
- `materialOwnerCount`, `materialInstanceCount`, `materialConflictCount`
- `materialCrossOwnerReuse` (must be `0`)

## Runtime lifecycle safeguards

- A visible `destroyed` event may reuse the previous entity visual after the
  simulation has removed the entity. This preserves death/collapse animation
  and selects the correct unit or building residue.
- Loader initialization rejection resolves to procedural fallback. Asset labels
  are committed as loaded only after material normalization and template
  integration complete; every phase returns to `idle` through a finalizer.
- Build ghosts include an authored/fallback model key and asset revision. An
  open ghost is rebuilt in place when its GLB arrives, preserving position,
  rotation, validity, and footprint.
- Effect budgets are enforced as one family/decorative/global policy both when
  effects are added and immediately after quality or reduced-motion changes.
- Impacts from undisclosed sources use one neutral anonymous ballistic contact;
  faction color, damage, splash radius, and heavy-weapon class remain hidden.
- Failed imported scenes dispose each shared geometry, material, and texture at
  most once per scene traversal.
