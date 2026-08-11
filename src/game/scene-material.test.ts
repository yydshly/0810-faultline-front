import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { importedMaterialDescriptorSignature } from './imported-materials';
import {
  applyImportedFallbackColor,
  authoredBuildingDamageRole,
  authoredBuildingDamageVisibility,
  buildingDamageVisualStage,
  combatVfxCap,
  healthOverlayMaterialParameters,
  hasCompleteRefineryMechanism,
  importedMaterialRuntimeDescriptor,
  impactVisualProfile,
  productionDoorOpenTarget,
  productionDoorPresentationTarget,
  productionPresentationSocketName,
  productionProgress,
  refineryMechanismRole,
  refineryUnloadPresentation,
  screenSpaceEntityPickRadius,
  selectDamageSocketName,
  visibleCargoSlotCount,
} from './scene';

describe('runtime imported material descriptors', () => {
  it('preserves authored base-color texture factors and only colors untextured fallbacks', () => {
    const texture = new THREE.Texture();
    const textured = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture });
    const fallback = new THREE.MeshStandardMaterial({ color: 0xffffff });

    applyImportedFallbackColor(textured, 0x343d3d);
    applyImportedFallbackColor(fallback, 0x343d3d);

    expect(textured.color.getHex()).toBe(0xffffff);
    expect(fallback.color.getHex()).toBe(0x343d3d);

    textured.dispose();
    fallback.dispose();
    texture.dispose();
  });

  it('matches compatible PBR instances that reference the same runtime texture', () => {
    const texture = new THREE.Texture();
    const left = new THREE.MeshStandardMaterial({ color: 0x667069, map: texture, roughness: 0.56 });
    const right = new THREE.MeshStandardMaterial({ color: 0x667069, map: texture, roughness: 0.56 });
    left.name = right.name = 'M_ArmorPanel';

    expect(importedMaterialDescriptorSignature(importedMaterialRuntimeDescriptor(left)))
      .toBe(importedMaterialDescriptorSignature(importedMaterialRuntimeDescriptor(right)));

    left.dispose();
    right.dispose();
    texture.dispose();
  });

  it('keeps identically named texture instances incompatible', () => {
    const leftTexture = new THREE.Texture();
    const rightTexture = new THREE.Texture();
    leftTexture.name = rightTexture.name = 'BaseColor';
    const left = new THREE.MeshStandardMaterial({ map: leftTexture });
    const right = new THREE.MeshStandardMaterial({ map: rightTexture });
    left.name = right.name = 'M_ArmorPanel';

    expect(importedMaterialDescriptorSignature(importedMaterialRuntimeDescriptor(left)))
      .not.toBe(importedMaterialDescriptorSignature(importedMaterialRuntimeDescriptor(right)));

    left.dispose();
    right.dispose();
    leftTexture.dispose();
    rightTexture.dispose();
  });
});

describe('authoritative presentation state mapping', () => {
  it('keeps health tracks, faction frames and fills in one ordered transparent queue', () => {
    const track = healthOverlayMaterialParameters(0x071014, 0.96);
    const fill = healthOverlayMaterialParameters(0x55dc85);

    expect(track.transparent).toBe(true);
    expect(fill.transparent).toBe(true);
    expect(track.depthTest).toBe(false);
    expect(fill.depthTest).toBe(false);
    expect(track.depthWrite).toBe(false);
    expect(fill.depthWrite).toBe(false);
  });

  it('gives buildings a forgiving strategic-zoom pick radius without inflating units', () => {
    expect(screenSpaceEntityPickRadius(1, 50, 900, 'unit')).toBe(18);
    expect(screenSpaceEntityPickRadius(1, 50, 900, 'building')).toBeCloseTo(24.3);
    expect(screenSpaceEntityPickRadius(0, 50, 900, 'building')).toBe(18);
    expect(screenSpaceEntityPickRadius(1, 0, 900, 'building')).toBe(9);
  });

  it('maps harvester cargo into three stable visible stages', () => {
    expect(visibleCargoSlotCount(0, 500)).toBe(0);
    expect(visibleCargoSlotCount(1, 500)).toBe(1);
    expect(visibleCargoSlotCount(250, 500)).toBe(2);
    expect(visibleCargoSlotCount(500, 500)).toBe(3);
    expect(visibleCargoSlotCount(900, 500)).toBe(3);
    expect(visibleCargoSlotCount(Number.NaN, 500)).toBe(0);
  });

  it('opens production doors further as the active item approaches completion', () => {
    expect(productionProgress(18, 18)).toBe(0);
    expect(productionProgress(9, 18)).toBe(0.5);
    expect(productionProgress(0, 18)).toBe(1);
    expect(productionDoorOpenTarget(false, 0, 18)).toBe(0);
    expect(productionDoorOpenTarget(true, 18, 18)).toBeCloseTo(0.28);
    expect(productionDoorOpenTarget(true, 0, 18)).toBe(1);
    expect(productionDoorPresentationTarget(false, 0, 18, true)).toBe(1);
    expect(productionDoorPresentationTarget(false, 0, 18, false)).toBe(0);
  });

  it('selects authored production and damage sockets deterministically', () => {
    expect(productionPresentationSocketName('factory', ['production_socket', 'infantry_spawn']))
      .toBe('production_socket');
    expect(productionPresentationSocketName('barracks', ['production_socket', 'infantry_spawn']))
      .toBe('infantry_spawn');
    expect(productionPresentationSocketName('factory', [])).toBeNull();

    const sockets = ['damage_socket_turret', 'damage_socket_engine'];
    expect(selectDamageSocketName(sockets, 'u-player-tank'))
      .toBe(selectDamageSocketName([...sockets].reverse(), 'u-player-tank'));
    expect(selectDamageSocketName([], 'u-player-tank')).toBeNull();
  });

  it('maps authoritative building health into distinct persistent damage stages', () => {
    expect(buildingDamageVisualStage(1000, 1000)).toBe('none');
    expect(buildingDamageVisualStage(660, 1000)).toBe('damaged');
    expect(buildingDamageVisualStage(301, 1000)).toBe('damaged');
    expect(buildingDamageVisualStage(300, 1000)).toBe('critical');
    expect(buildingDamageVisualStage(100, 1000, 0.9949)).toBe('none');
    expect(buildingDamageVisualStage(100, 1000, 0.995)).toBe('critical');
    expect(buildingDamageVisualStage(Number.NaN, 1000)).toBe('none');
    expect(buildingDamageVisualStage(100, 1000, Number.NaN)).toBe('none');
  });

  it('maps the two self-contained building damage roots into exclusive stage visibility', () => {
    expect(authoredBuildingDamageRole('damage_visual_damaged', undefined)).toBe('damaged');
    expect(authoredBuildingDamageRole('renamed', 'building_damage_critical')).toBe('critical');
    expect(authoredBuildingDamageRole('damage_socket_engine', 'vehicle_damage')).toBeNull();
    expect(authoredBuildingDamageVisibility('none')).toEqual({ damaged: false, critical: false });
    expect(authoredBuildingDamageVisibility('damaged')).toEqual({ damaged: true, critical: false });
    expect(authoredBuildingDamageVisibility('critical')).toEqual({ damaged: false, critical: true });
  });

  it('keeps ballistic contacts distinct from heavy ordnance explosions', () => {
    const bullet = impactVisualProfile(0, 36);
    const shell = impactVisualProfile(3.2, 190);
    const tankRound = impactVisualProfile(0, 112, true);

    expect(bullet.kind).toBe('ballistic');
    expect(bullet.debris).toBe(false);
    expect(bullet.scorchSize).toBe(0);
    expect(shell.kind).toBe('heavy');
    expect(shell.size).toBeGreaterThan(bullet.size);
    expect(shell.debris).toBe(true);
    expect(tankRound.kind).toBe('heavy');
  });

  it('caps each combat effect family by quality and reduced-motion policy', () => {
    expect(combatVfxCap('heavy-explosion', 'high', false)).toBe(4);
    expect(combatVfxCap('heavy-explosion', 'medium', false)).toBe(3);
    expect(combatVfxCap('heavy-explosion', 'low', false)).toBe(2);
    expect(combatVfxCap('heavy-explosion', 'high', true)).toBe(2);
    expect(combatVfxCap('economy-transfer', 'high', false)).toBe(6);
    expect(combatVfxCap('economy-transfer', 'medium', false)).toBe(4);
    expect(combatVfxCap('economy-transfer', 'low', false)).toBe(2);
    expect(combatVfxCap('economy-transfer', 'high', true)).toBe(2);
    expect(combatVfxCap('debris', 'low', false)).toBe(0);
    expect(combatVfxCap('dust', 'high', true)).toBe(0);
  });

  it('classifies the complete authored refinery mechanism contract', () => {
    expect(refineryMechanismRole('intake_gate', undefined)).toBe('gate');
    expect(refineryMechanismRole('renamed_gate', 'deposit_gate')).toBe('gate');
    expect(refineryMechanismRole('intake_conveyor', undefined)).toBe('conveyor');
    expect(refineryMechanismRole('intake_collector', undefined)).toBe('collector');
    expect(refineryMechanismRole('intake_ramp', undefined)).toBeNull();
    expect(hasCompleteRefineryMechanism(['collector', 'gate', 'conveyor'])).toBe(true);
    expect(hasCompleteRefineryMechanism(['gate', 'collector'])).toBe(false);
  });

  it('opens, sustains, and closes refinery unloading with a reduced-motion equivalent', () => {
    expect(refineryUnloadPresentation(10, 10, 11.05, false)).toEqual({ gate: 0, mechanism: 0 });
    const opening = refineryUnloadPresentation(10.08, 10, 11.05, false);
    expect(opening.gate).toBeGreaterThan(0);
    expect(opening.gate).toBeLessThan(1);
    const sustained = refineryUnloadPresentation(10.5, 10, 11.05, false);
    expect(sustained.gate).toBe(1);
    expect(sustained.mechanism).toBe(1);
    const closing = refineryUnloadPresentation(10.9, 10, 11.05, false);
    expect(closing.gate).toBeGreaterThan(0);
    expect(closing.gate).toBeLessThan(1);
    expect(refineryUnloadPresentation(11.05, 10, 11.05, false)).toEqual({ gate: 0, mechanism: 0 });
    expect(refineryUnloadPresentation(20.1, 20, 20.28, true)).toEqual({ gate: 1, mechanism: 0 });
  });
});
