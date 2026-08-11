# Semantic generic destruction residues

`semantic-generic-residue-v1` replaces the former one-shape-fits-all tracked wreck used when no dedicated authored wreck is available. It is presentation-only: simulation damage, visibility, unit definitions and authored GLBs are unchanged.

| Destroyed kind | Persistent family | Readability contract |
| --- | --- | --- |
| rifle, engineer, antitank | none | Existing death animation/collapse completes, then the visual is removed. |
| scout | light-vehicle | Compact chassis, collapsed cabin and hood fragment. |
| suppressor | wide-armor | Wide low chassis, upper armor and fallen plate. |
| artillery | artillery | Long chassis, breech and clearly fallen barrel. |
| tank, harvester authored fallback | tracked-vehicle | Low chassis and two tracks; no invented generic turret. |
| any building without an authored ruin | building-rubble | Ground stain plus three irregular structural slabs. |
| missing same-tick kind information | unknown-debris | Neutral stain and two fragments; never guesses tracks or a turret. |

Every rendered generic family uses existing shared geometries/materials, adds zero textures and contains at most four meshes including the ground stain. Generic residues use the same `34s` desktop / `14s` low-or-reduced-motion lifetime and the same `12/8/4` shared residue cap as authored vehicle wrecks and core-building ruins. New residues are created only after the existing death/collapse presentation completes; the no-visual same-tick fallback is immediate because there is no live visual to animate.

Development metrics expose `presentationResidueFamilyVersion`, `presentationResidueFamilies`, one counter per rendered family, total generic residue meshes, the per-residue mesh budget, and `presentationGenericResidueMeshBudgetViolations`. Acceptance requires zero mesh-budget violations and `presentationResidues <= persistentResidueCap` after effects settle.

## Desktop review fixtures

- `/?fixture=destruction-residue-review&quality=high`
- `/?fixture=destruction-residue-review-reduced&quality=low`

Both fixtures use six real low-health targets and real artillery projectiles. After roughly 4.45 seconds, the scout, suppressor and artillery leave three distinct vehicle families; rifle, engineer and antitank finish their death presentation and leave only ground scorch. The off-camera attackers are not disclosed to the player.

| 1280×720 review | High | Low + reduced motion |
| --- | ---: | ---: |
| requested / loaded assets | 6 / 6 | 6 / 6 |
| failed / retried assets | 0 / 0 | 0 / 0 |
| light / wide / artillery residues | 1 / 1 / 1 | 1 / 1 / 1 |
| persistent residues / meshes | 3 / 12 | 3 / 12 |
| mesh-budget violations | 0 | 0 |
| renderer calls / triangles | 65 / 1,498 | 60 / 1,378 |
| console errors or warnings | 0 | 0 |

Final verification: TypeScript passes; the complete Vitest suite passes with 24 files and 230 tests; the 42-model GLB/KTX2 contract and production build are part of the repository-wide release gate.
