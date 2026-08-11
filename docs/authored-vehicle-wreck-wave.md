# Authored vehicle wreck presentation wave

## Outcome

The player and enemy main battle tanks and harvesters now carry a dedicated,
normally hidden wreck silhouette in the same published GLB as the live vehicle.
The scene swaps to that silhouette only after a real authoritative `destroyed`
event. No combat values, collision, navigation, targeting, or replay state were
changed.

Asset construction and exact GLB metrics are recorded in
[`vehicle-specific-wreck-assets.md`](./vehicle-specific-wreck-assets.md).

## Runtime contract

- `wreck_visual_root` is a meshless child of the original asset root.
- `presentation_role=wreck_visual`, `default_visible=false`, and
  `runtime_visibility_owner=scene` make ownership explicit.
- The live body remains visible during the existing death reaction. At its end,
  live meshes are hidden and the authored wreck root becomes visible at natural
  scale.
- Health bars, selection, damage smoke, animation, movement dust, and picking
  are disabled for the wreck.
- A low red/blue faction diamond remains, so ownership is readable without
  making the wreck look like a living target.
- High and medium quality retain wrecks for 34 seconds. Low quality and reduced
  motion use a 14-second static equivalent.
- Authored wrecks and generic residues share the existing residue budget:
  12 high, 8 medium, 4 low, and 4 reduced-motion. Authored vehicle silhouettes
  take priority and the oldest presentation is removed first.
- Player losses are always disclosed after their former vision source is
  removed. Enemy losses still require current player visibility, preventing
  fog-of-war information leaks.

## Deterministic desktop fixture

Open:

- `/?fixture=wreck-review&quality=high`
- `/?fixture=wreck-review-reduced&quality=low`

The fixture loads only four authored vehicle masters. Four real tank attacks
are delayed by 4.5 seconds, then destroy one player tank, one enemy tank, one
player harvester, and one enemy harvester. Enemy AI is disabled only in this
fixture. Off-frame HQ anchors preserve the normal victory contract; resources,
blockers, collision, and navigation are unchanged.

## Desktop browser evidence

Viewport: 1280 x 720.

High-quality capture after 6.5 seconds:

- authored assets: 4 requested / 4 loaded / 0 failed / 0 retried;
- first authored model: 503 ms in the final reload;
- authored wreck activations: 4;
- visible authored wrecks: 4;
- authored fallbacks: 0;
- generic duplicate residues: 0;
- render: 100 calls / 34,010 triangles / 58 textures;
- material conflicts and cross-owner reuse: 0;
- browser console warnings and errors: 0.

Reduced-motion low-quality capture after 6.5 seconds:

- authored assets: 4 / 4 / 0 failed / 0 retried;
- authored wrecks: 4 at the hard cap of 4;
- reduced motion: true; shadows: false;
- render: 98 calls / 33,962 triangles / 57 uploaded textures;
- browser console warnings and errors: 0.

Repeated high-quality cold/reload captures reported the same 58 uploaded
textures, with no loader fallback.

## Automated coverage

Tests lock the semantic root, eligible vehicle families, high/low lifetime,
quality caps, stable oldest-first eviction, own-loss disclosure, focused asset
allowlist, flat fixture data, delayed real destruction events, and existing
scene lifecycle behavior.

