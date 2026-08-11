# Enemy infrastructure runtime review

## Scope

This review closes the desktop runtime integration for the authored enemy
barracks and reactor. It verifies the released GLB assets inside the real
Three.js scene rather than relying on Blender previews alone.

- Route: `/?fixture=enemy-infrastructure-review&quality=high`
- Viewport: 1440 x 900
- Quality: high, shadows enabled
- Screenshot: [enemy-infrastructure-review-1440x900-high.png](qa/enemy-infrastructure-review-1440x900-high.png)

The top row presents four reactors and the bottom row presents four barracks.
Each row is ordered as healthy, 52% damaged, 22% critical, and a one-hit
destruction target. Two off-camera artillery units use the authoritative attack,
projectile, damage, and destroyed-event path. They are hidden only from the
comparison frame; the resulting ruins are not injected by the presentation
layer.

## Browser result

| Metric | Result |
| --- | ---: |
| Required / loaded assets | 2 / 2 |
| Failed / retried loads | 0 / 0 |
| First authored asset | 285 ms |
| Authored damage contracts | 8 |
| Damaged / critical buildings | 2 / 2 |
| Authored ruin activations | 2 |
| Visible authored ruins / ruin modules | 2 / 8 |
| Authored ruin fallbacks | 0 |
| Generic building-rubble residues | 0 |
| Live or damage meshes leaking through ruins | 0 |
| Ruin faction markers / privacy violations | 2 / 0 |
| Renderer calls / triangles | 154 / 14,258 |
| Renderer geometries / textures | 122 / 5 |
| Browser warnings / errors | 0 / 0 |

The scene therefore proves all four lifecycle states at strategic camera scale.
Healthy silhouettes remain distinct, the two damage thresholds are mutually
exclusive, and each destroyed target switches to the model-specific four-part
ruin without a generic fallback.

## Runtime contract

`AUTHORED_BUILDING_RUIN_POLICY` is now `authored-building-ruin-v2` and accepts
`hq`, `factory`, `barracks`, and `reactor`. The runtime still requires a valid
`ruin_visual_root`; an older building without that root uses the established
generic fallback. This keeps player barracks/reactor assets backward-compatible
while enabling the new enemy assets.

The review fixture disables fog only for visual inspection, preserves
authoritative visibility data, hides its logical artillery from the comparison
frame, and explicitly permits only its own destroyed targets and low ruin
markers to be disclosed. Normal matches retain the existing fog and enemy-loss
privacy rules.

Asset construction, budgets, source ownership, and rollback information are in
[enemy-barracks-reactor-visual-gold.md](enemy-barracks-reactor-visual-gold.md).
