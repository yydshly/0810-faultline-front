# Combat VFX readability v2

Status: implemented for the desktop Web breakthrough encounter.

## Presentation contract

The heavy-impact effect communicates artillery/cannon contact without changing the simulation. Its trigger remains the existing visible `impact` or `destroyed` event; its owner/team tint still comes only from disclosed combat information. Damage, gameplay radius, event generation, AI, and state hashing are untouched.

| Layer | Gameplay meaning | Desktop-camera silhouette | Lifetime / cleanup |
| --- | --- | --- | --- |
| Team contact ring | who caused a disclosed hit | outer radius `<= 2.20m` (stricter than the `4.2m` safety ceiling) | part of the `0.60s` root effect |
| Orange ground flash | exact contact point | compact filled contact visible at frame zero | hidden after 38% progress |
| Orange fire + upper blast | heavy ordnance, not a rifle impact | minimum heavy profile is at least 25% larger in contact area and height than the largest ballistic profile | fire hidden after 62%; upper blast after 52% |
| Low-opacity shockwave | outward pressure, secondary hierarchy | outer radius `<= 2.25m` (stricter than the `4.6m` safety ceiling), opacity `0.30` | hidden after 62% progress |
| Dust, smoke, scorch, chips | aftermath and terrain persistence | muted earth/graphite; does not replace the contact point | root dust/chips are removed with the effect; pooled/shared resources remain owned by the scene; existing smoke/scorch cleanup is unchanged |

The shockwave has a dedicated non-white, non-additive `MeshBasicMaterial`; it no longer reuses the `0.96` opacity additive muzzle-core material. This adds no texture and reuses the existing ring geometry contract. Each impact also reuses one preallocated layer-metrics object during animation, avoiding per-frame VFX allocation.

## Budgets and accessibility

- Heavy-explosion roots: low `2`, medium `3`, high `4`.
- Reduced motion: at most `2` roots at every quality level, no chips/sparks/upper blast, and main lifetime capped at `0.18s`.
- Normal ballistic impact coefficients and `0.34s` lifetime are unchanged.
- At the 1440 x 900 breakthrough reference framing (`48m` orthographic height), the worst-case horizontal diameter is `82.5px` for the contact ring and `84.4px` for the shockwave.
- On overflow, the oldest effect in a family is removed first, preserving the newest contact feedback.
- Heavy main flash/ring lifetime is capped at `0.60s`; independent smoke and scorch may remain under their existing family caps.

## Browser evidence contract

The development canvas publishes:

- `data-presentation-heavy-explosion-cap`
- `data-presentation-heavy-max-ring-radius="2.2"`
- `data-presentation-heavy-max-shockwave-radius="2.25"`
- `data-presentation-combat-vfx-version="heavy-impact-v2"`

These metrics let the deterministic breakthrough fixture assert the active quality/reduced-motion cap and presentation version without coupling tests to simulation state.

## Automated coverage

`scene-vfx-readability.test.ts` covers quality caps, reduced-motion convergence, radius bounds across the full progress range, lifetime bounds, ballistic coefficient preservation, heavy-vs-ballistic contact hierarchy, and oldest-first overlap trimming. Existing lifecycle and material tests carry the updated policy values.
