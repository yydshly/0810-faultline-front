import { describe, expect, it } from 'vitest';

import {
  canShareImportedMaterial,
  importedMaterialDescriptorSignature,
  importedMaterialLibraryKey,
  importedMaterialOwnerKey,
  importedMaterialScope,
  type ImportedMaterialDescriptor,
} from './imported-materials';

const armorDescriptor = (roughness = 0.56): ImportedMaterialDescriptor => ({
  name: 'M_ArmorPanel',
  shader: 'MeshStandardMaterial',
  baseColor: [0.4, 0.44, 0.41, 1],
  metalness: 0.08,
  roughness,
  textures: {
    baseColor: { contentHash: 'sha256:armor-a', colorSpace: 'srgb', height: 512, width: 512 },
    normal: { contentHash: 'sha256:normal-a', colorSpace: 'linear', height: 512, width: 512 },
  },
});

describe('imported material ownership', () => {
  it('isolates identical material names and descriptors by asset by default', () => {
    const descriptor = armorDescriptor();
    const tank = { assetLabel: 'FF-MBT-01' };
    const harvester = { assetLabel: 'FF-HRV-01' };

    expect(importedMaterialScope(tank)).toEqual({ kind: 'asset', id: 'FF-MBT-01' });
    expect(canShareImportedMaterial(tank, descriptor, harvester, descriptor)).toBe(false);
    expect(importedMaterialLibraryKey(tank, descriptor)).not.toBe(importedMaterialLibraryKey(harvester, descriptor));
  });

  it('allows identical descriptors across assets only through the same explicit share group', () => {
    const descriptor = armorDescriptor();
    const tank = { assetLabel: 'FF-MBT-01', shareGroup: 'player-armor-atlas-v2' };
    const harvester = { assetLabel: 'FF-HRV-01', shareGroup: 'player-armor-atlas-v2' };

    expect(importedMaterialScope(tank)).toEqual({ kind: 'share-group', id: 'player-armor-atlas-v2' });
    expect(canShareImportedMaterial(tank, descriptor, harvester, descriptor)).toBe(true);
    expect(importedMaterialLibraryKey(tank, descriptor)).toBe(importedMaterialLibraryKey(harvester, descriptor));
  });

  it('rejects different descriptors even inside one owner or share group', () => {
    const owner = { assetLabel: 'FF-MBT-01' };
    const sharedTank = { assetLabel: 'FF-MBT-01', shareGroup: 'player-armor-atlas-v2' };
    const sharedHarvester = { assetLabel: 'FF-HRV-01', shareGroup: 'player-armor-atlas-v2' };

    expect(canShareImportedMaterial(owner, armorDescriptor(), owner, armorDescriptor(0.57))).toBe(false);
    expect(canShareImportedMaterial(sharedTank, armorDescriptor(), sharedHarvester, armorDescriptor(0.57))).toBe(false);
  });

  it('does not mix explicit and implicit ownership scopes', () => {
    const descriptor = armorDescriptor();
    expect(canShareImportedMaterial(
      { assetLabel: 'FF-MBT-01' },
      descriptor,
      { assetLabel: 'FF-MBT-01', shareGroup: 'player-armor-atlas-v2' },
      descriptor,
    )).toBe(false);
  });

  it('treats an empty share group as absent and encodes owner keys without delimiter collisions', () => {
    expect(importedMaterialScope({ assetLabel: ' FF-MBT-01 ', shareGroup: '   ' }))
      .toEqual({ kind: 'asset', id: 'FF-MBT-01' });
    expect(importedMaterialOwnerKey({ assetLabel: 'a:b' }))
      .not.toBe(importedMaterialOwnerKey({ assetLabel: 'b', shareGroup: 'a' }));
  });

  it('rejects empty ownership identifiers', () => {
    expect(() => importedMaterialOwnerKey({ assetLabel: '  ' })).toThrow(TypeError);
  });
});

describe('imported material descriptor signatures', () => {
  it('is stable across object insertion order, including nested texture descriptors', () => {
    const left = armorDescriptor();
    const right: ImportedMaterialDescriptor = {
      textures: {
        normal: { width: 512, height: 512, colorSpace: 'linear', contentHash: 'sha256:normal-a' },
        baseColor: { width: 512, height: 512, colorSpace: 'srgb', contentHash: 'sha256:armor-a' },
      },
      roughness: 0.56,
      metalness: 0.08,
      baseColor: [0.4, 0.44, 0.41, 1],
      shader: 'MeshStandardMaterial',
      name: 'M_ArmorPanel',
    };

    expect(importedMaterialDescriptorSignature(left)).toBe(importedMaterialDescriptorSignature(right));
  });

  it('keeps array order significant and normalizes negative zero', () => {
    const base: ImportedMaterialDescriptor = {
      name: 'M_Test',
      shader: 'MeshStandardMaterial',
      color: [0, 0.5, 1],
    };
    const negativeZero: ImportedMaterialDescriptor = {
      name: 'M_Test',
      shader: 'MeshStandardMaterial',
      color: [-0, 0.5, 1],
    };
    const reordered: ImportedMaterialDescriptor = {
      name: 'M_Test',
      shader: 'MeshStandardMaterial',
      color: [1, 0.5, 0],
    };

    expect(importedMaterialDescriptorSignature(base)).toBe(importedMaterialDescriptorSignature(negativeZero));
    expect(importedMaterialDescriptorSignature(base)).not.toBe(importedMaterialDescriptorSignature(reordered));
  });

  it('rejects non-finite numbers instead of silently collapsing their signatures', () => {
    const invalid: ImportedMaterialDescriptor = {
      name: 'M_Invalid',
      shader: 'MeshStandardMaterial',
      roughness: Number.NaN,
    };
    expect(() => importedMaterialDescriptorSignature(invalid)).toThrow(TypeError);
  });
});
