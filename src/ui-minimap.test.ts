import { describe, expect, it } from 'vitest';

import {
  isPrimaryMinimapPointer,
  minimapClientPointToNormalized,
  normalizedMinimapPointToWorld,
  shouldRenderMinimapBlocker,
  shouldRenderMinimapEntity,
} from './ui';

const rect = { left: 100, top: 50, width: 300, height: 188 };

describe('desktop minimap camera navigation', () => {
  it('maps the drawable minimap centre into normalized world centre', () => {
    expect(minimapClientPointToNormalized(250, 144, rect)).toEqual({ x: 0.5, z: 0.5 });
    expect(normalizedMinimapPointToWorld(
      { x: 0.5, z: 0.5 },
      { minX: -80, maxX: 80, minZ: -80, maxZ: 80 },
    )).toEqual({ x: 0, z: 0 });
  });

  it('clamps pointer and world mapping at every minimap edge', () => {
    expect(minimapClientPointToNormalized(-500, -500, rect)).toEqual({ x: 0, z: 0 });
    expect(minimapClientPointToNormalized(900, 700, rect)).toEqual({ x: 1, z: 1 });
    expect(normalizedMinimapPointToWorld(
      { x: -2, z: 3 },
      { minX: -72, maxX: 68, minZ: -64, maxZ: 76 },
    )).toEqual({ x: -72, z: 76 });
  });

  it('rejects invalid geometry and never treats a non-primary button as navigation', () => {
    expect(minimapClientPointToNormalized(10, 10, { left: 0, top: 0, width: 14, height: 14 })).toBeNull();
    expect(isPrimaryMinimapPointer(0, true)).toBe(true);
    expect(isPrimaryMinimapPointer(1, true)).toBe(false);
    expect(isPrimaryMinimapPointer(2, true)).toBe(false);
    expect(isPrimaryMinimapPointer(0, false)).toBe(false);
  });

  it('filters focused-review logic entities and dividers from the live minimap', () => {
    const noVisibleEnemies = new Set<string>();
    expect(shouldRenderMinimapEntity(
      'enemy-vehicle-socket-review',
      'b-enemy-socket-suppressor-target',
      'player',
      noVisibleEnemies,
    )).toBe(false);
    expect(shouldRenderMinimapEntity(
      'combat-vehicle-family-review',
      'b-combat-vehicle-family-player-hq-anchor',
      'player',
      noVisibleEnemies,
    )).toBe(false);
    expect(shouldRenderMinimapEntity(
      'combat-vehicle-family-review',
      'u-combat-vehicle-family-player-scout',
      'player',
      noVisibleEnemies,
    )).toBe(true);
    expect(shouldRenderMinimapEntity('default', 'u-hidden-enemy', 'enemy', noVisibleEnemies)).toBe(false);
    expect(shouldRenderMinimapEntity(
      'default',
      'u-visible-enemy',
      'enemy',
      new Set(['u-visible-enemy']),
    )).toBe(true);

    const divider = 'blocker-combat-vehicle-family-vision-divider';
    expect(shouldRenderMinimapBlocker('combat-vehicle-family-review', divider, 'visible')).toBe(false);
    expect(shouldRenderMinimapBlocker('default', divider, 'visible')).toBe(true);
    expect(shouldRenderMinimapBlocker('default', 'blocker-default', 'unknown')).toBe(false);
  });
});
