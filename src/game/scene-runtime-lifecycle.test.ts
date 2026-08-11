import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  BattlefieldScene,
  buildGhostAssetModelKey,
  createPresentationSessionMetricState,
  disclosedSocketSource,
  disclosedImpactPresentation,
  disposeUniqueImportedResources,
  effectBudgetSurvivorIndices,
  previousVisualForVisibleDestruction,
  recoverAssetLoaderInitialization,
  selectMuzzleSocketName,
  type EffectBudgetEntry,
} from './scene';

describe('visible combat event privacy and continuity', () => {
  it('retains an old visual for a visible destroyed event after simulation removal', () => {
    const oldBuildingVisual = { entityType: 'building' as const };
    const visuals = new Map([['b-doomed', oldBuildingVisual]]);

    expect(previousVisualForVisibleDestruction('b-doomed', visuals)).toBe(oldBuildingVisual);
    expect(previousVisualForVisibleDestruction('b-unknown', visuals)).toBeUndefined();
  });

  it('uses one neutral anonymous contact regardless of hidden weapon damage and radius', () => {
    const light = disclosedImpactPresentation(false, 'enemy', 0, 12, false);
    const artillery = disclosedImpactPresentation(false, 'enemy', 8, 900, true);

    expect(light).toEqual(artillery);
    expect(artillery.team).toBe('neutral');
    expect(artillery.profile.kind).toBe('ballistic');
    expect(artillery.profile.debris).toBe(false);
    expect(artillery.reactionDamage).toBe(24);
  });

  it('keeps disclosed heavy ordnance and team presentation intact', () => {
    const disclosed = disclosedImpactPresentation(true, 'player', 3.2, 190, true);
    expect(disclosed.team).toBe('player');
    expect(disclosed.profile.kind).toBe('heavy');
    expect(disclosed.reactionDamage).toBe(190);
  });

  it('never resolves a semantic socket for an undisclosed source', () => {
    const hiddenVisual = { socket: 'hidden' };
    const visibleVisual = { socket: 'visible' };
    const visuals = new Map([
      ['u-hidden', hiddenVisual],
      ['u-visible', visibleVisual],
    ]);
    const disclosed = new Set(['u-visible']);

    expect(disclosedSocketSource('u-visible', disclosed, visuals)).toBe(visibleVisual);
    expect(disclosedSocketSource('u-hidden', disclosed, visuals)).toBeUndefined();
    expect(disclosedSocketSource(undefined, disclosed, visuals)).toBeUndefined();
  });

  it('selects authored muzzle sockets stably and ignores traversal order', () => {
    const twins = ['muzzle_socket_left', 'muzzle_socket_right'];
    const selected = selectMuzzleSocketName(twins, 'u-suppressor:180:target-a');
    expect(selected).toMatch(/^muzzle_socket_(?:left|right)$/);
    expect(selectMuzzleSocketName([...twins].reverse(), 'u-suppressor:180:target-a')).toBe(selected);
    expect(selectMuzzleSocketName(['muzzle_socket'], 'u-tank:180:target-a')).toBe('muzzle_socket');
    expect(selectMuzzleSocketName(['selection_anchor'], 'u-tank:180:target-a')).toBeNull();
  });

  it('uses both members of a dual-muzzle contract across stable event keys', () => {
    const selected = new Set(
      Array.from({ length: 16 }, (_, index) => selectMuzzleSocketName(
        ['muzzle_socket_left', 'muzzle_socket_right'],
        `u-suppressor:${index}:target-a`,
      )),
    );
    expect(selected).toEqual(new Set(['muzzle_socket_left', 'muzzle_socket_right']));
  });
});

describe('asset lifecycle recovery', () => {
  it('turns rejected loader initialization into a resolved fallback path', async () => {
    const report = vi.fn();
    await expect(recoverAssetLoaderInitialization(Promise.reject(new Error('decoder unavailable')), report))
      .resolves.toBeUndefined();
    expect(report).toHaveBeenCalledOnce();
  });

  it('changes the build ghost key when authored geometry or revision changes', () => {
    const fallback = buildGhostAssetModelKey('factory', false, 0);
    const authored = buildGhostAssetModelKey('factory', true, 1);
    const reloaded = buildGhostAssetModelKey('factory', true, 2);
    expect(new Set([fallback, authored, reloaded])).toHaveLength(3);
  });

  it('disposes shared geometry, material, and multiply-bound texture exactly once', () => {
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture, roughnessMap: texture });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');

    expect(disposeUniqueImportedResources(root)).toEqual({ geometries: 1, materials: 1, textures: 1 });
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});

describe('presentation session reset contract', () => {
  it('exposes a scene reset and starts every cumulative review metric at zero', () => {
    expect(typeof BattlefieldScene.prototype.resetPresentationSession).toBe('function');
    expect(createPresentationSessionMetricState()).toEqual({
      socketShots: 0,
      muzzleShots: {
        muzzle_socket: 0,
        muzzle_socket_left: 0,
        muzzle_socket_right: 0,
      },
      socketRepairs: 0,
      socketDeposits: 0,
      socketProductionExits: 0,
      socketRefineryMechanisms: 0,
      refineryMechanismFallbacks: 0,
      socketWreckAnchors: 0,
      authoredWreckActivations: 0,
      authoredWreckFallbacks: 0,
      authoredBuildingRuinActivations: 0,
      authoredBuildingRuinFallbacks: 0,
      socketFallbacks: 0,
    });
  });
});

describe('effect budget convergence', () => {
  it('immediately converges old high-quality effects to low and reduced-motion caps', () => {
    const entries: EffectBudgetEntry[] = [
      ...Array.from({ length: 12 }, () => ({ kind: 'heavy-explosion' as const, decorative: false })),
      ...Array.from({ length: 6 }, () => ({ kind: 'debris' as const, decorative: false })),
      ...Array.from({ length: 9 }, () => ({ kind: 'signal' as const, decorative: true })),
    ];
    const survivors = effectBudgetSurvivorIndices(entries, 'low', true);
    const remaining = survivors.map((index) => entries[index]).filter((entry): entry is EffectBudgetEntry => Boolean(entry));

    expect(remaining.filter((entry) => entry.kind === 'heavy-explosion')).toHaveLength(2);
    expect(remaining.filter((entry) => entry.kind === 'debris')).toHaveLength(0);
    expect(remaining.filter((entry) => entry.decorative)).toHaveLength(4);
  });

  it('prefers removing decorative effects when the global cap shrinks', () => {
    const entries: EffectBudgetEntry[] = [
      { kind: 'signal', decorative: true },
      { kind: 'projectile', decorative: false },
      { kind: 'signal', decorative: true },
      { kind: 'muzzle', decorative: false },
      { kind: 'signal', decorative: true },
    ];
    const survivors = effectBudgetSurvivorIndices(entries, 'high', false, 3);
    expect(survivors).toEqual([1, 3, 4]);
  });
});
