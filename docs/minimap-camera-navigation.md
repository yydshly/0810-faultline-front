# Desktop minimap camera navigation

The existing tactical minimap is now a camera navigation surface on desktop Web.

## Controls

- Left-click a point to focus the battlefield camera there.
- Hold the left button and drag to continuously move the camera focus.
- Focus the minimap with the keyboard, then press Enter or Space to focus its current navigation point. Before any pointer navigation, this is the map centre.
- Middle- and right-button presses do not navigate. A right-click on the minimap is contained by the HUD rather than becoming a battlefield order.

## Coordinate contract

The HUD converts client coordinates inside the same seven-pixel inset used by minimap rendering into clamped normalized coordinates. The main controller maps those coordinates through the authoritative visibility bounds and calls the existing scene focus API.

This changes only camera focus. It does not reveal fog, select entities, issue commands, mutate simulation state, or enter replay/state hashes. Default and visual-review layouts share the same minimap contract.

## Verification

Pure regression tests cover centre mapping, all edge clamps, invalid rectangles, world-bound conversion, and rejection of non-primary pointer buttons. TypeScript and the HUD test set must pass before browser playthrough verification.
