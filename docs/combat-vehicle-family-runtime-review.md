# Combat vehicle family runtime review

## Scope

`combat-vehicle-family-review` is the stable strategic-camera comparison fixture
for the player and enemy scout, suppressor, and self-propelled artillery assets.
It is intended to provide an unchanged before-and-after frame while the three
player vehicles are rebuilt.

- Route: `/?fixture=combat-vehicle-family-review&quality=high`
- Layout: desktop `visual-review`
- Camera: fixed orthographic focus at the lineup center, view height 48
- Fog overlay: hidden for review
- Requested assets: `FF-SCT-01`, `FF-SUP-01`, `FF-ART-01`, `FF-EN-SCT-01`,
  `FF-EN-SUP-01`, and `FF-EN-ART-01`

The scene uses three profession rows: scout, suppressor, and artillery. Player
vehicles occupy the left column and enemy vehicles occupy the right column.
Every unit starts at full health, rotation zero, an idle order, and a forward
weapon presentation. No selection, damage, recoil, projectile, impact, or
explosion state is authored into the fixture.

Two off-camera HQ anchors preserve the ordinary match-end contract. Resources
are empty and the beacon remains off-camera. A fixture-only vision divider has
`blocksMovement=false` and is never rendered; it prevents idle target
acquisition across the comparison columns without adding collision or changing
the single flat gameplay plane. The scene discloses the three enemy review
vehicles only for this fog-free visual fixture.

## Deterministic contract

Automated coverage requires:

- exactly six review units and one instance of every `team:kind` combination;
- full HP, rotation zero, idle orders, and unchanged positions;
- no simulation events after 30 seconds;
- active match status and identical state hash for repeated seed-1949 runs;
- exactly two surviving off-camera HQ anchors;
- no resources and no walkable collision from the hidden vision divider;
- a strict, bounded six-item authored asset load phase.

Enemy AI is disabled through the simulation's existing review-fixture
early-return list. This affects only `combat-vehicle-family-review`; normal
matches retain their existing AI behavior.

## Browser acceptance metrics

The canvas publishes explicit development metrics for a 1440 x 900/high
browser capture:

| Dataset metric | Acceptance |
| --- | ---: |
| `combatVehicleFamilyEntities` | 6 |
| `combatVehicleFamilyContracts` | 6 |
| `combatVehicleFamilyFallbacks` | 0 |
| `combatVehicleFamilyPlayerEntities` | 3 |
| `combatVehicleFamilyEnemyEntities` | 3 |
| `combatVehicleFamilyScoutEntities` | 2 |
| `combatVehicleFamilySuppressorEntities` | 2 |
| `combatVehicleFamilyArtilleryEntities` | 2 |
| `combatVehicleFamilyAssetFailures` | 0 |
| `combatVehicleFamilyCombatVfx` | 0 |

A contract is counted only when the corresponding stable review ID is backed
by an `authored-v1` entity model key. A procedural model therefore reduces the
contract count and increments the family fallback count rather than passing as
an authored vehicle.

The final browser frame should show all six silhouettes without overlap, with
the scout, suppressor turret, and artillery barrel readable in both faction
columns. The asset loader must report six requested and six completed assets,
zero failed or retried loads, and the browser console must contain no warning or
error attributable to the fixture.

## Automated result

Focused level, asset-loading, and scene-policy tests verify the lineup,
long-running static state, no-event contract, deterministic hash, allowlist,
fixture-only visibility policies, and the complete six-contract metric matrix.
The final focused run passed six tests, and TypeScript checking completed
without errors.

## Pre-rebuild desktop baseline

The stable 1440 x 900/high baseline was captured before replacing the three
player vehicles. All six assets were requested, completed, and loaded with zero
failures or retries. The fixture reported six entities, six authored contracts,
zero fallbacks, three vehicles per faction, two per profession, and zero combat
VFX. The browser console had no warning or error. The sampled renderer frame
reported 146 calls, 16,262 triangles, 162 geometries, and 59 uploaded textures.

Baseline evidence: [combat-vehicle-family-before-1440x900-high.png](qa/combat-vehicle-family-before-1440x900-high.png).

The final post-rebuild result is recorded only after the three new player GLBs
are published and the same route, viewport, and quality tier are reloaded.

## Post-rebuild publication

The three player assets are now published and pass their asset-side gates:

| Asset | Public bytes | Triangles | Primitives | Materials | Images |
| --- | ---: | ---: | ---: | ---: | ---: |
| `FF-SCT-01` | 130,844 | 1,624 | 12 | 7 | 0 |
| `FF-SUP-01` | 190,056 | 2,492 | 11 | 7 | 0 |
| `FF-ART-01` | 170,464 | 2,172 | 12 | 7 | 0 |

Together they fell from 2,127,712 to 491,364 public bytes, from 9,768 to
6,288 triangles, from 69 to 35 primitives, and from 54 embedded images to zero.
All existing chassis, turret, radar, barrel, muzzle, and selection transforms
and extras have zero drift. The full 42-asset library and 21 validator/mutation
tests pass. Asset previews and SHA records are in
[player-support-vehicle-visual-gold.md](player-support-vehicle-visual-gold.md).

The post-rebuild in-app browser reload was blocked by the browser security
review after the files were published. No alternate browser was used. Therefore
this document does not claim a final Three.js screenshot or post-rebuild render
calls; the deterministic route, loader metrics, and unchanged pre-rebuild frame
remain ready for the next permitted desktop browser pass.
