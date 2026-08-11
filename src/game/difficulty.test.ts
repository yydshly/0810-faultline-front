import { describe, expect, it } from 'vitest';
import {
  BREAKTHROUGH_DIFFICULTIES,
  breakthroughFixtureForDifficulty,
  getBreakthroughDifficulty,
  isPlayableBreakthroughFixture,
  resolveBreakthroughDifficultyId,
} from './difficulty';

describe('breakthrough difficulty contract', () => {
  it.each([
    ['breakthrough-demo-cadet', 'cadet'],
    ['breakthrough-demo-cadet-reduced', 'cadet'],
    ['breakthrough-demo', 'standard'],
    ['breakthrough-demo-reduced', 'standard'],
    ['breakthrough-demo-victory-review', 'standard'],
    ['breakthrough-demo-defeat-review', 'standard'],
    ['breakthrough-demo-veteran', 'veteran'],
    ['breakthrough-demo-veteran-reduced', 'veteran'],
    ['default', 'standard'],
    ['breakthrough-demo-cadet-extra', 'standard'],
  ] as const)('resolves %s as %s', (fixture, expected) => {
    expect(resolveBreakthroughDifficultyId(fixture)).toBe(expected);
    expect(getBreakthroughDifficulty(fixture)).toBe(BREAKTHROUGH_DIFFICULTIES[expected]);
  });

  it('keeps the three authored curves ordered without mutating their wave data', () => {
    const { cadet, standard, veteran } = BREAKTHROUGH_DIFFICULTIES;
    expect(cadet.initialPlayerForceHpMultiplier).toBeGreaterThan(standard.initialPlayerForceHpMultiplier);
    expect(standard.initialPlayerForceHpMultiplier).toBeGreaterThan(veteran.initialPlayerForceHpMultiplier);
    expect(cadet.initialEnemyForceHpMultiplier).toBeLessThan(standard.initialEnemyForceHpMultiplier);
    expect(standard.initialEnemyForceHpMultiplier).toBeLessThan(veteran.initialEnemyForceHpMultiplier);
    expect(cadet.commandPressureSeconds).toBeGreaterThan(standard.commandPressureSeconds);
    expect(standard.commandPressureSeconds).toBeGreaterThan(veteran.commandPressureSeconds);
    expect(cadet.finalAssaultWave.length).toBeLessThan(standard.finalAssaultWave.length);
    expect(standard.finalAssaultWave.length).toBeLessThan(veteran.finalAssaultWave.length);
  });

  it.each([
    ['cadet', false, 'breakthrough-demo-cadet'],
    ['cadet', true, 'breakthrough-demo-cadet-reduced'],
    ['standard', false, 'breakthrough-demo'],
    ['standard', true, 'breakthrough-demo-reduced'],
    ['veteran', false, 'breakthrough-demo-veteran'],
    ['veteran', true, 'breakthrough-demo-veteran-reduced'],
  ] as const)('builds the canonical %s fixture', (id, reduced, expected) => {
    const fixture = breakthroughFixtureForDifficulty(id, reduced);
    expect(fixture).toBe(expected);
    expect(resolveBreakthroughDifficultyId(fixture)).toBe(id);
  });

  it('provides player-facing copy from the same immutable data table', () => {
    for (const difficulty of Object.values(BREAKTHROUGH_DIFFICULTIES)) {
      expect(difficulty.label.length).toBeGreaterThan(0);
      expect(difficulty.shortLabel.length).toBeGreaterThan(0);
      expect(difficulty.summary.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['breakthrough-demo', true],
    ['breakthrough-demo-reduced', true],
    ['breakthrough-demo-cadet', true],
    ['breakthrough-demo-veteran-reduced', true],
    ['breakthrough-demo-victory-review', false],
    ['breakthrough-demo-cadet-extra', false],
    ['default', false],
  ] as const)('classifies playable fixture %s', (fixture, expected) => {
    expect(isPlayableBreakthroughFixture(fixture)).toBe(expected);
  });
});
