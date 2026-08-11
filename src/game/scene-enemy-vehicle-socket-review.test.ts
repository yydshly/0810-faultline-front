import { describe, expect, it } from 'vitest';

import {
  ENEMY_VEHICLE_SOCKET_REVIEW_SUPPRESSOR_BODY_YAW_OFFSET,
  enemyVehicleSocketReviewBodyYaw,
  selectMuzzleSocketName,
  shouldHideEnemyVehicleSocketReviewEntity,
} from './scene';

describe('enemy vehicle semantic socket review policy', () => {
  it('keeps the suppressor aim while presenting an inspectable non-zero local turret yaw', () => {
    const logicalAim = (Math.PI * 3) / 4;
    const bodyYaw = enemyVehicleSocketReviewBodyYaw(
      'enemy-vehicle-socket-review',
      'u-enemy-socket-suppressor',
      logicalAim,
    );
    expect(logicalAim - bodyYaw).toBeCloseTo(ENEMY_VEHICLE_SOCKET_REVIEW_SUPPRESSOR_BODY_YAW_OFFSET);
    expect(Math.abs(logicalAim - bodyYaw)).toBeGreaterThan(0.5);
    expect(enemyVehicleSocketReviewBodyYaw('default', 'u-enemy-socket-suppressor', logicalAim))
      .toBe(logicalAim);
  });

  it('hides only the logical building targets and command anchor', () => {
    expect(shouldHideEnemyVehicleSocketReviewEntity(
      'enemy-vehicle-socket-review',
      'b-enemy-socket-artillery-target',
    )).toBe(true);
    expect(shouldHideEnemyVehicleSocketReviewEntity(
      'enemy-vehicle-socket-review',
      'u-enemy-socket-artillery',
    )).toBe(false);
    expect(shouldHideEnemyVehicleSocketReviewEntity('default', 'b-enemy-socket-artillery-target'))
      .toBe(false);
  });

  it('resolves both suppressor barrels and the artillery barrel through semantic sockets', () => {
    const suppressorSelections = new Set(Array.from({ length: 24 }, (_, index) =>
      selectMuzzleSocketName(
        ['muzzle_socket_left', 'muzzle_socket_right'],
        `u-enemy-socket-suppressor:${index}:target`,
      )));
    expect(suppressorSelections).toEqual(new Set(['muzzle_socket_left', 'muzzle_socket_right']));
    expect(selectMuzzleSocketName(['muzzle_socket'], 'u-enemy-socket-artillery:1:target'))
      .toBe('muzzle_socket');
    expect(selectMuzzleSocketName([], 'u-enemy-socket-artillery:1:target')).toBeNull();
  });
});
