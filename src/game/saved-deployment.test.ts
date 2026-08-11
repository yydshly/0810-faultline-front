import { describe, expect, it } from 'vitest';

import { GAME_TICK_SECONDS } from './config';
import { REPLAY_FORMAT, REPLAY_VERSION, serializeReplay, type ReplayLog } from './replay';
import { parseSavedDeploymentSummary } from './saved-deployment';

function savedReplay(fixture: string, currentTick = 0, seed = 1949): string {
  const log: ReplayLog = {
    format: REPLAY_FORMAT,
    version: REPLAY_VERSION,
    fixture,
    seed,
    currentTick,
    commands: [],
  };
  return serializeReplay(log);
}

describe('saved breakthrough deployment summary', () => {
  it('returns null for a missing local save', () => {
    expect(parseSavedDeploymentSummary(null)).toBeNull();
  });

  it.each([
    ['', 'empty'],
    ['{broken', 'invalid JSON'],
    [JSON.stringify({ fixture: 'breakthrough-demo' }), 'incomplete replay'],
    [savedReplay('breakthrough-demo').replace(`\"version\":${REPLAY_VERSION}`, '\"version\":999'), 'incompatible replay'],
  ])('returns null without throwing for a damaged save (%s)', (serialized) => {
    expect(() => parseSavedDeploymentSummary(serialized)).not.toThrow();
    expect(parseSavedDeploymentSummary(serialized)).toBeNull();
  });

  it.each([
    ['breakthrough-demo', 'standard', '标准难度', '标准'],
    ['breakthrough-demo-cadet', 'cadet', '新兵难度', '新兵'],
    ['breakthrough-demo-veteran-reduced', 'veteran', '老兵难度', '老兵'],
  ] as const)('summarizes the playable %s deployment', (fixture, difficultyId, difficultyLabel, difficultyShortLabel) => {
    const summary = parseSavedDeploymentSummary(savedReplay(fixture, 321, 731));

    expect(summary).toEqual({
      fixture,
      seed: 731,
      currentTick: 321,
      elapsedSeconds: 321 * GAME_TICK_SECONDS,
      difficultyId,
      difficultyLabel,
      difficultyShortLabel,
    });
  });

  it.each([
    'default',
    'combat',
    'breakthrough-demo-victory-review',
    'breakthrough-demo-cadet-extra',
  ])('rejects a valid replay from non-playable fixture %s', (fixture) => {
    expect(parseSavedDeploymentSummary(savedReplay(fixture, 200))).toBeNull();
  });

  it('derives elapsed time from the validated tick count and fixed game tick', () => {
    const currentTick = 24_681;
    const summary = parseSavedDeploymentSummary(savedReplay('breakthrough-demo-cadet-reduced', currentTick));

    expect(summary?.elapsedSeconds).toBe(currentTick * GAME_TICK_SECONDS);
    expect(summary?.elapsedSeconds).toBe(1_234.0500000000002);
  });
});
