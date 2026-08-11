import { GAME_TICK_SECONDS } from './config';
import {
  BREAKTHROUGH_DIFFICULTIES,
  isPlayableBreakthroughFixture,
  resolveBreakthroughDifficultyId,
  type BreakthroughDifficultyId,
} from './difficulty';
import { parseReplay } from './replay';

export interface SavedDeploymentSummary {
  readonly fixture: string;
  readonly seed: number;
  readonly currentTick: number;
  readonly elapsedSeconds: number;
  readonly difficultyId: BreakthroughDifficultyId;
  readonly difficultyLabel: string;
  readonly difficultyShortLabel: string;
}

/**
 * Reads an untrusted local save value without allowing malformed or unrelated
 * replay data to escape into the deployment UI.
 */
export function parseSavedDeploymentSummary(serialized: string | null): SavedDeploymentSummary | null {
  if (serialized === null) return null;

  try {
    const replay = parseReplay(serialized);
    if (!isPlayableBreakthroughFixture(replay.fixture)) return null;

    const difficultyId = resolveBreakthroughDifficultyId(replay.fixture);
    const difficulty = BREAKTHROUGH_DIFFICULTIES[difficultyId];
    return {
      fixture: replay.fixture,
      seed: replay.seed,
      currentTick: replay.currentTick,
      elapsedSeconds: replay.currentTick * GAME_TICK_SECONDS,
      difficultyId,
      difficultyLabel: difficulty.label,
      difficultyShortLabel: difficulty.shortLabel,
    };
  } catch {
    return null;
  }
}
