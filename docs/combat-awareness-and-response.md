# Combat awareness and local defense response

This wave closes two related RTS feedback gaps without changing weapon damage,
fog-of-war authority, mission timing, or authored assets.

## Player attack alerts

Applied enemy damage to a player entity emits a rate-limited `alert` event and
an equivalent HUD notification. Alerts are grouped into four independent
categories with a four-second cooldown:

- combat unit: `我方部队遭到攻击`;
- harvester: `采矿车遭到袭击`;
- building: the building label followed by `遭到攻击`;
- HQ: `指挥核心遭到攻击`.

The alert event contains the friendly target and impact position but deliberately
omits the hidden attacker ID. The scene renders the existing danger marker at the
friendly position, the HUD keeps a pulsing minimap contact for the notification
lifetime, and audio maps the event to the existing high-priority warning cue. Text
and both visual equivalents remain available when audio is muted.

## Enemy local response

When player fire damages an enemy entity, the simulation records the firing
position carried by the authoritative pending impact. It does not add the attacker
to `visibleEnemyIds` and therefore does not grant the AI full fog-of-war knowledge.
The response is created whether the attacker is currently visible or only known by
its firing position. This matters in the authored breakthrough mission, where the
strategic economy AI is disabled and shared team vision alone does not cause a
distant guard to leave its post.

Up to four idle or repositioning combat units within 34 metres investigate a local
contact. An HQ alarm expands the response to at most six defenders within 42 metres.
Responders use the normal `attackMove` order,
pathfinding, line of sight, target acquisition, range, cooldown, and damage rules.
Units already attacking, executing an attack-move wave, gathering, or repairing are
not commandeered. Generic AI intents cannot overwrite an active local response.
After ten seconds without a refreshed contact, the units return to their captured
guard positions and rejoin normal control.

In breakthrough missions the response is active in every phase once the player
actually damages an enemy entity. Opening guards therefore remain staged until the
player initiates combat, but no longer watch a facility be destroyed without moving.
Before the final `command` phase, the authored mission limits each alarm to the two
nearest eligible guards so the response is readable without overwhelming the golden
route. The normal four-unit limit (six for HQ) applies in the final phase.
Mission waves already executing an attack or attack-move order are not commandeered,
so the mission director keeps control of authored counterattacks and final pressure.

## Determinism and cleanup

The response memory and alert cooldowns are tick-based, included in deterministic
state hashing, cleared on restart, and pruned when responders are destroyed. No
wall-clock time, rendered pose, browser state, or random target choice enters the
decision.

## Regression gates

- a real projectile hit emits one player alert without exposing the attacker ID;
- artillery outside enemy vision damages a building and nearby idle defenders
  receive an `attackMove` order toward the firing position;
- the same response remains active during breakthrough deployment and when another
  enemy observer already discloses the attacker;
- the attacker remains absent from enemy `visibleEnemyIds` at contact time;
- the same seed and setup produce identical hashes;
- responders return to their original guard position after the contact expires;
- the alert event maps to the warning audio cue.
