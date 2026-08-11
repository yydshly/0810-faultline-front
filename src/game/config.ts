import type { BuildingDefinition, BuildingKind, UnitDefinition, UnitKind } from './types';
import { FACTION_VISUALS } from './faction-visuals';

export const GAME_TICK_SECONDS = 0.05;
export const MAP_HALF_SIZE = 80;
export const PLAYER_COLOR = FACTION_VISUALS.player.primary;
export const ENEMY_COLOR = FACTION_VISUALS.enemy.primary;
// Legacy alias used by player-facing signals and command feedback.
export const CYAN = FACTION_VISUALS.player.bright;
export const SIGNAL_UNLOCK_SECONDS = 12 * 60;
export const SIGNAL_TARGET_SECONDS = 180;
export const VISIBILITY_CELL_SIZE = 2.5;
export const RADAR_MIN_POWER_RATIO = 0.7;
export const BUILDING_CANCEL_REFUND_RATIO = 0.75;
export const PRODUCTION_CANCEL_REFUND_RATIO = 0.75;
export const DEFENSE_MIN_POWER_RATIO = 0.7;
export const HARVESTER_CARGO_CAPACITY = 500;

export const UNIT_DEFS: Record<UnitKind, UnitDefinition> = {
  scout: {
    label: '獒犬侦察车', shortLabel: '侦察', cost: 260, buildTime: 18, bandwidth: 2,
    maxHp: 420, speed: 8.5, radius: 1.35, range: 5.5, minRange: 0, damage: 24,
    cooldown: 0.6, sight: 15, targetRole: '侦察与骚扰', producer: 'factory', projectileSpeed: 70,
  },
  rifle: {
    label: '盾线小队', shortLabel: '步兵', cost: 180, buildTime: 12, bandwidth: 2,
    maxHp: 320, speed: 3.8, radius: 0.75, range: 5, minRange: 0, damage: 24,
    cooldown: 0.55, sight: 11, targetRole: '反步兵与占领', producer: 'barracks', projectileSpeed: 90,
  },
  antitank: {
    label: '穿矛小队', shortLabel: '反甲', cost: 260, buildTime: 18, bandwidth: 3,
    maxHp: 280, speed: 3.4, radius: 0.78, range: 8, minRange: 1.5, damage: 180,
    cooldown: 2.8, sight: 12, targetRole: '反重甲', producer: 'barracks', projectileSpeed: 35,
  },
  engineer: {
    label: '工兵组', shortLabel: '工兵', cost: 220, buildTime: 15, bandwidth: 2,
    maxHp: 240, speed: 3.6, radius: 0.72, range: 0, minRange: 0, damage: 0,
    cooldown: 1, sight: 10, targetRole: '修理与占领', producer: 'barracks', projectileSpeed: 0,
  },
  suppressor: {
    label: '链炮压制车', shortLabel: '压制', cost: 450, buildTime: 26, bandwidth: 4,
    maxHp: 720, speed: 6.2, radius: 1.65, range: 6.5, minRange: 0, damage: 36,
    cooldown: 0.45, sight: 12, targetRole: '反步兵与轻甲', producer: 'factory', projectileSpeed: 80,
  },
  tank: {
    label: '堡垒坦克', shortLabel: '坦克', cost: 700, buildTime: 34, bandwidth: 7,
    maxHp: 1400, speed: 4.3, radius: 1.9, range: 7, minRange: 0, damage: 160,
    cooldown: 2.2, sight: 12, targetRole: '正面推进', producer: 'factory', projectileSpeed: 60,
  },
  artillery: {
    label: '长弧自行炮', shortLabel: '炮兵', cost: 850, buildTime: 42, bandwidth: 7,
    maxHp: 800, speed: 3.2, radius: 1.75, range: 14, minRange: 5, damage: 220,
    cooldown: 4, sight: 14, targetRole: '反建筑与集群', producer: 'factory', projectileSpeed: 22,
  },
  harvester: {
    label: '辉晶采集车', shortLabel: '采集', cost: 800, buildTime: 25, bandwidth: 3,
    maxHp: 680, speed: 4.8, radius: 1.7, range: 0, minRange: 0, damage: 0,
    cooldown: 1, sight: 9, targetRole: '采集辉晶', producer: 'refinery', projectileSpeed: 0,
  },
};

export const BUILDING_DEFS: Record<BuildingKind, BuildingDefinition> = {
  hq: {
    label: '指挥核心', shortLabel: '核心', cost: 0, buildTime: 0, maxHp: 5200,
    footprint: { x: 14, z: 12 }, powerSupply: 50, powerDemand: 0, buildRadius: 28,
    bandwidth: 60, description: '基地中枢；被摧毁即失败。',
  },
  reactor: {
    label: '反应堆', shortLabel: '电站', cost: 600, buildTime: 15, maxHp: 1600,
    footprint: { x: 8, z: 8 }, powerSupply: 100, powerDemand: 0, buildRadius: 0,
    bandwidth: 0, description: '提供 100 电力。',
  },
  refinery: {
    label: '辉晶精炼站', shortLabel: '精炼', cost: 1800, buildTime: 30, maxHp: 2400,
    footprint: { x: 12, z: 10 }, powerSupply: 0, powerDemand: 30, buildRadius: 0,
    bandwidth: 0, description: '接收采集车并生产采集车。',
  },
  barracks: {
    label: '盾线兵营', shortLabel: '兵营', cost: 800, buildTime: 20, maxHp: 1800,
    footprint: { x: 9, z: 8 }, powerSupply: 0, powerDemand: 15, buildRadius: 0,
    bandwidth: 0, description: '生产步兵与工兵。',
  },
  factory: {
    label: '载具工厂', shortLabel: '工厂', cost: 2000, buildTime: 35, maxHp: 2600,
    footprint: { x: 13, z: 10 }, powerSupply: 0, powerDemand: 30, buildRadius: 0,
    bandwidth: 0, description: '生产侦察、压制、坦克与炮兵。',
  },
  relay: {
    label: '后勤节点', shortLabel: '节点', cost: 600, buildTime: 18, maxHp: 1500,
    footprint: { x: 7, z: 7 }, powerSupply: 0, powerDemand: 10, buildRadius: 23,
    bandwidth: 15, description: '延伸建造与指挥网络，提升带宽。',
  },
  sentry: {
    label: '磁轨哨戒塔', shortLabel: '哨戒塔', cost: 650, buildTime: 18, maxHp: 1350,
    footprint: { x: 6, z: 6 }, powerSupply: 0, powerDemand: 15, buildRadius: 0,
    bandwidth: 0, description: '高射速压制步兵与轻型目标。',
    weapon: {
      range: 8.5, minRange: 0, damage: 32, cooldown: 0.4, sight: 10.5,
      projectileSpeed: 95, splashRadius: 0, targetRole: '反步兵与轻甲',
      damageMultipliers: { infantry: 1.5, light: 1.15, heavy: 0.3, building: 0.18 },
    },
  },
  cannon: {
    label: '断层重炮塔', shortLabel: '重炮塔', cost: 1250, buildTime: 28, maxHp: 1900,
    footprint: { x: 8, z: 8 }, powerSupply: 0, powerDemand: 30, buildRadius: 0,
    bandwidth: 0, description: '远程重炮，对重甲与建筑造成小范围伤害。',
    weapon: {
      range: 12.5, minRange: 3, damage: 190, cooldown: 2.6, sight: 14,
      projectileSpeed: 25, splashRadius: 3.2, targetRole: '反重甲与建筑',
      damageMultipliers: { infantry: 0.55, light: 1, heavy: 1.5, building: 1.1 },
    },
  },
};

export const BUILD_MENU: BuildingKind[] = ['reactor', 'refinery', 'barracks', 'factory', 'relay', 'sentry', 'cannon'];
export const UNIT_MENU: UnitKind[] = ['rifle', 'antitank', 'engineer', 'scout', 'suppressor', 'tank', 'artillery', 'harvester'];
