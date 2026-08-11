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
If the attacker is already visible, no investigation order is created: the existing
target acquisition and tactical AI remain authoritative for normal frontal combat.

Up to four idle combat units within 34 metres investigate that last firing
position. An HQ contact expands the local response to at most six defenders within
42 metres. Responders use the normal `attackMove` order, pathfinding, line of sight,
target acquisition, range, cooldown, and damage rules. Generic AI intents cannot
overwrite an active local response. After ten seconds without a refreshed contact,
the units return to their captured guard positions and rejoin normal control.

In breakthrough missions the investigation response activates in the final
`command` phase, while strategic economy AI remains disabled. Earlier authored
frontline, counterattack, and reinforcement phases retain their validated pacing.
Mission waves already executing an order are not commandeered, so the mission
director keeps control of authored counterattacks and final pressure.

## Determinism and cleanup

The response memory and alert cooldowns are tick-based, included in deterministic
state hashing, cleared on restart, and pruned when responders are destroyed. No
wall-clock time, rendered pose, browser state, or random target choice enters the
decision.

## Regression gates

- a real projectile hit emits one player alert without exposing the attacker ID;
- artillery outside enemy vision damages a building and nearby idle defenders
  receive an `attackMove` order toward the firing position;
- the attacker remains absent from enemy `visibleEnemyIds` at contact time;
- the same seed and setup produce identical hashes;
- responders return to their original guard position after the contact expires;
- the alert event maps to the warning audio cue.
