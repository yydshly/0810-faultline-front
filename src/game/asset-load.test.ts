import { describe, expect, it } from 'vitest';

import { createInitialGameState } from './level';
import {
  IncrementalAssetLoadLedger,
  authoredAssetAllowlist,
  authoredAssetPhasePlan,
  collectEntityAuthoredAssetLabels,
  runBoundedAssetTasks,
} from './scene';

describe('bounded authored asset loading', () => {
  it('keeps focused review fixtures from downloading the entire asset catalog', () => {
    expect([...authoredAssetAllowlist('hero-tank-review') ?? []]).toEqual(['FF-MBT-01', 'FF-EN-MBT-01']);
    expect(authoredAssetAllowlist('infantry-family-review')?.size).toBe(8);
    expect(authoredAssetAllowlist('enemy-base-review')?.size).toBe(9);
    expect(authoredAssetAllowlist('breakthrough-demo')).toBeNull();
    expect(authoredAssetPhasePlan(
      'hero-tank-review',
      createInitialGameState(1949, 'hero-tank-review'),
    )[0]?.labels).toEqual(['FF-MBT-01', 'FF-EN-MBT-01']);
  });

  it('loads only the four embedded-wreck vehicle masters for wreck review', () => {
    const expected = new Set(['FF-MBT-01', 'FF-HRV-01', 'FF-EN-MBT-01', 'FF-EN-HRV-01']);
    expect(authoredAssetAllowlist('wreck-review')).toEqual(expected);
    expect(authoredAssetAllowlist('wreck-review-reduced')).toEqual(expected);
    const plan = authoredAssetPhasePlan(
      'wreck-review',
      createInitialGameState(1949, 'wreck-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toEqual(['FF-MBT-01', 'FF-HRV-01', 'FF-EN-MBT-01', 'FF-EN-HRV-01']);
  });

  it('loads only the six player target masters for destruction residue review', () => {
    const expected = new Set([
      'FF-SCT-01', 'FF-SUP-01', 'FF-ART-01',
      'FF-RIF-01', 'FF-ENG-01', 'FF-AT-01',
    ]);
    expect(authoredAssetAllowlist('destruction-residue-review')).toEqual(expected);
    expect(authoredAssetAllowlist('destruction-residue-review-reduced')).toEqual(expected);
    const plan = authoredAssetPhasePlan(
      'destruction-residue-review',
      createInitialGameState(1949, 'destruction-residue-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toEqual([
      'FF-RIF-01', 'FF-ENG-01', 'FF-AT-01', 'FF-SCT-01', 'FF-SUP-01', 'FF-ART-01',
    ]);
  });

  it('loads only the four physical-damage building masters', () => {
    const expected = new Set(['FF-HQ-01', 'FF-FAC-01', 'FF-EN-HQ-01', 'FF-EN-FAC-01']);
    expect(authoredAssetAllowlist('building-damage-review')).toEqual(expected);
    expect(authoredAssetAllowlist('building-damage-review-reduced')).toEqual(expected);
    const plan = authoredAssetPhasePlan(
      'building-damage-review',
      createInitialGameState(1949, 'building-damage-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toEqual([
      'FF-EN-HQ-01', 'FF-EN-FAC-01', 'FF-HQ-01', 'FF-FAC-01',
    ]);
  });

  it('loads only the four authored building masters for ruin review', () => {
    const expected = new Set(['FF-HQ-01', 'FF-FAC-01', 'FF-EN-HQ-01', 'FF-EN-FAC-01']);
    expect(authoredAssetAllowlist('building-ruin-review')).toEqual(expected);
    expect(authoredAssetAllowlist('building-ruin-review-reduced')).toEqual(expected);
    const plan = authoredAssetPhasePlan(
      'building-ruin-review',
      createInitialGameState(1949, 'building-ruin-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toEqual([
      'FF-EN-HQ-01', 'FF-EN-FAC-01', 'FF-HQ-01', 'FF-FAC-01',
    ]);
  });

  it('loads only enemy barracks and reactor masters for infrastructure review', () => {
    const expected = new Set(['FF-EN-BAR-01', 'FF-EN-RCT-01']);
    expect(authoredAssetAllowlist('enemy-infrastructure-review')).toEqual(expected);
    const plan = authoredAssetPhasePlan(
      'enemy-infrastructure-review',
      createInitialGameState(1949, 'enemy-infrastructure-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toEqual(['FF-EN-RCT-01', 'FF-EN-BAR-01']);
  });

  it('loads only player barracks and reactor masters for player infrastructure review', () => {
    const expected = new Set(['FF-BAR-01', 'FF-RCT-01']);
    expect(authoredAssetAllowlist('player-infrastructure-review')).toEqual(expected);
    const plan = authoredAssetPhasePlan(
      'player-infrastructure-review',
      createInitialGameState(1949, 'player-infrastructure-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toEqual(['FF-RCT-01', 'FF-BAR-01']);
  });

  it('loads only enemy suppressor and artillery masters for semantic socket review', () => {
    const expected = new Set(['FF-EN-SUP-01', 'FF-EN-ART-01']);
    expect(authoredAssetAllowlist('enemy-vehicle-socket-review')).toEqual(expected);
    const plan = authoredAssetPhasePlan(
      'enemy-vehicle-socket-review',
      createInitialGameState(1949, 'enemy-vehicle-socket-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toEqual(['FF-EN-SUP-01', 'FF-EN-ART-01']);
  });

  it('loads only the six faction combat-vehicle masters for family review', () => {
    const expected = new Set([
      'FF-SCT-01', 'FF-SUP-01', 'FF-ART-01',
      'FF-EN-SCT-01', 'FF-EN-SUP-01', 'FF-EN-ART-01',
    ]);
    expect(authoredAssetAllowlist('combat-vehicle-family-review')).toEqual(expected);
    const plan = authoredAssetPhasePlan(
      'combat-vehicle-family-review',
      createInitialGameState(1949, 'combat-vehicle-family-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toEqual([
      'FF-SCT-01', 'FF-SUP-01', 'FF-ART-01',
      'FF-EN-SCT-01', 'FF-EN-SUP-01', 'FF-EN-ART-01',
    ]);
  });

  it('pins the desktop visual-gold fixture to its twelve authored comparison assets', () => {
    const allowlist = authoredAssetAllowlist('visual-gold-review');
    expect(allowlist?.size).toBe(12);
    expect(allowlist).toEqual(new Set([
      'FF-MBT-01', 'FF-HRV-01', 'FF-RIF-01', 'FF-ENG-01', 'FF-AT-01',
      'FF-EN-MBT-01', 'FF-EN-RIF-01', 'FF-EN-SEN-01', 'FF-HQ-01', 'FF-FAC-01',
      'FF-ROK-01', 'FF-ORE-01',
    ]));
    const plan = authoredAssetPhasePlan(
      'visual-gold-review',
      createInitialGameState(1949, 'visual-gold-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toHaveLength(12);
  });

  it('loads only the sixteen building masters and non-combat observer engineer for construction review', () => {
    const allowlist = authoredAssetAllowlist('construction-review');
    expect(allowlist?.size).toBe(17);
    expect(allowlist).toEqual(new Set([
      'FF-HQ-01', 'FF-REF-01', 'FF-FAC-01', 'FF-RCT-01',
      'FF-BAR-01', 'FF-REL-01', 'FF-SEN-01', 'FF-CAN-01',
      'FF-EN-HQ-01', 'FF-EN-REF-01', 'FF-EN-FAC-01', 'FF-EN-RCT-01',
      'FF-EN-BAR-01', 'FF-EN-REL-01', 'FF-EN-SEN-01', 'FF-EN-CAN-01',
      'FF-ENG-01',
    ]));
    const plan = authoredAssetPhasePlan(
      'construction-review',
      createInitialGameState(1949, 'construction-review'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: 'review', concurrency: 2, deferred: false });
    expect(plan[0]?.labels).toHaveLength(17);
  });

  it('requests only the 28 authored dependencies present in the default level', () => {
    const plan = authoredAssetPhasePlan('default', createInitialGameState());
    expect(plan).toHaveLength(1);
    expect(plan[0]?.name).toBe('level');
    expect(plan[0]?.labels).toHaveLength(28);
    expect(plan[0]?.labels).toContain('FF-HRV-01');
    expect(plan[0]?.labels).toContain('FF-EN-AT-01');
    expect(plan[0]?.labels).toContain('FF-ORE-01');
    expect(plan[0]?.labels).toContain('FF-WRK-01');
    expect(plan[0]?.labels).not.toContain('FF-ART-01');
    expect(plan[0]?.labels).not.toContain('FF-FAC-01');
  });

  it('includes queued production kinds before their units spawn', () => {
    const state = createInitialGameState(1949, 'dynamic-review');
    const labels = collectEntityAuthoredAssetLabels(state);
    expect(labels).toContain('FF-FAC-01');
    expect(labels).toContain('FF-AT-01');
    expect(labels).toContain('FF-SUP-01');
  });

  it('loads breakthrough entities and level assets before deferred low-concurrency dressing', () => {
    const plan = authoredAssetPhasePlan(
      'breakthrough-demo',
      createInitialGameState(1949, 'breakthrough-demo'),
    );
    expect(plan.map((phase) => phase.name)).toEqual(['critical', 'level', 'dressing']);
    expect(plan.map((phase) => phase.concurrency)).toEqual([4, 3, 2]);
    expect(plan.map((phase) => phase.deferred)).toEqual([false, false, true]);
    expect(plan[0]?.labels).toContain('FF-EN-CAN-01');
    expect(plan[0]?.labels).toEqual(expect.arrayContaining([
      'FF-SEN-01',
      'FF-ART-01',
      'FF-SUP-01',
      'FF-EN-SUP-01',
    ]));
    expect(plan[1]?.labels).toEqual(['FF-ROK-01', 'FF-ORE-01']);
    expect(plan[2]?.labels).toContain('FF-STM-01');
    expect(new Set(plan.flatMap((phase) => phase.labels))).toHaveLength(40);
  });

  it('never exceeds the configured concurrency while completing every task', async () => {
    let active = 0;
    let peak = 0;
    const completed: number[] = [];
    const tasks = Array.from({ length: 11 }, (_, index) => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      completed.push(index);
      active -= 1;
    });

    await runBoundedAssetTasks(tasks, 3);

    expect(peak).toBe(3);
    expect(completed).toHaveLength(11);
    expect(new Set(completed).size).toBe(11);
  });

  it('uses one worker for invalid or zero concurrency values', async () => {
    const order: number[] = [];
    await runBoundedAssetTasks([
      async () => { order.push(1); },
      async () => { order.push(2); },
    ], 0);
    expect(order).toEqual([1, 2]);
  });

  it('deduplicates queued, inflight, and loaded requests', () => {
    const ledger = new IncrementalAssetLoadLedger();
    expect(ledger.queue(['FF-MBT-01', 'FF-MBT-01'])).toEqual(['FF-MBT-01']);
    expect(ledger.queue(['FF-MBT-01'])).toEqual([]);
    expect(ledger.start('FF-MBT-01')).toBe(true);
    expect(ledger.queue(['FF-MBT-01'])).toEqual([]);
    expect(ledger.succeed('FF-MBT-01')).toBe(true);
    expect(ledger.queue(['FF-MBT-01'])).toEqual([]);
    expect(ledger.snapshot()).toMatchObject({ queued: 0, inflight: 0, loaded: 1, failed: 0 });
  });

  it('allows one failed network retry but records a terminal second failure', () => {
    const ledger = new IncrementalAssetLoadLedger();
    ledger.queue(['FF-ORE-01']);
    expect(ledger.start('FF-ORE-01')).toBe(true);
    expect(ledger.retry('FF-ORE-01', 2)).toBe(true);
    expect(ledger.start('FF-ORE-01')).toBe(true);
    expect(ledger.retry('FF-ORE-01', 2)).toBe(false);
    expect(ledger.fail('FF-ORE-01')).toBe(true);
    expect(ledger.queue(['FF-ORE-01'])).toEqual([]);
    expect(ledger.snapshot()).toMatchObject({ queued: 0, inflight: 0, loaded: 0, failed: 1 });
  });

  it('ignores late completions and new requests after disposal', () => {
    const ledger = new IncrementalAssetLoadLedger();
    ledger.queue(['FF-ROK-01']);
    ledger.start('FF-ROK-01');
    ledger.dispose();
    expect(ledger.succeed('FF-ROK-01')).toBe(false);
    expect(ledger.fail('FF-ROK-01')).toBe(false);
    expect(ledger.queue(['FF-ORE-01'])).toEqual([]);
    expect(ledger.snapshot()).toEqual({ queued: 0, inflight: 0, loaded: 0, failed: 0, disposed: true });
  });
});
