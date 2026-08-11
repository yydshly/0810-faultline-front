import { describe, expect, it } from 'vitest';

import {
  breakthroughPreparationGuide,
  shouldComposeDesktopCommandSidebar,
  shouldPauseForTacticalOverlay,
} from './ui';

describe('desktop command sidebar composition', () => {
  it('composes the default desktop rail only when the right rail is persistent', () => {
    expect(shouldComposeDesktopCommandSidebar('default', false)).toBe(true);
    expect(shouldComposeDesktopCommandSidebar('default', true)).toBe(false);
  });

  it('keeps the visual-review fixture in its isolated overlay layout', () => {
    expect(shouldComposeDesktopCommandSidebar('visual-review', false)).toBe(false);
    expect(shouldComposeDesktopCommandSidebar('visual-review', true)).toBe(false);
  });
});

describe('tactical overlay pause policy', () => {
  it('pauses for modal task/help overlays but not the persistent desktop command rail', () => {
    expect(shouldPauseForTacticalOverlay(true, false, false, false)).toBe(true);
    expect(shouldPauseForTacticalOverlay(false, true, false, false)).toBe(true);
    expect(shouldPauseForTacticalOverlay(false, false, true, true)).toBe(true);
    expect(shouldPauseForTacticalOverlay(false, false, true, false)).toBe(false);
    expect(shouldPauseForTacticalOverlay(false, false, false, false, true)).toBe(true);
    expect(shouldPauseForTacticalOverlay(false, false, false, false)).toBe(false);
  });
});

describe('golden match preparation guidance', () => {
  it('turns the three readiness gates into one explicit next action', () => {
    expect(breakthroughPreparationGuide(false, false, false)).toMatchObject({
      action: 'wait-deposit',
      buttonDisabled: true,
    });
    expect(breakthroughPreparationGuide(true, false, false)).toMatchObject({
      action: 'build-sentry',
      buttonDisabled: false,
    });
    expect(breakthroughPreparationGuide(true, true, false)).toMatchObject({
      action: 'open-vehicles',
      buttonDisabled: false,
    });
    expect(breakthroughPreparationGuide(true, true, true)).toMatchObject({
      action: 'complete',
      buttonDisabled: true,
    });
  });

  it('shows the authoritative queue wait instead of asking for a duplicate vehicle', () => {
    expect(breakthroughPreparationGuide(true, true, false, 18.2)).toEqual({
      action: 'wait-vehicle',
      detail: '① 回炼完成 · ② 哨戒塔完成 · ③ 战斗载具生产中（约 19 秒）',
      buttonLabel: '第三步 · 载具生产中 19s',
      buttonDisabled: true,
    });
  });
});
