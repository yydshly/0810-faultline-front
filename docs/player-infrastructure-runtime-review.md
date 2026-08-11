# Player infrastructure runtime review

## Scope

This review closes the deterministic desktop runtime integration for the
authored player barracks and reactor. It exercises the released GLB assets in
the real Three.js scene, including authoritative damage and destruction, rather
than injecting presentation-only states.

- Route: `/?fixture=player-infrastructure-review&quality=high`
- Viewport: 1440 x 900
- Quality: high
- Initial evidence: [player-infrastructure-review-initial-1440x900-high.png](qa/player-infrastructure-review-initial-1440x900-high.png)
- Ruin evidence: [player-infrastructure-review-ruins-1440x900-high.png](qa/player-infrastructure-review-ruins-1440x900-high.png)

The fixture presents two rows, one for `FF-BAR-01` and one for `FF-RCT-01`.
Each row contains healthy, 52% damaged, 22% critical, and one-hit destruction
states. Two enemy artillery units remain outside the fixed review frame and
use the real attack, projectile, impact, damage, and destroyed-event path. The
scene hides only these fixture-owned event drivers; it does not fabricate the
resulting ruins.

Both factions retain an off-camera HQ anchor, so destroying the two review
targets cannot end the match. Resources and blockers are empty, the beacon is
off-camera, and all authored entities remain on the single flat gameplay plane.
The fixture uses the desktop `visual-review` layout, a fixed orthographic focus
at the comparison grid, a view height of 50, and a fog-free review presentation.

## Browser result

| Metric | Result |
| --- | ---: |
| Requested / completed assets | 2 / 2 |
| Failed asset loads | 0 |
| Authored assets under review | `FF-BAR-01`, `FF-RCT-01` |
| Damaged / critical buildings at terminal capture | 2 / 2 |
| Visible authored ruins | 2 |
| Authored ruin fallbacks | 0 |
| Generic destruction residues | 0 |
| Ruin faction markers | 2 |
| Renderer calls / triangles | 143 / 11,946 |
| Renderer textures | 35 |
| Browser console warnings / errors | 0 / 0 |

The initial frame proves that all eight subjects are simultaneously readable at
strategic camera scale. In the terminal frame, the two one-hit targets have
been replaced by model-specific authored ruins while the healthy, damaged, and
critical comparison subjects remain present. Damaged and critical roots are
mutually exclusive, and destroyed buildings do not leak either live meshes or
damage-stage overlays through their ruin presentation.

## Deterministic fixture contract

- The healthy subjects start at 100% HP, damaged subjects at 52%, critical
  subjects at 22%, and ruin targets at exactly 1 HP.
- Both event-driver artillery units begin with a 3.7-second cooldown and a real
  attack order targeting the corresponding ruin subject.
- Advancing the simulation by 4.2 seconds produces no `destroyed` event.
  Advancing another 0.6 seconds produces exactly
  `b-player-infra-barracks-ruin-target` and
  `b-player-infra-reactor-ruin-target` as destroyed targets.
- The match remains `active`, both HQ anchors survive, and six live comparison
  buildings remain after the two authoritative destructions.
- Repeating the same seed and time steps produces the same simulation hash.
- The authored asset allowlist intentionally contains only `FF-BAR-01` and
  `FF-RCT-01`; the hidden logical artillery does not expand the two-asset review
  target or its asset panel counts.

Enemy AI is disabled for `player-infrastructure-review` through the existing
review-fixture early-return list in the simulation. This isolates the authored
artillery orders without changing AI behavior in normal matches.

## Automated coverage

The focused automated suite verifies:

- the eight-building lineup, exact HP ratios, teams, rotations, stable IDs,
  off-camera anchors, empty resource and blocker layers, and flat-level
  validity;
- the 4.2-second no-destruction boundary, the exact two authoritative destroyed
  IDs at approximately 4.8 seconds, active match status, surviving lineup, and
  deterministic hash;
- the two-item authored asset allowlist and its bounded, non-deferred review
  phase;
- the shared infrastructure-review fog policy and fixture-specific hiding of
  only the off-camera artillery drivers;
- the existing authored building-damage mutual-exclusion and authored ruin
  policy for barracks and reactor.

The implementation passed its focused level, asset-loading, infrastructure
presentation, and authored-building-ruin tests, as well as TypeScript checking
and the production build. The browser evidence above is the final runtime proof
for the 1440 x 900 high-quality desktop target.
