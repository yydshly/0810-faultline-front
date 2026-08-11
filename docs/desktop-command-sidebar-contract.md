# Desktop command-sidebar refinement contract

## Design contract

- **Entry mode:** revision-led repair from browser evidence.
- **Request revision:** desktop command sidebar v1.
- **Target user and context:** desktop Web RTS player operating the battlefield at 1280×720 or 1440×900 with mouse and keyboard.
- **Desired first impression:** the battlefield remains the visual anchor; the right edge reads immediately as a purposeful radar-and-production command console rather than an empty reserved strip.
- **Visual ambition:** immersive.
- **Experience architecture:** Spatial Stage.
- **Scene base:** WebGL canvas.
- **Scene persistence:** the battlefield remains visible during selection, radar use, build-category changes, production, help, and recoverable errors.
- **Foreground control model:** a fixed desktop command sidebar, compact top status bar, bottom selection/command dock, and existing modal/drawer layers.
- **State-to-scene mapping:** selection, construction, production, research, warnings, fog, combat, completion, and recovery retain their existing simulation and scene behavior; this revision changes only foreground composition and control placement.
- **Fallback:** the existing semantic buttons, labels, queues, and build cards remain operable if the enhanced WebGL scene falls back.
- **Visual constraints:** use the project's original industrial visual language and icons; reference the information architecture of *Command & Conquer: Red Alert 2 / Yuri's Revenge* without copying copyrighted UI artwork, textures, logos, or exact icon assets.
- **Information constraints:** radar/minimap, economy and infrastructure status, build categories, queues, build cards, save/audio/help access, selection summary, and commands must remain reachable.
- **Operation constraints:** preserve callbacks, shortcuts, focus-visible behavior, Escape handling, overlay mutual exclusion, and focus return. No gameplay command, simulation, save, or replay contract may change.
- **State constraints:** verify populated default, build-category switching, queue/status content, no-selection command state, active selection state, and a foreground help/overlay state where affected.
- **Environment constraints:** desktop Web is the delivery gate. Existing ≤1180 overlay/mobile behavior is preserved but is not redesigned or used as a visual acceptance gate in this revision.
- **Primary journey:** read radar and infrastructure status → choose construction/unit/technology category → inspect and activate an available item → return attention to the persistent battlefield and issue unit commands.
- **User-defined phases:** strict RA2/YR-inspired desktop UI structure; autonomous implementation without repeated confirmation; desktop Web verification first.
- **Required artifacts:** final 1440×900 and 1280×720 browser captures, one category/foreground interaction witness, runtime console observation, automated checks, and this contract.
- **Autonomy authorization:** the user explicitly confirmed the plan, asked for continuous completion, and asked not to be consulted repeatedly for in-scope choices.
- **User-decision boundary:** copying external proprietary assets, changing gameplay or simulation rules, expanding the current gate to a mobile redesign, or publishing externally requires separate authority.

## Observable completion criteria

1. At ≥1181 px, the 316 px right rail is fully composed as one command console: radar at the top, production/category controls and queue/list content below, with save/audio/help utilities integrated without a large inert empty region.
2. The desktop stage and bottom command dock stop at the command rail boundary; no control overlays the rail or becomes unreachable at 1280×720 and 1440×900.
3. Radar, four production categories, visible build/production/research content, and system utilities are keyboard reachable with visible focus and meaningful accessible names.
4. Existing callbacks, queue state, category state, shortcuts, Escape behavior, and focus return remain intact.
5. The battlefield remains the primary visual anchor; the rail uses quieter material contrast than live combat and does not obscure the canvas.
6. Browser evidence is console-clean; TypeScript, the full test suite, and the production build pass. Any remaining performance or interaction boundary is recorded truthfully.

## Coverage manifest

| User phase | Requirement | Surface / state | Evidence needed | Owning stage | Status | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| RA2/YR desktop structure | Purposeful full-height command rail | 1440×900 breakthrough default | Before/after screenshot and DOM geometry | 2–3 | pass | Live radar, production and utilities now form one persistent 316 px console |
| RA2/YR desktop structure | Radar and production hierarchy | Right rail populated state | Screenshot plus category interaction | 3–5 | pass | Four-column tabs and two-column cards verified in the browser |
| Desktop-only validation | No collision at compact desktop | 1280×720 populated and selected states | Screenshot and bounding-box observation | 7 | pass | Stage, rail and command dock remain disjoint at the compact desktop gate |
| Controls | Keyboard/focus/accessible names preserved | Tabs, utilities, help/rail foreground | Browser focus and semantic witness | 4–5 | pass | Click, ArrowRight, Escape and focus return verified |
| Performance/fallback | Persistent scene remains operable | High quality, fallback-capable semantic UI | Runtime metrics, console, fallback source contract | 8 | pass | No scene or semantic fallback contract changed; browser console is clean |
| Engineering closure | No regression | Repository | TypeScript, full tests, build | 9 | pass | TypeScript, 19 files / 183 tests, and production build pass |

## Runnable baseline

- **Start command:** `npm.cmd run dev -- --host 127.0.0.1 --port 4180`
- **Canonical route:** `http://127.0.0.1:4180/?fixture=breakthrough-demo&quality=high`
- **Primary viewport:** 1440×900, dark industrial theme, populated breakthrough state.
- **Adjacent viewport:** 1280×720.
- **Baseline evidence:** `docs/qa/breakthrough-instanced-v1-1440x900-high.png`.
- **Observed defect:** the fixed 316 px desktop rail reserves 21.9% of the viewport, but most of it is visually inert while radar lives at lower left and production is confined to the lower right.

## Actual implementation and evidence

- The existing minimap and utility panel are reparented rather than cloned. `shouldComposeDesktopCommandSidebar()` permits composition only for `layoutMode="default"` with a persistent right rail. At `<=1180px` and in `visual-review`, both live nodes return to their original homes, preserving their references, callbacks and focus behavior.
- The desktop cascade is scoped to `.ff-hud[data-layout-mode="default"]`. The 316 px rail owns an inset 296 px status/radar/production stack, four equal production tabs, two-column production cards and a compact five-control utility strip.
- The bottom command dock ends 10 px before the battlefield/rail boundary; no sidebar control overlaps the WebGL stage.

### Browser captures

- [1440×900 default command sidebar](qa/desktop-command-sidebar-v1-1440x900-high.png)
- [1280×720 compact desktop](qa/desktop-command-sidebar-v1-1280x720-high.png)
- [Defense tab interaction and visible focus](qa/desktop-command-sidebar-v1-defense-interaction-1440x900-high.png)

### Measured geometry

| Viewport | Stage | Sidebar shell | Status bar | Command rail | Radar | Command dock | Utility strip |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | `(0,0) 1124×900` | `(1124,0) 316×900` | `(1134,10) 296×82` | `(1134,102) 296×788` | `(1143,111) 279×184` | `(10,782) 1104×108` | `(1143,828) 279×53` |
| 1280×720 | `(0,0) 964×720` | `(964,0) 316×720` | `(974,10) 296×82` | `(974,102) 296×608` | `(983,111) 279×154` | `(10,602) 944×108` | `(983,648) 279×53` |

The pre-fix 1440 measurement was a 480 px production panel at `x=944`, overlapping the 1124 px stage by 180 px, while the 316 px shell remained mostly empty. The final geometry has a 10 px gap between the command dock and rail boundary at both gates.

### Interaction and responsive witnesses

- Clicking Defense set `aria-selected="true"`, revealed its tabpanel and updated `data-active-tab="armoury"`.
- Pressing `ArrowRight` moved selection to Infantry and updated `data-active-tab="infantry"`.
- Opening Help set `aria-hidden="false"`; Escape restored `aria-hidden="true"` and focus to `.ff-help-button` (`aria-label="打开完整操作指南"`).
- At 1024 px, `data-desktop-command-sidebar="false"`, the minimap returns to the HUD layer, utilities return to `#ff-left-rail`, and the right rail is an inert hidden overlay. Returning to 1440 px recomposes both live nodes.
- `visual-review` remains `data-desktop-command-sidebar="false"` with its original isolated radar and overlay production layout.
- Browser warnings/errors: none.

### Engineering verification

- `npx.cmd tsc --noEmit -p tsconfig.app.json`: pass.
- `npx.cmd vitest run --maxWorkers=1`: 19 files, 183 tests, all pass.
- `npm.cmd run build`: pass; the only warning is the existing Three.js chunk over 500 kB.
