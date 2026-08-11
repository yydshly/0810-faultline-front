export const RENDER_QUALITY_LEVELS = ['low', 'medium', 'high'] as const;

export type RenderQualityLevel = (typeof RENDER_QUALITY_LEVELS)[number];

export interface RenderQualityProfile {
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: 512 | 1024 | 2048;
  anisotropy: number;
  detailViewHeight: number;
  vegetationViewHeight: number;
  movementDust: boolean;
  maxDecorativeEffects: number;
}

export interface RenderQualitySignals {
  viewportWidth: number;
  devicePixelRatio: number;
  deviceMemory?: number;
}

export const RENDER_QUALITY_PROFILES: Readonly<Record<RenderQualityLevel, RenderQualityProfile>> = {
  low: {
    pixelRatioCap: 1,
    shadows: false,
    shadowMapSize: 512,
    anisotropy: 2,
    detailViewHeight: 44,
    vegetationViewHeight: 52,
    movementDust: false,
    maxDecorativeEffects: 4,
  },
  medium: {
    pixelRatioCap: 1.35,
    shadows: true,
    shadowMapSize: 1024,
    anisotropy: 4,
    detailViewHeight: 56,
    vegetationViewHeight: 62,
    movementDust: true,
    maxDecorativeEffects: 12,
  },
  high: {
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    anisotropy: 8,
    detailViewHeight: 64,
    vegetationViewHeight: 70,
    movementDust: true,
    maxDecorativeEffects: 24,
  },
};

export function parseRenderQuality(value: string | null | undefined): RenderQualityLevel | null {
  return RENDER_QUALITY_LEVELS.find((level) => level === value) ?? null;
}

export function chooseAutomaticRenderQuality(signals: RenderQualitySignals): RenderQualityLevel {
  if ((signals.deviceMemory ?? Number.POSITIVE_INFINITY) <= 4 || signals.viewportWidth < 600) return 'low';
  if (signals.viewportWidth < 1180 || signals.devicePixelRatio > 2) return 'medium';
  return 'high';
}

export function resolveRenderQuality(
  requested: string | null | undefined,
  signals: RenderQualitySignals,
): RenderQualityLevel {
  return parseRenderQuality(requested) ?? chooseAutomaticRenderQuality(signals);
}

export function nextRenderQuality(level: RenderQualityLevel): RenderQualityLevel {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return 'high';
}
