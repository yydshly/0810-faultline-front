# Desktop terminal playability closeout

## Release-candidate scope

This closeout covers the desktop Web build at a 1440 × 900 viewport with the
`high` quality profile. It now includes a natural terminal victory on the
ordinary breakthrough route, not only deterministic result-review evidence.

The evidence paths remain deliberately separate:

1. an ordinary `breakthrough-demo` playthrough reached victory naturally after
   one player-issued attack-move command; and
2. deterministic result-review routes continue to cover repeatable victory,
   defeat, result-dialog, and retry regressions.

The natural browser run proves victory. It does **not** claim that defeat was
reached naturally; defeat remains covered by the deterministic review route.

## Desktop acceptance matrix

| Area | Desktop browser evidence | Result |
| --- | --- | --- |
| Launch | The high-quality scene opened at 1440 × 900 and completed its required asset load without an observed load failure. | Pass |
| Economy | Credits increased through the live economy loop and cargo unloading produced visible resource feedback. | Pass |
| Production | A unit production order was accepted and completed through the normal production UI. | Pass |
| Construction | Invalid placement reported coverage/overlap feedback; a valid reactor placement completed. | Pass |
| Technology | The technology interaction completed and its UI state updated. | Pass |
| Save/load | A saved desktop state was restored through the normal save/load flow. | Pass |
| Selection and control groups | `Ctrl+1` stored the selected force and `1` restored all 10 units. | Pass |
| Attack-move | The opening 10-unit force accepted one attack-move toward world position approximately `{42, -39}` after the destination was located through the minimap. No follow-up command was issued. | Pass |
| Mission progression | The ordinary breakthrough route advanced from phase 1/5 through phase 5/5 and then completed naturally. | Pass |
| Natural victory terminal state | At `02:51`, the enemy core was at 17% and four surviving units were still advancing. At `02:56`, the ordinary route displayed `战区已控制`, reported `敌方指挥核心被摧毁`, and marked the mission complete. | Pass |
| Deterministic defeat terminal state | The defeat review displayed `指挥核心失守`, reported `指挥核心被摧毁`, and exposed `再次部署`. This is deterministic review evidence, not a natural-defeat claim. | Pass |
| Retry | Selecting `再次部署` after the natural victory returned to the ordinary breakthrough route at approximately `00:01`. The result-review routes also return to the ordinary route with the result dialog closed. | Pass |
| Console health | The natural victory and retry path produced zero browser console warnings and zero errors. | Pass |

## Natural victory browser evidence

The representative route was:

`http://127.0.0.1:4180/?fixture=breakthrough-demo&quality=high`

The viewport was 1440 × 900 and quality was `high`. The opening 10-unit force
was retained. The minimap was used to position the camera over the southeast
command sector at world position approximately `{42, -39}`, then one
attack-move command was issued to that location. No additional move, attack,
selection, or production command was used to force the ending.

At `02:51`, the ordinary mission remained active with the enemy core at 17%
and four units continuing the assault. At `02:56`, normal simulation combat
destroyed the enemy command core and produced the natural victory result:

- result title: `战区已控制`;
- result reason: `敌方指挥核心被摧毁`;
- mission state: complete;
- browser console warnings: 0;
- browser console errors: 0.

Selecting `再次部署` returned to the ordinary breakthrough route at about
`00:01`. The captured terminal frame is available at
[breakthrough-natural-victory-1440x900-high.png](qa/breakthrough-natural-victory-1440x900-high.png).

## Breakthrough formation-navigation closeout

The earlier phase-5 playthrough exposed a navigation soft lock. Multiple units
received separate formation destinations, but their A* routes converged on the
same intermediate grid corner. The mover required every unit centre to enter a
strict 0.3-unit radius before advancing to the next waypoint. Large vehicles,
with collision separation active, could therefore hold each other outside that
radius indefinitely. The route also remained stale after a blocking defense was
destroyed.

The minimal deterministic fix changes only intermediate A* waypoint acceptance:

`unit radius + 0.2 navigation padding + 0.75 half-grid allowance`

The final formation destination retains the original strict 0.3-unit arrival
rule. The fix adds no runtime state, wall-clock state, save field, replay field,
hash input, or schema migration. A mirrored deterministic assault produces the
same state hash during the route and at victory.

Detailed evidence and regression boundaries are recorded in
[breakthrough-formation-navigation-closeout.md](breakthrough-formation-navigation-closeout.md).

## P1 camera, target acquisition, and minimap navigation

The earlier desktop playthrough exposed two camera/selection symptoms:

- if the game stage was clipped past the left side of the browser viewport,
  edge-pan used the off-screen DOM edge and the player could not pan back from
  the visible left edge; and
- a building close to the right command rail could be difficult to reacquire at
  the late-mission camera scale.

Edge-pan now uses the visible intersection of the stage and browser viewport.
The activation band is 36 CSS pixels instead of the previous 14-pixel binary
strip. Edge input now eases toward an 18 screen-unit/second maximum and eases
out more quickly after leaving the edge, instead of jumping directly to full
speed. Pointer tracking continues
at window level when the cursor crosses from the canvas into non-interactive
shell space. A matching 36-pixel viewport-edge fallback keeps all four physical
screen edges active, including the far side of the fixed command rail. Only
actual buttons, links, form controls, dialogs, and the interactive minimap
suppress edge-pan; empty topbar, dock, and rail surfaces no longer disable it.

Edge, arrow-key, and middle-drag input is converted from screen space through
the fixed 45-degree camera yaw before changing the world target. Vertical input
also compensates for the 55-degree ground-projection shortening, so all four
directions have the same perceived screen speed instead of drifting or feeling
slower along raw world X/Z axes. Corner input is magnitude-limited, and camera
movement enters a 14-world-unit soft boundary zone before reaching an inset
world limit. Both world axes slow and clamp as one vector, preventing the prior
one-axis stop, diagonal shear, and abrupt overscan into the dark map exterior.

Regression coverage locks the progressive response and the 1280 x 720 layout
where the visible battlefield ends at x=964 and the remaining 316 pixels belong
to the command rail. The rail interior remains quiet, while its outermost edge
still pans right unless the pointer is on a real control. Building acquisition
has a larger screen-space fallback while still excluding hidden, resource,
destroyed, destruction-in-progress, and authored-ruin roots.

The existing minimap is also an explicit camera navigation surface: desktop
left-click and drag reposition camera focus, while Enter or Space activates the
current keyboard focus. Coordinates are clamped and mapped through authoritative
world bounds. This camera-only path does not change fog, selection, commands,
simulation state, replays, or hashes. See
[minimap-camera-navigation.md](minimap-camera-navigation.md).

## Breakthrough render closeout

The representative performance route is:

`/?fixture=breakthrough-demo&quality=high`

Both measurements used the same 1440 × 900 high-quality encounter window. The
13 visible health bars previously submitted three independent meshes each. They
now use three shared instance batches while preserving faction-colored frames,
dark tracks, green/yellow/red fill bands, billboard behavior, and health ratio.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Health-bar submissions | 39 | 3 | -36 |
| Stable-window peak draw calls | 653 | 605 | -48 (-7.4%) |
| Representative median draw calls | about 604 | about 555 | about -49 |

This is a matched draw-submission comparison. Browser frame-time sampling was
not available in the review surface, so this closeout makes no unsupported FPS
or frame-time claim.

## Regression boundary

The tested release-candidate surface is:

- viewport: 1440 × 900;
- quality: `high`;
- input: desktop mouse and keyboard;
- natural terminal evidence: ordinary breakthrough victory after one
  attack-move command and no follow-up command;
- deterministic terminal evidence: victory and defeat review routes;
- retry evidence: natural victory back to the ordinary route at about `00:01`;
- performance evidence: the matched breakthrough encounter described above.

This pass does not certify mobile layouts, touch controls, other viewport sizes,
other quality tiers, or natural defeat. Changes to navigation waypoints, unit
separation, stage clipping, camera bounds, minimap mapping, entity picking,
health-bar batching, result routing, or the right command rail should re-run the
focused checks.

## Repeatable verification URLs

- Ordinary natural campaign and performance representative:
  `http://127.0.0.1:4180/?fixture=breakthrough-demo&quality=high`
- Deterministic victory review:
  `http://127.0.0.1:4180/?fixture=breakthrough-demo-victory-review&quality=high`
- Deterministic defeat review:
  `http://127.0.0.1:4180/?fixture=breakthrough-demo-defeat-review&quality=high`

For the ordinary route, retain the opening 10-unit force, locate approximately
`{42, -39}` through the minimap, issue one attack-move, and do not issue a
follow-up command. Confirm continued progress at the former shared waypoint,
natural victory, the exact Chinese result text, zero console warnings/errors,
and retry back to the ordinary route. Deterministic defeat remains a separate
review-route check.

## Remaining non-blocking issue

The production build still reports the existing Three.js chunk-size warning
(approximately 550 kB against the 500 kB advisory threshold). It is a packaging
advisory, not a runtime failure. Code splitting remains a later optimization.

## Final repository quality gate

After formation navigation, minimap camera navigation, the player infrastructure
review fixture, and the final asset publication were frozen, the repository passed:

- TypeScript project build with no errors;
- 27 test files and 249 tests;
- replay and state-hash determinism checks; and
- 42 / 42 GLB/KTX2 contracts, 17 / 17 validator mutation tests, the Vite
  production build, and the natural browser victory path described above.
