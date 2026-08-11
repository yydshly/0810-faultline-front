import { describe, expect, it } from 'vitest';

import {
  AUTHORED_VEHICLE_WRECK_POLICY,
  authoredVehicleWreckCap,
  authoredVehicleWreckLifetime,
  authoredWreckSurvivorIds,
  isAuthoredWreckRoot,
  shouldDiscloseDestroyedEvent,
  shouldUseAuthoredVehicleWreck,
} from './scene';

describe('authored vehicle wreck presentation', () => {
  it('recognizes the stable node name and semantic role without accepting generic nodes', () => {
    expect(isAuthoredWreckRoot('wreck_visual_root', undefined)).toBe(true);
    expect(isAuthoredWreckRoot('renamed_root', 'wreck_visual')).toBe(true);
    expect(isAuthoredWreckRoot('wreck_anchor', 'vehicle_wreck_anchor')).toBe(false);
    expect(isAuthoredWreckRoot('vehicle_root', undefined)).toBe(false);
  });

  it('uses authored wrecks only for the contracted tank and harvester families', () => {
    expect(shouldUseAuthoredVehicleWreck('tank', true)).toBe(true);
    expect(shouldUseAuthoredVehicleWreck('harvester', true)).toBe(true);
    expect(shouldUseAuthoredVehicleWreck('artillery', true)).toBe(false);
    expect(shouldUseAuthoredVehicleWreck('tank', false)).toBe(false);
    expect(shouldUseAuthoredVehicleWreck(null, true)).toBe(false);
    expect(AUTHORED_VEHICLE_WRECK_POLICY.unitKinds).toEqual(['tank', 'harvester']);
  });

  it('keeps own losses visible after their sight source is removed without leaking enemy losses', () => {
    expect(shouldDiscloseDestroyedEvent('player', false)).toBe(true);
    expect(shouldDiscloseDestroyedEvent('player', true)).toBe(true);
    expect(shouldDiscloseDestroyedEvent('enemy', false)).toBe(false);
    expect(shouldDiscloseDestroyedEvent('enemy', true)).toBe(true);
    expect(shouldDiscloseDestroyedEvent('neutral', false)).toBe(false);
    expect(shouldDiscloseDestroyedEvent(undefined, false)).toBe(false);
  });

  it('keeps full desktop persistence while low and reduced-motion use the short equivalent', () => {
    expect(authoredVehicleWreckLifetime('high', false)).toBe(34);
    expect(authoredVehicleWreckLifetime('medium', false)).toBe(34);
    expect(authoredVehicleWreckLifetime('low', false)).toBe(14);
    expect(authoredVehicleWreckLifetime('high', true)).toBe(14);
  });

  it('shares the existing residue budget at every quality tier', () => {
    expect(authoredVehicleWreckCap('high', false)).toBe(12);
    expect(authoredVehicleWreckCap('medium', false)).toBe(8);
    expect(authoredVehicleWreckCap('low', false)).toBe(4);
    expect(authoredVehicleWreckCap('high', true)).toBe(4);
  });

  it('removes the oldest wrecks deterministically and handles zero or invalid caps', () => {
    const entries = [
      { id: 'wreck-c', activationOrder: 4 },
      { id: 'wreck-a', activationOrder: 1 },
      { id: 'wreck-b', activationOrder: 4 },
      { id: 'wreck-d', activationOrder: 2 },
    ];
    expect(authoredWreckSurvivorIds(entries, 2)).toEqual(['wreck-b', 'wreck-c']);
    expect(authoredWreckSurvivorIds(entries, 99)).toEqual(['wreck-a', 'wreck-d', 'wreck-b', 'wreck-c']);
    expect(authoredWreckSurvivorIds(entries, 0)).toEqual([]);
    expect(authoredWreckSurvivorIds(entries, Number.NaN)).toEqual([]);
  });
});
