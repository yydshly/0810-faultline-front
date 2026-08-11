import { describe, expect, it } from 'vitest';

import {
  GENERIC_DESTRUCTION_RESIDUE_POLICY,
  RENDERED_DESTRUCTION_RESIDUE_FAMILIES,
  authoredVehicleWreckLifetime,
  countGenericDestructionResidueFamilies,
  destructionResidueFamilyForKind,
  genericDestructionResidueLifetime,
} from './scene';
import type { BuildingKind, UnitKind } from './types';

describe('semantic generic destruction residues', () => {
  it('cleans infantry after its death presentation without persistent vehicle geometry', () => {
    for (const kind of ['rifle', 'engineer', 'antitank'] as const satisfies readonly UnitKind[]) {
      expect(destructionResidueFamilyForKind(kind, null)).toBe('none');
    }
  });

  it('maps every vehicle kind to a stable silhouette family', () => {
    const expected = {
      scout: 'light-vehicle',
      suppressor: 'wide-armor',
      artillery: 'artillery',
      tank: 'tracked-vehicle',
      harvester: 'tracked-vehicle',
    } as const satisfies Partial<Record<UnitKind, string>>;

    for (const [kind, family] of Object.entries(expected)) {
      expect(destructionResidueFamilyForKind(kind as UnitKind, null)).toBe(family);
    }
  });

  it('keeps every building on the rubble fallback and uses neutral debris when kind is unavailable', () => {
    const buildingKinds = [
      'hq',
      'reactor',
      'refinery',
      'barracks',
      'factory',
      'relay',
      'sentry',
      'cannon',
    ] as const satisfies readonly BuildingKind[];
    for (const kind of buildingKinds) {
      expect(destructionResidueFamilyForKind(null, kind)).toBe('building-rubble');
    }
    expect(destructionResidueFamilyForKind(null, null)).toBe('unknown-debris');
  });

  it('keeps every rendered generic family within the four-mesh budget including its stain', () => {
    expect(GENERIC_DESTRUCTION_RESIDUE_POLICY.maxMeshesPerResidue).toBe(4);
    expect(GENERIC_DESTRUCTION_RESIDUE_POLICY.meshCountByFamily.none).toBe(0);
    for (const family of RENDERED_DESTRUCTION_RESIDUE_FAMILIES) {
      expect(GENERIC_DESTRUCTION_RESIDUE_POLICY.meshCountByFamily[family]).toBeGreaterThan(0);
      expect(GENERIC_DESTRUCTION_RESIDUE_POLICY.meshCountByFamily[family]).toBeLessThanOrEqual(4);
    }
  });

  it('shares the authored wreck lifetime envelope at all quality and motion settings', () => {
    for (const quality of ['low', 'medium', 'high'] as const) {
      for (const reducedMotion of [false, true]) {
        expect(genericDestructionResidueLifetime(quality, reducedMotion)).toBe(
          authoredVehicleWreckLifetime(quality, reducedMotion),
        );
      }
    }
    expect(genericDestructionResidueLifetime('high', false)).toBe(34);
    expect(genericDestructionResidueLifetime('high', true)).toBe(14);
  });

  it('reports active family counts without inventing none or unknown values', () => {
    expect(countGenericDestructionResidueFamilies([
      'light-vehicle',
      'light-vehicle',
      'wide-armor',
      'artillery',
      'tracked-vehicle',
      'building-rubble',
      'unknown-debris',
      'none',
      undefined,
      'not-a-family',
    ])).toEqual({
      'light-vehicle': 2,
      'wide-armor': 1,
      artillery: 1,
      'tracked-vehicle': 1,
      'building-rubble': 1,
      'unknown-debris': 1,
    });
  });
});
