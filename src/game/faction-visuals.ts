import type { Team } from './types';

export interface FactionVisualStyle {
  id: string;
  label: string;
  primary: number;
  bright: number;
  dark: number;
  minimap: number;
}

export type HealthVisualBand = 'healthy' | 'warning' | 'critical';

function style(
  id: string,
  label: string,
  primary: number,
  bright: number,
  dark: number,
  minimap: number,
): Readonly<FactionVisualStyle> {
  return Object.freeze({ id, label, primary, bright, dark, minimap });
}

export const FACTION_VISUALS: Readonly<Record<Team, Readonly<FactionVisualStyle>>> = Object.freeze({
  player: style('player', '蓝方', 0x276fc1, 0x54b8ff, 0x102b49, 0x63bfff),
  enemy: style('enemy', '红方', 0xc43f3b, 0xff625d, 0x4a1716, 0xff6d67),
  neutral: style('neutral', '中立', 0x7d8985, 0xb5c0bc, 0x2a312f, 0xa8b3af),
});

const EXTENDED_FACTION_PALETTE: readonly Readonly<FactionVisualStyle>[] = Object.freeze([
  style('violet', '紫方', 0x7754c7, 0xa98aff, 0x2c204b, 0xb29aff),
  style('gold', '金方', 0xb77b24, 0xf0b955, 0x49300f, 0xf6c566),
  style('green', '绿方', 0x2d8b5d, 0x54d895, 0x123b28, 0x63e3a2),
  style('magenta', '品红方', 0xa84380, 0xf06bb6, 0x431c35, 0xf57bc0),
  style('teal', '青绿方', 0x25878a, 0x4ed5d2, 0x10383a, 0x62dfdc),
]);

function stableFactionHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function factionVisual(factionId: string): Readonly<FactionVisualStyle> {
  const id = factionId.trim().toLowerCase() || 'neutral';
  const builtIn = (FACTION_VISUALS as Readonly<Record<string, Readonly<FactionVisualStyle>>>)[id];
  if (builtIn) return builtIn;
  const source = EXTENDED_FACTION_PALETTE[stableFactionHash(id) % EXTENDED_FACTION_PALETTE.length]!;
  return Object.freeze({ ...source, id, label: factionId.trim() || source.label });
}

export function factionCssColor(
  factionId: string,
  tone: keyof Pick<FactionVisualStyle, 'primary' | 'bright' | 'dark' | 'minimap'> = 'bright',
): string {
  return `#${factionVisual(factionId)[tone].toString(16).padStart(6, '0')}`;
}

export function healthVisualBand(hp: number, maxHp: number): HealthVisualBand {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 'critical';
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  if (ratio > 0.55) return 'healthy';
  if (ratio > 0.25) return 'warning';
  return 'critical';
}

export function shouldShowHealthBar(selected: boolean, hp: number, maxHp: number): boolean {
  if (selected) return true;
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return false;
  return hp / maxHp < 0.995;
}

export const HEALTH_BAR_PRESENTATION = Object.freeze({
  trackColor: 0x071014,
  trackOpacity: 0.96,
  healthyColor: 0x55dc85,
  warningColor: 0xf0bd48,
  criticalColor: 0xf05a55,
  worldThickness: 0.24,
  heightOffset: 0.75,
  markerOffset: 1.28,
  unitMarkerSize: 0.4,
  buildingMarkerSize: 0.48,
});
