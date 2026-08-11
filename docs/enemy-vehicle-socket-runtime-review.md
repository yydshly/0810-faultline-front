# Enemy vehicle semantic socket runtime review

## Scope

`enemy-vehicle-socket-review` is a deterministic desktop fixture for the
authored enemy suppressor and self-propelled artillery assets.

- Route: `/?fixture=enemy-vehicle-socket-review&quality=high`
- Layout: desktop `visual-review`
- Camera: fixed orthographic focus at the comparison pair, view height 32
- Requested authored assets: `FF-EN-SUP-01`, `FF-EN-ART-01`
- Fog overlay: hidden for review

Only the two enemy vehicles are rendered. Two durable player HQ buildings act
as authoritative static targets and an off-camera enemy HQ preserves the normal
match-end contract. Those three logical buildings remain disclosed to combat
events but are hidden from the comparison frame and excluded from the fixture
asset allowlist.

## Deterministic combat contract

The suppressor begins within range of its target with a 0.65-second cooldown.
It keeps a real attack order and repeatedly fires its dual cannons. Its logical
aim remains authoritative while the fixture presents the chassis with a fixed
36-degree offset, leaving `turret_yaw` visibly non-zero and still aimed at the
target.

The artillery begins at a valid surface distance outside its minimum range with
a 0.85-second cooldown. It keeps a real attack order and uses the authored
non-zero `barrel_pitch` hierarchy. Both vehicles remain stationary while the
normal simulation emits shot, projectile-travel, impact, damage, and cooldown
cycles.

After nine deterministic seconds the focused test requires:

- at least twelve suppressor `shot` events;
- at least two artillery `shot` events;
- at least ten real `impact` events;
- no destroyed target and an active match;
- identical events and state hash for repeated runs with seed 1949.

The targets begin at full HQ durability, resources and blockers are empty, and
the beacon remains off-camera. All authored positions stay on the single flat
gameplay plane.

## Semantic socket evidence

The runtime selects muzzle origins from the imported graph before using its
procedural fallback:

- suppressor: `muzzle_socket_left` and `muzzle_socket_right`;
- artillery: `muzzle_socket`, parented to `barrel_pitch`.

The canvas exposes the following cumulative development metrics for browser
acceptance:

| Dataset metric | Acceptance |
| --- | --- |
| `socketMuzzleLeftShots` | greater than 0 |
| `socketMuzzleRightShots` | greater than 0 |
| `socketMuzzleSingleShots` | greater than 0 |
| `socketFallbacks` | exactly 0 |
| `socketReviewContracts` | exactly 2 |
| `socketReviewSuppressorTurretYawDegrees` | visibly non-zero, approximately 36 degrees after settling |
| `socketReviewArtilleryBarrelPitchDegrees` | visibly non-zero |
| `presentationProjectiles` / `presentationImpacts` | repeatedly observable during live capture |

The per-socket counters increment only after the selected semantic node returns
a finite world position. A missing node, undisclosed source, or invalid world
transform increments `socketFallbacks` instead, so the acceptance values cannot
be satisfied by the procedural muzzle origin.

## Automated coverage

Focused tests verify:

- the exact two-unit lineup, teams, kinds, cooldowns, attack targets, target
  durability, reciprocal disclosure, zero enemy credits, empty level layers,
  off-camera beacon, and flat-level validity;
- repeated real suppressor and artillery shots, impacts, target survival,
  active status, deterministic events, and deterministic state hash;
- the strict two-item authored asset allowlist and bounded review load phase;
- the fixture-only chassis yaw offset and its non-effect on ordinary matches;
- hiding only the logical building participants;
- stable use of both dual-muzzle socket names and the single artillery muzzle
  socket, with a null result when no semantic muzzle exists.

The focused level, asset-loading, scene policy, and runtime lifecycle suites
passed 61 tests, and TypeScript checking completed without errors.

## Desktop browser result

The 1440 x 900/high desktop capture passed. Both authored assets loaded with
zero failures or retries. In the first sustained-fire sample the semantic
muzzle counters were left `23`, right `14`, and single `5`; `socketShots` was
`42`, `socketFallbacks` was `0`, and `socketReviewContracts` was `2`. The live
suppressor turret yaw was approximately `36` degrees and the artillery barrel
pitch approximately `13` degrees. The renderer reported 84 calls, 5,894
triangles, 97 geometries, and 5 uploaded textures for the sampled frame.

A reload repeated the acceptance contract with left `11`, right `8`, single
`3`, fallback `0`, contracts `2`, and two of two assets ready. Both samples had
zero console warnings or errors.

Evidence: [enemy-vehicle-socket-review-1440x900-high.png](qa/enemy-vehicle-socket-review-1440x900-high.png).
