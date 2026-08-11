import { describe, expect, it } from 'vitest';

import {
  FACTION_VISUALS,
  HEALTH_BAR_PRESENTATION,
  factionCssColor,
  factionVisual,
  healthVisualBand,
  shouldShowHealthBar,
} from './faction-visuals';

describe('faction visual system', () => {
  it('uses a blue-forward player identity and red-forward enemy identity', () => {
    const player = FACTION_VISUALS.player.bright;
    const enemy = FACTION_VISUALS.enemy.bright;
    expect(player & 0xff).toBeGreaterThan((player >> 16) & 0xff);
    expect((enemy >> 16) & 0xff).toBeGreaterThan(enemy & 0xff);
    expect(player).not.toBe(enemy);
  });

  it('resolves future faction ids deterministically without returning black', () => {
    const first = factionVisual('third-faction');
    const second = factionVisual('third-faction');
    expect(first).toEqual(second);
    expect(first.id).toBe('third-faction');
    expect(first.bright).toBeGreaterThan(0x101010);
  });

  it('exposes browser-ready six-digit colors', () => {
    expect(factionCssColor('player', 'minimap')).toMatch(/^#[0-9a-f]{6}$/);
    expect(factionCssColor('enemy', 'bright')).not.toBe(factionCssColor('player', 'bright'));
  });
});

describe('health presentation policy', () => {
  it('maps authoritative health to healthy, warning and critical bands', () => {
    expect(healthVisualBand(100, 100)).toBe('healthy');
    expect(healthVisualBand(55, 100)).toBe('warning');
    expect(healthVisualBand(25, 100)).toBe('critical');
    expect(healthVisualBand(Number.NaN, 100)).toBe('critical');
  });

  it('shows selected or damaged entities without forcing full-health clutter', () => {
    expect(shouldShowHealthBar(true, 100, 100)).toBe(true);
    expect(shouldShowHealthBar(false, 80, 100)).toBe(true);
    expect(shouldShowHealthBar(false, 100, 100)).toBe(false);
  });

  it('keeps faction markers readable at the desktop strategic camera', () => {
    expect(HEALTH_BAR_PRESENTATION.unitMarkerSize).toBeGreaterThanOrEqual(0.4);
    expect(HEALTH_BAR_PRESENTATION.buildingMarkerSize).toBeGreaterThan(
      HEALTH_BAR_PRESENTATION.unitMarkerSize,
    );
    expect(HEALTH_BAR_PRESENTATION.markerOffset).toBeGreaterThan(1.2);
  });
});
