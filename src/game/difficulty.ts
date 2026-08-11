import type { UnitKind } from './types';

export type BreakthroughDifficultyId = 'cadet' | 'standard' | 'veteran';

export interface BreakthroughDifficulty {
  readonly id: BreakthroughDifficultyId;
  readonly label: string;
  readonly shortLabel: string;
  readonly summary: string;
  readonly initialPlayerForceHpMultiplier: number;
  readonly initialEnemyForceHpMultiplier: number;
  readonly missionPlayerWaveHpMultiplier: number;
  readonly missionEnemyWaveHpMultiplier: number;
  readonly enemyHqHpRatio: number;
  readonly frontlineDefenseHpRatio: number;
  readonly frontlineMinSeconds: number;
  readonly frontlineMaxSeconds: number;
  readonly frontlineDefenseTriggerRatio: number;
  readonly counterattackMinSeconds: number;
  readonly counterattackMaxSeconds: number;
  readonly counterattackWave: readonly UnitKind[];
  readonly reinforcementSeconds: number;
  readonly reinforcementWave: readonly UnitKind[];
  readonly commandPressureSeconds: number;
  readonly finalAssaultWave: readonly UnitKind[];
}

export const BREAKTHROUGH_DIFFICULTIES: Readonly<Record<BreakthroughDifficultyId, BreakthroughDifficulty>> = {
  cadet: {
    id: 'cadet',
    label: '新兵难度',
    shortLabel: '新兵',
    summary: '更耐久的初始部队、更多增援与更迟的最终攻势。',
    initialPlayerForceHpMultiplier: 1.9,
    initialEnemyForceHpMultiplier: 1.35,
    missionPlayerWaveHpMultiplier: 1.15,
    missionEnemyWaveHpMultiplier: 0.9,
    enemyHqHpRatio: 0.68,
    frontlineDefenseHpRatio: 0.74,
    frontlineMinSeconds: 180,
    frontlineMaxSeconds: 280,
    frontlineDefenseTriggerRatio: 0.6,
    counterattackMinSeconds: 150,
    counterattackMaxSeconds: 230,
    counterattackWave: ['suppressor', 'antitank'],
    reinforcementSeconds: 150,
    reinforcementWave: ['tank', 'tank', 'artillery', 'suppressor', 'engineer', 'rifle'],
    commandPressureSeconds: 240,
    finalAssaultWave: ['tank', 'suppressor', 'artillery', 'antitank', 'rifle'],
  },
  standard: {
    id: 'standard',
    label: '标准难度',
    shortLabel: '标准',
    summary: '推荐的攻防节奏与完整黄金对局体验。',
    initialPlayerForceHpMultiplier: 1.65,
    initialEnemyForceHpMultiplier: 1.55,
    missionPlayerWaveHpMultiplier: 1,
    missionEnemyWaveHpMultiplier: 1,
    enemyHqHpRatio: 0.75,
    frontlineDefenseHpRatio: 0.86,
    frontlineMinSeconds: 180,
    frontlineMaxSeconds: 280,
    frontlineDefenseTriggerRatio: 0.56,
    counterattackMinSeconds: 150,
    counterattackMaxSeconds: 230,
    counterattackWave: ['suppressor', 'tank', 'antitank'],
    reinforcementSeconds: 150,
    reinforcementWave: ['tank', 'artillery', 'suppressor', 'engineer', 'rifle'],
    commandPressureSeconds: 180,
    finalAssaultWave: ['tank', 'tank', 'suppressor', 'artillery', 'artillery', 'antitank', 'rifle'],
  },
  veteran: {
    id: 'veteran',
    label: '老兵难度',
    shortLabel: '老兵',
    summary: '敌军更坚韧、反扑更早，最终攻势规模更大。',
    initialPlayerForceHpMultiplier: 1.5,
    initialEnemyForceHpMultiplier: 1.75,
    missionPlayerWaveHpMultiplier: 0.95,
    missionEnemyWaveHpMultiplier: 1.15,
    enemyHqHpRatio: 0.9,
    frontlineDefenseHpRatio: 1,
    frontlineMinSeconds: 160,
    frontlineMaxSeconds: 240,
    frontlineDefenseTriggerRatio: 0.64,
    counterattackMinSeconds: 130,
    counterattackMaxSeconds: 190,
    counterattackWave: ['suppressor', 'tank', 'tank', 'antitank'],
    reinforcementSeconds: 130,
    reinforcementWave: ['tank', 'artillery', 'suppressor', 'engineer'],
    commandPressureSeconds: 120,
    finalAssaultWave: ['tank', 'tank', 'tank', 'suppressor', 'suppressor', 'artillery', 'artillery', 'antitank', 'rifle'],
  },
};

export function resolveBreakthroughDifficultyId(fixture: string): BreakthroughDifficultyId {
  if (/^breakthrough-demo-cadet(?:-reduced)?$/u.test(fixture)) return 'cadet';
  if (/^breakthrough-demo-veteran(?:-reduced)?$/u.test(fixture)) return 'veteran';
  return 'standard';
}

export function getBreakthroughDifficulty(fixture: string): BreakthroughDifficulty {
  return BREAKTHROUGH_DIFFICULTIES[resolveBreakthroughDifficultyId(fixture)];
}

export function isPlayableBreakthroughFixture(fixture: string): boolean {
  return /^breakthrough-demo(?:-(?:cadet|veteran))?(?:-reduced)?$/u.test(fixture);
}

export function canStartBreakthroughDeploymentInPlace(
  currentFixture: string,
  targetFixture: string,
  tick: number,
  status: 'active' | 'victory' | 'defeat',
  mode: 'initial' | 'change',
): boolean {
  return currentFixture === targetFixture
    && isPlayableBreakthroughFixture(currentFixture)
    && tick === 0
    && status === 'active'
    && mode === 'initial';
}

export function breakthroughFixtureForDifficulty(
  id: BreakthroughDifficultyId,
  reduced = false,
): string {
  const suffix = reduced ? '-reduced' : '';
  if (id === 'standard') return `breakthrough-demo${suffix}`;
  return `breakthrough-demo-${id}${suffix}`;
}
