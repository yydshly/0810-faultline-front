import { BUILDING_DEFS, HARVESTER_CARGO_CAPACITY, MAP_HALF_SIZE, UNIT_DEFS, VISIBILITY_CELL_SIZE } from './config';
import { getBreakthroughDifficulty } from './difficulty';
import { createTechnologyTeamState } from './technology';
import type { BlockerState, BuildingKind, BuildingState, GameState, ResourceState, Team, UnitKind, UnitState, Vec2 } from './types';
import { VisibilityGrid } from './visibility';

export interface LevelAnchor {
  id: string;
  position: Vec2;
  purpose: 'spawn' | 'resource' | 'objective' | 'landmark';
}

export const LEVEL_ANCHORS: LevelAnchor[] = [
  { id: 'spawn_player', position: { x: -52, z: 46 }, purpose: 'spawn' },
  { id: 'spawn_enemy', position: { x: 52, z: -46 }, purpose: 'spawn' },
  { id: 'main_field_player', position: { x: -51, z: 18 }, purpose: 'resource' },
  { id: 'main_field_enemy', position: { x: 51, z: -18 }, purpose: 'resource' },
  { id: 'rich_field_west', position: { x: -52, z: -29 }, purpose: 'resource' },
  { id: 'rich_field_east', position: { x: 52, z: 29 }, purpose: 'resource' },
  { id: 'center_relay', position: { x: 0, z: 0 }, purpose: 'objective' },
  { id: 'landmark_north', position: { x: 0, z: 58 }, purpose: 'landmark' },
  { id: 'landmark_south', position: { x: 0, z: -58 }, purpose: 'landmark' },
];

const createBuilding = (id: string, team: Exclude<Team, 'neutral'>, kind: BuildingKind, position: Vec2, rotation = 0): BuildingState => {
  const def = BUILDING_DEFS[kind];
  return {
    id, entityType: 'building', team, kind, position, rotation,
    aimRotation: rotation,
    hp: def.maxHp, maxHp: def.maxHp, footprint: { ...def.footprint },
    connected: true, powered: true, buildProgress: 1, cooldownRemaining: 0, queue: [],
  };
};

const createUnit = (id: string, team: Exclude<Team, 'neutral'>, kind: UnitKind, position: Vec2, rotation = 0): UnitState => {
  const def = UNIT_DEFS[kind];
  return {
    id, entityType: 'unit', team, kind, position, rotation,
    hp: def.maxHp, maxHp: def.maxHp, radius: def.radius,
    cooldownRemaining: 0, order: { type: 'idle' }, cargo: 0,
    cargoCapacity: kind === 'harvester' ? HARVESTER_CARGO_CAPACITY : 0,
  };
};

const resource = (id: string, x: number, z: number, amount: number): ResourceState => ({
  id, entityType: 'resource', team: 'neutral', position: { x, z }, amount, maxAmount: amount, radius: 5.2,
});

const blocker = (id: string, x: number, z: number, radius: number): BlockerState => ({
  id, position: { x, z }, radius, blocksMovement: true, blocksVision: false,
});

export function createInitialGameState(seed = 1949, fixture = 'default'): GameState {
  const visibilityGrid = new VisibilityGrid({
    bounds: { minX: -MAP_HALF_SIZE, maxX: MAP_HALF_SIZE, minZ: -MAP_HALF_SIZE, maxZ: MAP_HALF_SIZE },
    cellSize: VISIBILITY_CELL_SIZE,
  });
  const playerBase = { x: -52, z: 46 };
  const enemyBase = { x: 52, z: -46 };
  const buildings: BuildingState[] = [
    createBuilding('b-player-hq', 'player', 'hq', playerBase, Math.PI),
    createBuilding('b-player-reactor', 'player', 'reactor', { x: -65, z: 44 }),
    createBuilding('b-player-refinery', 'player', 'refinery', { x: -49, z: 30 }, Math.PI),
    createBuilding('b-player-barracks', 'player', 'barracks', { x: -37, z: 48 }, Math.PI),
    createBuilding('b-enemy-hq', 'enemy', 'hq', enemyBase, 0),
    createBuilding('b-enemy-reactor', 'enemy', 'reactor', { x: 65, z: -44 }),
    createBuilding('b-enemy-refinery', 'enemy', 'refinery', { x: 49, z: -30 }, 0),
    createBuilding('b-enemy-barracks', 'enemy', 'barracks', { x: 37, z: -48 }, 0),
  ];

  const units: UnitState[] = [
    createUnit('u-player-harvester', 'player', 'harvester', { x: -47, z: 24 }, Math.PI),
    createUnit('u-player-scout', 'player', 'scout', { x: -34, z: 39 }, Math.PI),
    createUnit('u-player-rifle-1', 'player', 'rifle', { x: -32, z: 46 }, Math.PI),
    createUnit('u-player-rifle-2', 'player', 'rifle', { x: -30, z: 49 }, Math.PI),
    createUnit('u-player-engineer', 'player', 'engineer', { x: -37, z: 53 }, Math.PI),
    createUnit('u-player-tank', 'player', 'tank', { x: -29, z: 42 }, Math.PI),
    createUnit('u-enemy-harvester', 'enemy', 'harvester', { x: 47, z: -24 }, 0),
    createUnit('u-enemy-scout', 'enemy', 'scout', { x: 34, z: -39 }, 0),
    createUnit('u-enemy-rifle-1', 'enemy', 'rifle', { x: 32, z: -46 }, 0),
    createUnit('u-enemy-rifle-2', 'enemy', 'rifle', { x: 30, z: -49 }, 0),
    createUnit('u-enemy-antitank', 'enemy', 'antitank', { x: 36, z: -41 }, 0),
    createUnit('u-enemy-tank', 'enemy', 'tank', { x: 29, z: -42 }, 0),
  ];

  const visualGoldReview = fixture === 'visual-gold-review';
  const constructionReview = fixture === 'construction-review' || fixture === 'construction-review-reduced';
  const wreckReview = fixture === 'wreck-review' || fixture === 'wreck-review-reduced';
  const buildingRuinReview = fixture === 'building-ruin-review'
    || fixture === 'building-ruin-review-reduced';
  const destructionResidueReview = fixture === 'destruction-residue-review'
    || fixture === 'destruction-residue-review-reduced';
  const buildingDamageReview = fixture === 'building-damage-review'
    || fixture === 'building-damage-review-reduced';
  const enemyInfrastructureReview = fixture === 'enemy-infrastructure-review';
  const playerInfrastructureReview = fixture === 'player-infrastructure-review';
  const enemyVehicleSocketReview = fixture === 'enemy-vehicle-socket-review';
  const combatVehicleFamilyReview = fixture === 'combat-vehicle-family-review';
  const breakthroughDemo = fixture.startsWith('breakthrough-demo');
  const breakthroughDifficulty = getBreakthroughDifficulty(fixture);
  const breakthroughVictoryReview = fixture === 'breakthrough-demo-victory-review';
  const breakthroughDefeatReview = fixture === 'breakthrough-demo-defeat-review';
  if (visualGoldReview) {
    buildings.splice(
      0,
      buildings.length,
      // Authored player entrances face +Z. Keep them facing the fixed review
      // camera so the HQ threshold and factory production bay are inspectable.
      createBuilding('b-gold-player-hq', 'player', 'hq', { x: -10, z: 7 }, 0),
      createBuilding('b-gold-player-factory', 'player', 'factory', { x: 4, z: 5 }, 0),
      createBuilding('b-gold-enemy-sentry', 'enemy', 'sentry', { x: 25, z: -9 }, 0),
      // The command core stays outside the review frame so the normal victory
      // contract remains active without adding another hero asset to the shot.
      createBuilding('b-gold-enemy-hq-anchor', 'enemy', 'hq', { x: 68, z: -68 }, 0),
    );
    units.splice(
      0,
      units.length,
      createUnit('u-gold-player-harvester', 'player', 'harvester', { x: -18, z: -5 }, Math.PI * 0.75),
      createUnit('u-gold-player-tank', 'player', 'tank', { x: -9, z: -5 }, Math.PI * 0.65),
      createUnit('u-gold-player-rifle', 'player', 'rifle', { x: -3, z: -8 }, Math.PI * 0.55),
      createUnit('u-gold-player-engineer', 'player', 'engineer', { x: 2, z: -10 }, Math.PI * 0.5),
      createUnit('u-gold-player-antitank', 'player', 'antitank', { x: 7, z: -11 }, Math.PI * 0.45),
      createUnit('u-gold-enemy-tank', 'enemy', 'tank', { x: 20, z: -7 }, -Math.PI * 0.35),
      createUnit('u-gold-enemy-rifle', 'enemy', 'rifle', { x: 17, z: -14 }, -Math.PI * 0.4),
    );
    const goldHarvester = units.find((unit) => unit.id === 'u-gold-player-harvester');
    if (goldHarvester) goldHarvester.cargo = HARVESTER_CARGO_CAPACITY * 0.67;
    const goldFactory = buildings.find((building) => building.id === 'b-gold-player-factory');
    if (goldFactory) {
      goldFactory.queue.push(
        // Keep the review bay truthfully active for several minutes without a
        // spawned unit changing the authored lineup during browser capture.
        { unitKind: 'tank', remaining: 180, total: 900 },
        { unitKind: 'tank', remaining: UNIT_DEFS.tank.buildTime, total: UNIT_DEFS.tank.buildTime },
        { unitKind: 'tank', remaining: UNIT_DEFS.tank.buildTime, total: UNIT_DEFS.tank.buildTime },
      );
    }
  }
  if (constructionReview) {
    buildings.splice(
      0,
      buildings.length,
      // Off-frame command anchors preserve the normal victory contract while
      // the review grid stays dedicated to build-stage readability.
      createBuilding('b-construction-player-hq-anchor', 'player', 'hq', { x: -70, z: 70 }, 0),
      createBuilding('b-construction-enemy-hq-anchor', 'enemy', 'hq', { x: 70, z: -70 }, Math.PI),
    );
    units.splice(0, units.length);
    const constructionKinds: BuildingKind[] = [
      'reactor',
      'refinery',
      'barracks',
      'factory',
      'relay',
      'sentry',
      'cannon',
    ];
    const progressStages = [0.15, 0.48, 0.82] as const;
    const positions = [
      { x: -30, z: 24 }, { x: -10, z: 24 }, { x: 10, z: 24 }, { x: 30, z: 24 },
      { x: -20, z: 8 }, { x: 0, z: 8 }, { x: 20, z: 8 },
    ] as const;
    constructionKinds.forEach((kind, index) => {
      const progress = progressStages[index % progressStages.length] ?? 0.15;
      const playerBuilding = createBuilding(
        `b-construction-player-${kind}`,
        'player',
        kind,
        positions[index] ?? { x: 0, z: 0 },
        0,
      );
      playerBuilding.buildProgress = progress;
      playerBuilding.hp = playerBuilding.maxHp * progress;
      buildings.push(playerBuilding);

      const playerPosition = positions[index] ?? { x: 0, z: 0 };
      const enemyBuilding = createBuilding(
        `b-construction-enemy-${kind}`,
        'enemy',
        kind,
        { x: playerPosition.x, z: -playerPosition.z },
        Math.PI,
      );
      enemyBuilding.buildProgress = progress;
      enemyBuilding.hp = enemyBuilding.maxHp * progress;
      buildings.push(enemyBuilding);
    });
    // These observers exist only to make the enemy construction row truthfully
    // visible through the normal fog-of-war system.
    for (const x of [-30, -10, 10, 30]) {
      units.push(createUnit(`u-construction-observer-${x}`, 'player', 'engineer', { x, z: -16 }, Math.PI));
    }
  }
  if (wreckReview) {
    buildings.splice(
      0,
      buildings.length,
      // Off-frame command anchors preserve the normal victory contract while
      // the central arena remains dedicated to vehicle destruction review.
      createBuilding('b-wreck-player-hq-anchor', 'player', 'hq', { x: -70, z: 70 }, 0),
      createBuilding('b-wreck-enemy-hq-anchor', 'enemy', 'hq', { x: 70, z: -70 }, Math.PI),
    );
    units.splice(0, units.length);

    const playerTankTarget = createUnit('u-wreck-player-tank', 'player', 'tank', { x: -15, z: 10 }, Math.PI / 2);
    const enemyTankAttacker = createUnit('u-wreck-enemy-tank-attacker', 'enemy', 'tank', { x: -8, z: 10 }, -Math.PI / 2);
    const enemyTankTarget = createUnit('u-wreck-enemy-tank', 'enemy', 'tank', { x: 15, z: 10 }, -Math.PI / 2);
    const playerTankAttacker = createUnit('u-wreck-player-tank-attacker', 'player', 'tank', { x: 8, z: 10 }, Math.PI / 2);
    const playerHarvesterTarget = createUnit('u-wreck-player-harvester', 'player', 'harvester', { x: -15, z: -8 }, Math.PI / 2);
    const enemyHarvesterAttacker = createUnit('u-wreck-enemy-harvester-attacker', 'enemy', 'tank', { x: -8, z: -8 }, -Math.PI / 2);
    const enemyHarvesterTarget = createUnit('u-wreck-enemy-harvester', 'enemy', 'harvester', { x: 15, z: -8 }, -Math.PI / 2);
    const playerHarvesterAttacker = createUnit('u-wreck-player-harvester-attacker', 'player', 'tank', { x: 8, z: -8 }, Math.PI / 2);

    for (const target of [playerTankTarget, enemyTankTarget, playerHarvesterTarget, enemyHarvesterTarget]) {
      target.hp = Math.min(target.maxHp, 1);
      target.cooldownRemaining = 999;
    }
    for (const attacker of [enemyTankAttacker, playerTankAttacker, enemyHarvesterAttacker, playerHarvesterAttacker]) {
      // Delay the first real shot so all four local authored GLBs can commit
      // before the authoritative destroyed events are emitted.
      attacker.cooldownRemaining = 4.5;
    }
    enemyTankAttacker.order = { type: 'attack', targetId: playerTankTarget.id };
    playerTankAttacker.order = { type: 'attack', targetId: enemyTankTarget.id };
    enemyHarvesterAttacker.order = { type: 'attack', targetId: playerHarvesterTarget.id };
    playerHarvesterAttacker.order = { type: 'attack', targetId: enemyHarvesterTarget.id };
    playerTankTarget.order = { type: 'attack', targetId: enemyTankAttacker.id };
    enemyTankTarget.order = { type: 'attack', targetId: playerTankAttacker.id };
    units.push(
      playerTankTarget,
      enemyTankAttacker,
      enemyTankTarget,
      playerTankAttacker,
      playerHarvesterTarget,
      enemyHarvesterAttacker,
      enemyHarvesterTarget,
      playerHarvesterAttacker,
    );
  }
  if (buildingRuinReview) {
    buildings.splice(
      0,
      buildings.length,
      // The review targets include both command cores, so separate off-frame
      // anchors keep the authoritative match active after the four impacts.
      createBuilding('b-ruin-player-hq-anchor', 'player', 'hq', { x: -70, z: 70 }, 0),
      createBuilding('b-ruin-enemy-hq-anchor', 'enemy', 'hq', { x: 70, z: -70 }, Math.PI),
    );
    units.splice(0, units.length);

    // Two centered faction rows keep every live building inside the desktop
    // review frame while leaving a clean upper and lower firing lane.
    const playerHqTarget = createBuilding('b-ruin-player-hq', 'player', 'hq', { x: -2, z: 20 }, 0);
    const enemyHqTarget = createBuilding('b-ruin-enemy-hq', 'enemy', 'hq', { x: 2, z: -20 }, 0);
    const playerFactoryTarget = createBuilding('b-ruin-player-factory', 'player', 'factory', { x: 20, z: -2 }, 0);
    const enemyFactoryTarget = createBuilding('b-ruin-enemy-factory', 'enemy', 'factory', { x: -20, z: 2 }, 0);
    for (const target of [playerHqTarget, enemyHqTarget, playerFactoryTarget, enemyFactoryTarget]) {
      target.hp = 1;
      buildings.push(target);
    }

    // Artillery remains outside the 48-unit-tall review frame while still using the
    // real range, line-of-sight, projectile travel, impact and destroyed-event
    // contracts. Their authored models are intentionally excluded by the
    // focused fixture allowlist, so only the four building masters are loaded.
    const enemyHqAttacker = createUnit('u-ruin-enemy-hq-attacker', 'player', 'artillery', { x: -9.31, z: -31.31 }, 0);
    const playerHqAttacker = createUnit('u-ruin-player-hq-attacker', 'enemy', 'artillery', { x: 9.31, z: 31.31 }, 0);
    const enemyFactoryAttacker = createUnit('u-ruin-enemy-factory-attacker', 'player', 'artillery', { x: -31.31, z: -9.31 }, 0);
    const playerFactoryAttacker = createUnit('u-ruin-player-factory-attacker', 'enemy', 'artillery', { x: 31.31, z: 9.31 }, 0);
    const attackers = [enemyHqAttacker, playerHqAttacker, enemyFactoryAttacker, playerFactoryAttacker];
    for (const attacker of attackers) attacker.cooldownRemaining = 3.7;
    enemyHqAttacker.order = { type: 'attack', targetId: enemyHqTarget.id };
    playerHqAttacker.order = { type: 'attack', targetId: playerHqTarget.id };
    enemyFactoryAttacker.order = { type: 'attack', targetId: enemyFactoryTarget.id };
    playerFactoryAttacker.order = { type: 'attack', targetId: playerFactoryTarget.id };
    units.push(...attackers);
  }
  if (destructionResidueReview) {
    buildings.splice(
      0,
      buildings.length,
      // Both command cores stay outside the review frame so the authoritative
      // match remains active after every central target has been destroyed.
      createBuilding('b-residue-player-hq-anchor', 'player', 'hq', { x: -70, z: 70 }, 0),
      createBuilding('b-residue-enemy-hq-anchor', 'enemy', 'hq', { x: 70, z: -70 }, Math.PI),
    );
    units.splice(0, units.length);

    // Under the fixed 45-degree camera, constant x + z values form horizontal
    // rows. Vehicles occupy the upper row; infantry occupy the lower row.
    const targetSpecs: ReadonlyArray<{
      id: string;
      kind: UnitKind;
      position: Vec2;
      attackerPosition: Vec2;
    }> = [
      {
        id: 'u-residue-target-scout', kind: 'scout',
        position: { x: -9, z: 31 }, attackerPosition: { x: 2.95, z: 42.95 },
      },
      {
        id: 'u-residue-target-suppressor', kind: 'suppressor',
        position: { x: 11, z: 11 }, attackerPosition: { x: 22.95, z: 22.95 },
      },
      {
        id: 'u-residue-target-artillery', kind: 'artillery',
        position: { x: 31, z: -9 }, attackerPosition: { x: 42.95, z: 2.95 },
      },
      {
        id: 'u-residue-target-rifle', kind: 'rifle',
        position: { x: -31, z: 9 }, attackerPosition: { x: -42.95, z: -2.95 },
      },
      {
        id: 'u-residue-target-engineer', kind: 'engineer',
        position: { x: -11, z: -11 }, attackerPosition: { x: -22.95, z: -22.95 },
      },
      {
        id: 'u-residue-target-antitank', kind: 'antitank',
        position: { x: 9, z: -31 }, attackerPosition: { x: -2.95, z: -42.95 },
      },
    ];
    for (const spec of targetSpecs) {
      const target = createUnit(spec.id, 'player', spec.kind, spec.position, 0);
      target.hp = 1;
      // In particular this prevents the player artillery from answering the
      // off-frame shot while leaving movement and combat rules untouched.
      target.cooldownRemaining = 999;
      const attacker = createUnit(`${spec.id.replace('target', 'attacker')}`, 'enemy', 'artillery', spec.attackerPosition, 0);
      attacker.cooldownRemaining = 3.7;
      attacker.order = { type: 'attack', targetId: target.id };
      units.push(target, attacker);
    }
  }
  if (buildingDamageReview) {
    buildings.splice(0, buildings.length);
    units.splice(0, units.length);
    const damageLineup: ReadonlyArray<{
      id: string;
      team: 'player' | 'enemy';
      kind: 'hq' | 'factory';
      position: { x: number; z: number };
      ratio: number;
    }> = [
      // Camera yaw is 45 degrees. Constant x + z therefore forms a true
      // horizontal comparison row on screen instead of a diagonal world grid.
      { id: 'b-damage-player-hq-damaged', team: 'player', kind: 'hq', position: { x: -22, z: 14 }, ratio: 0.52 },
      { id: 'b-damage-player-factory-damaged', team: 'player', kind: 'factory', position: { x: -10, z: 2 }, ratio: 0.52 },
      { id: 'b-damage-enemy-hq-damaged', team: 'enemy', kind: 'hq', position: { x: 2, z: -10 }, ratio: 0.52 },
      { id: 'b-damage-enemy-factory-damaged', team: 'enemy', kind: 'factory', position: { x: 14, z: -22 }, ratio: 0.52 },
      { id: 'b-damage-player-hq-critical', team: 'player', kind: 'hq', position: { x: -7, z: 29 }, ratio: 0.22 },
      { id: 'b-damage-player-factory-critical', team: 'player', kind: 'factory', position: { x: 5, z: 17 }, ratio: 0.22 },
      { id: 'b-damage-enemy-hq-critical', team: 'enemy', kind: 'hq', position: { x: 17, z: 5 }, ratio: 0.22 },
      { id: 'b-damage-enemy-factory-critical', team: 'enemy', kind: 'factory', position: { x: 29, z: -7 }, ratio: 0.22 },
    ];
    for (const item of damageLineup) {
      const building = createBuilding(
        item.id,
        item.team,
        item.kind,
        item.position,
        0,
      );
      building.hp = building.maxHp * item.ratio;
      buildings.push(building);
    }
  }
  if (enemyInfrastructureReview) {
    buildings.splice(
      0,
      buildings.length,
      // Command anchors remain outside the desktop review frame so destroying
      // both infrastructure targets cannot finish the authoritative match.
      createBuilding('b-enemy-infra-player-hq-anchor', 'player', 'hq', { x: -70, z: 70 }, 0),
      createBuilding('b-enemy-infra-enemy-hq-anchor', 'enemy', 'hq', { x: 70, z: -70 }, Math.PI),
    );
    units.splice(0, units.length);

    const stages: ReadonlyArray<{
      suffix: 'healthy' | 'damaged' | 'critical' | 'ruin-target';
      screenColumn: number;
      ratio: number;
    }> = [
      { suffix: 'healthy', screenColumn: -30, ratio: 1 },
      { suffix: 'damaged', screenColumn: -10, ratio: 0.52 },
      { suffix: 'critical', screenColumn: 10, ratio: 0.22 },
      { suffix: 'ruin-target', screenColumn: 30, ratio: 1 / 1600 },
    ];
    const rowSpecs: ReadonlyArray<{ kind: 'barracks' | 'reactor'; screenRow: number }> = [
      { kind: 'barracks', screenRow: 12 },
      { kind: 'reactor', screenRow: -12 },
    ];
    for (const row of rowSpecs) {
      for (const stage of stages) {
        // At the fixed 45-degree camera, x - z controls screen columns while
        // x + z controls rows. This keeps both asset families directly comparable.
        const position = {
          x: (row.screenRow + stage.screenColumn) / 2,
          z: (row.screenRow - stage.screenColumn) / 2,
        };
        const building = createBuilding(
          `b-enemy-infra-${row.kind}-${stage.suffix}`,
          'enemy',
          row.kind,
          position,
          0,
        );
        building.hp = stage.suffix === 'ruin-target'
          ? 1
          : building.maxHp * stage.ratio;
        buildings.push(building);
      }
    }

    for (const row of rowSpecs) {
      const target = buildings.find((building) => building.id === `b-enemy-infra-${row.kind}-ruin-target`);
      if (!target) continue;
      // Continue 19 screen-axis units beyond the target: 13.44 world units,
      // inside real artillery range/sight but outside the fixed review frame.
      const attackerColumn = 49;
      const attacker = createUnit(
        `u-enemy-infra-${row.kind}-attacker`,
        'player',
        'artillery',
        {
          x: (row.screenRow + attackerColumn) / 2,
          z: (row.screenRow - attackerColumn) / 2,
        },
        -Math.PI / 4,
      );
      // The delay gives both target GLBs time to commit before the real shot,
      // projectile flight, impact and destroyed event produce authored ruins.
      attacker.cooldownRemaining = 3.7;
      attacker.order = { type: 'attack', targetId: target.id };
      units.push(attacker);
    }
  }
  if (playerInfrastructureReview) {
    buildings.splice(
      0,
      buildings.length,
      // Both command anchors stay outside the review frame so the two real
      // infrastructure destructions cannot end the authoritative match.
      createBuilding('b-player-infra-player-hq-anchor', 'player', 'hq', { x: -70, z: 70 }, 0),
      createBuilding('b-player-infra-enemy-hq-anchor', 'enemy', 'hq', { x: 70, z: -70 }, Math.PI),
    );
    units.splice(0, units.length);

    const stages: ReadonlyArray<{
      suffix: 'healthy' | 'damaged' | 'critical' | 'ruin-target';
      screenColumn: number;
      ratio: number;
    }> = [
      { suffix: 'healthy', screenColumn: -30, ratio: 1 },
      { suffix: 'damaged', screenColumn: -10, ratio: 0.52 },
      { suffix: 'critical', screenColumn: 10, ratio: 0.22 },
      { suffix: 'ruin-target', screenColumn: 30, ratio: 1 / 1600 },
    ];
    const rowSpecs: ReadonlyArray<{ kind: 'barracks' | 'reactor'; screenRow: number }> = [
      { kind: 'barracks', screenRow: 12 },
      { kind: 'reactor', screenRow: -12 },
    ];
    for (const row of rowSpecs) {
      for (const stage of stages) {
        // Camera yaw is fixed at 45 degrees: x-z selects the screen column and
        // x+z selects the row, giving the two asset families identical framing.
        const position = {
          x: (row.screenRow + stage.screenColumn) / 2,
          z: (row.screenRow - stage.screenColumn) / 2,
        };
        const building = createBuilding(
          `b-player-infra-${row.kind}-${stage.suffix}`,
          'player',
          row.kind,
          position,
          0,
        );
        building.hp = stage.suffix === 'ruin-target'
          ? 1
          : building.maxHp * stage.ratio;
        buildings.push(building);
      }
    }

    for (const row of rowSpecs) {
      const target = buildings.find((building) => building.id === `b-player-infra-${row.kind}-ruin-target`);
      if (!target) continue;
      const attackerColumn = 49;
      const attacker = createUnit(
        `u-player-infra-${row.kind}-attacker`,
        'enemy',
        'artillery',
        {
          x: (row.screenRow + attackerColumn) / 2,
          z: (row.screenRow - attackerColumn) / 2,
        },
        (Math.PI * 3) / 4,
      );
      // This is the same authoritative shot delay as the enemy counterpart:
      // asset commit first, then real projectile, impact and destroyed events.
      attacker.cooldownRemaining = 3.7;
      attacker.order = { type: 'attack', targetId: target.id };
      units.push(attacker);
    }
  }
  if (enemyVehicleSocketReview) {
    buildings.splice(
      0,
      buildings.length,
      // These two durable HQ targets supply normal sight and remain alive for
      // repeated authoritative fire throughout the desktop capture window.
      createBuilding('b-enemy-socket-suppressor-target', 'player', 'hq', { x: -6, z: 6 }, 0),
      createBuilding('b-enemy-socket-artillery-target', 'player', 'hq', { x: 18, z: -18 }, 0),
      // The enemy command anchor keeps the normal match-end contract intact.
      createBuilding('b-enemy-socket-enemy-hq-anchor', 'enemy', 'hq', { x: 70, z: -70 }, Math.PI),
    );
    for (const target of buildings.filter((building) => building.id.endsWith('-target'))) {
      target.maxHp = 1_000_000;
      target.hp = target.maxHp;
    }
    units.splice(0, units.length);

    const suppressor = createUnit(
      'u-enemy-socket-suppressor',
      'enemy',
      'suppressor',
      { x: -10, z: 10 },
      (Math.PI * 3) / 4,
    );
    suppressor.cooldownRemaining = 0.65;
    suppressor.order = { type: 'attack', targetId: 'b-enemy-socket-suppressor-target' };

    const artillery = createUnit(
      'u-enemy-socket-artillery',
      'enemy',
      'artillery',
      { x: 5, z: -5 },
      (Math.PI * 3) / 4,
    );
    artillery.cooldownRemaining = 0.85;
    artillery.order = { type: 'attack', targetId: 'b-enemy-socket-artillery-target' };
    units.push(suppressor, artillery);
  }
  if (combatVehicleFamilyReview) {
    buildings.splice(
      0,
      buildings.length,
      createBuilding('b-combat-vehicle-family-player-hq-anchor', 'player', 'hq', { x: -70, z: 70 }, 0),
      createBuilding('b-combat-vehicle-family-enemy-hq-anchor', 'enemy', 'hq', { x: 70, z: -70 }, Math.PI),
    );
    units.splice(0, units.length);

    const rows: ReadonlyArray<{ kind: 'scout' | 'suppressor' | 'artillery'; screenRow: number }> = [
      { kind: 'scout', screenRow: 16 },
      { kind: 'suppressor', screenRow: 0 },
      { kind: 'artillery', screenRow: -16 },
    ];
    for (const row of rows) {
      for (const [team, screenColumn] of [['player', -18], ['enemy', 18]] as const) {
        const unit = createUnit(
          `u-combat-vehicle-family-${team}-${row.kind}`,
          team,
          row.kind,
          {
            x: (row.screenRow + screenColumn) / 2,
            z: (row.screenRow - screenColumn) / 2,
          },
          0,
        );
        // A very long cooldown is a second safety rail; the hidden vision-only
        // divider below is the primary guarantee that idle review units never
        // acquire a target, move, or emit combat VFX.
        unit.cooldownRemaining = 999;
        units.push(unit);
      }
    }
  }

  if (fixture === 'combat' || fixture === 'combat-reduced') {
    const fixturePlayer = createUnit('u-fixture-player', 'player', 'suppressor', { x: -2.5, z: 1.5 }, Math.PI / 2);
    const fixtureEnemy = createUnit('u-fixture-enemy', 'enemy', 'rifle', { x: 2.5, z: -1.5 }, -Math.PI / 2);
    fixturePlayer.order = { type: 'attack', targetId: fixtureEnemy.id };
    fixtureEnemy.order = { type: 'attack', targetId: fixturePlayer.id };
    units.push(fixturePlayer, fixtureEnemy);
  }
  if (fixture === 'hero-tank-review' || fixture === 'hero-tank-review-reduced') {
    const heroTank = createUnit('u-hero-tank-review', 'player', 'tank', { x: -4.5, z: 1.2 }, Math.PI / 2);
    const targetVehicle = createUnit('u-hero-target-review', 'enemy', 'tank', { x: 4.5, z: -1.2 }, -Math.PI / 2);
    targetVehicle.hp = Math.min(targetVehicle.maxHp, 720);
    heroTank.order = { type: 'attack', targetId: targetVehicle.id };
    targetVehicle.order = { type: 'attack', targetId: heroTank.id };
    units.push(heroTank, targetVehicle);
  }
  if (fixture === 'infantry-rig-review' || fixture === 'infantry-rig-review-reduced') {
    const heroSquad = createUnit('u-infantry-rig-review', 'player', 'rifle', { x: -8.5, z: 10 }, Math.PI / 2);
    const targetSquad = createUnit('u-infantry-target-review', 'enemy', 'rifle', { x: 8.5, z: 10 }, -Math.PI / 2);
    heroSquad.hp = 280;
    targetSquad.hp = 160;
    heroSquad.order = { type: 'attack', targetId: targetSquad.id };
    targetSquad.order = { type: 'attack', targetId: heroSquad.id };
    const doomedSquad = createUnit('u-infantry-death-review', 'player', 'rifle', { x: -2.5, z: 14 }, Math.PI / 2);
    const tankTarget = createUnit('u-infantry-death-target', 'enemy', 'tank', { x: 3.5, z: 14 }, -Math.PI / 2);
    doomedSquad.hp = 100;
    tankTarget.cooldownRemaining = 2.4;
    doomedSquad.order = { type: 'attack', targetId: tankTarget.id };
    tankTarget.order = { type: 'attack', targetId: doomedSquad.id };
    units.push(heroSquad, targetSquad, doomedSquad, tankTarget);
  }
  if (fixture === 'infantry-family-review' || fixture === 'infantry-family-review-reduced') {
    const playerRifle = createUnit('u-family-player-rifle', 'player', 'rifle', { x: -5, z: 8 }, Math.PI / 2);
    const enemyRifle = createUnit('u-family-enemy-rifle', 'enemy', 'rifle', { x: 5, z: 8 }, -Math.PI / 2);
    playerRifle.maxHp = playerRifle.hp = 1800;
    enemyRifle.maxHp = enemyRifle.hp = 1800;
    playerRifle.order = { type: 'attack', targetId: enemyRifle.id };
    enemyRifle.order = { type: 'attack', targetId: playerRifle.id };

    const playerAntitank = createUnit('u-family-player-antitank', 'player', 'antitank', { x: -7, z: 13 }, Math.PI / 2);
    const enemyAntitank = createUnit('u-family-enemy-antitank', 'enemy', 'antitank', { x: 7, z: 13 }, -Math.PI / 2);
    const playerTank = createUnit('u-family-player-target', 'player', 'tank', { x: -1.5, z: 13 }, Math.PI / 2);
    const enemyTank = createUnit('u-family-enemy-target', 'enemy', 'tank', { x: 1.5, z: 13 }, -Math.PI / 2);
    playerAntitank.maxHp = playerAntitank.hp = 1800;
    enemyAntitank.maxHp = enemyAntitank.hp = 1800;
    playerTank.maxHp = playerTank.hp = 5000;
    enemyTank.maxHp = enemyTank.hp = 5000;
    playerAntitank.order = { type: 'attack', targetId: enemyTank.id };
    enemyAntitank.order = { type: 'attack', targetId: playerTank.id };
    playerTank.order = { type: 'attack', targetId: enemyTank.id };
    enemyTank.order = { type: 'attack', targetId: playerTank.id };

    const playerEngineer = createUnit('u-family-player-engineer', 'player', 'engineer', { x: -5, z: 18 }, Math.PI / 2);
    const enemyEngineer = createUnit('u-family-enemy-engineer', 'enemy', 'engineer', { x: 5, z: 18 }, -Math.PI / 2);
    playerEngineer.order = { type: 'move', target: { x: -1.5, z: 18 } };
    enemyEngineer.order = { type: 'move', target: { x: 1.5, z: 18 } };
    units.push(
      playerRifle,
      enemyRifle,
      playerAntitank,
      enemyAntitank,
      playerTank,
      enemyTank,
      playerEngineer,
      enemyEngineer,
    );
  }
  if (fixture === 'skirmish' || fixture === 'skirmish-reduced') {
    const formation: Array<readonly [UnitKind, Vec2, Vec2]> = [
      ['rifle', { x: -4, z: -8 }, { x: 4, z: -8 }],
      ['antitank', { x: -5, z: -3 }, { x: 5, z: -3 }],
      ['engineer', { x: -7, z: 5 }, { x: 7, z: 5 }],
      ['scout', { x: -1, z: 2 }, { x: 1, z: 2 }],
      ['suppressor', { x: -8, z: -12 }, { x: 8, z: -12 }],
      ['tank', { x: -9, z: 0 }, { x: 9, z: 0 }],
      ['artillery', { x: -10, z: 11 }, { x: 10, z: 11 }],
    ];
    const playerForce = formation.map(([kind, playerPosition]) => createUnit(
      `u-skirmish-player-${kind}`,
      'player',
      kind,
      playerPosition,
      Math.PI / 2,
    ));
    const enemyForce = formation.map(([kind, , enemyPosition]) => createUnit(
      `u-skirmish-enemy-${kind}`,
      'enemy',
      kind,
      enemyPosition,
      -Math.PI / 2,
    ));
    for (const unit of [...playerForce, ...enemyForce]) {
      unit.maxHp = Math.round(unit.maxHp * 3);
      unit.hp = unit.maxHp;
    }
    const playerObserver = playerForce.find((unit) => unit.kind === 'scout');
    if (playerObserver) playerObserver.maxHp = playerObserver.hp = 20_000;
    for (let index = 0; index < enemyForce.length; index += 1) {
      const enemy = enemyForce[index];
      const target = playerForce[index];
      if (!enemy || !target) continue;
      enemy.order = enemy.kind === 'engineer'
        ? { type: 'move', target: { x: 1.5, z: enemy.position.z } }
        : { type: 'attack', targetId: target.id };
    }
    units.push(...playerForce, ...enemyForce);
  }
  if (fixture === 'campaign-demo' || fixture === 'campaign-demo-reduced') {
    buildings.push(
      createBuilding('b-demo-player-relay', 'player', 'relay', { x: -29, z: 40 }, Math.PI),
      createBuilding('b-demo-player-factory', 'player', 'factory', { x: -31, z: 27 }, Math.PI),
      createBuilding('b-demo-player-sentry', 'player', 'sentry', { x: -13, z: 27 }, Math.PI),
      createBuilding('b-demo-enemy-relay', 'enemy', 'relay', { x: 29, z: -40 }, 0),
      createBuilding('b-demo-enemy-factory', 'enemy', 'factory', { x: 31, z: -27 }, 0),
      createBuilding('b-demo-enemy-sentry', 'enemy', 'sentry', { x: 13, z: -27 }, 0),
    );

    const formation: Array<readonly [UnitKind, Vec2, Vec2]> = [
      ['rifle', { x: -19, z: 11 }, { x: -2, z: 3 }],
      ['antitank', { x: -21, z: 7 }, { x: 1, z: 5 }],
      ['engineer', { x: -23, z: 17 }, { x: 4, z: 7 }],
      ['scout', { x: -10, z: 9 }, { x: 1, z: -2 }],
      ['suppressor', { x: -25, z: 3 }, { x: 6, z: 2 }],
      ['tank', { x: -22, z: -2 }, { x: 8, z: 5 }],
      ['artillery', { x: -28, z: 13 }, { x: 12, z: 10 }],
    ];
    const playerForce = formation.map(([kind, playerPosition]) => createUnit(
      `u-demo-player-${kind}`,
      'player',
      kind,
      playerPosition,
      Math.PI / 2,
    ));
    const enemyForce = formation.map(([kind, , enemyPosition]) => createUnit(
      `u-demo-enemy-${kind}`,
      'enemy',
      kind,
      enemyPosition,
      -Math.PI / 2,
    ));
    for (const unit of [...playerForce, ...enemyForce]) {
      unit.maxHp = Math.round(unit.maxHp * 3);
      unit.hp = unit.maxHp;
    }
    const playerObserver = playerForce.find((unit) => unit.kind === 'scout');
    if (playerObserver) playerObserver.maxHp = playerObserver.hp = 20_000;
    for (let index = 0; index < enemyForce.length; index += 1) {
      const enemy = enemyForce[index];
      const target = playerForce[index];
      if (!enemy || !target) continue;
      enemy.order = enemy.kind === 'engineer'
        ? { type: 'move', target: { x: -5, z: 5 } }
        : { type: 'attack', targetId: target.id };
    }
    units.push(...playerForce, ...enemyForce);
  }
  if (breakthroughDemo) {
    const playableBreakthrough = !breakthroughVictoryReview && !breakthroughDefeatReview;
    buildings.push(
      createBuilding('b-break-player-relay', 'player', 'relay', { x: -29, z: 40 }, Math.PI),
      createBuilding('b-break-player-factory', 'player', 'factory', { x: -31, z: 27 }, Math.PI),
      createBuilding('b-break-enemy-relay-rear', 'enemy', 'relay', { x: 29, z: -41 }, 0),
      createBuilding('b-break-enemy-relay-front', 'enemy', 'relay', { x: 11, z: -42 }, 0),
      createBuilding('b-break-enemy-factory', 'enemy', 'factory', { x: 33, z: -34 }, 0),
      createBuilding('b-break-enemy-sentry', 'enemy', 'sentry', { x: 9, z: -22 }, 0),
      createBuilding('b-break-enemy-cannon', 'enemy', 'cannon', { x: 23, z: -23 }, 0),
    );
    const enemyHq = buildings.find((building) => building.id === 'b-enemy-hq');
    if (enemyHq) enemyHq.hp = Math.round(enemyHq.maxHp * breakthroughDifficulty.enemyHqHpRatio);
    for (const id of ['b-break-enemy-sentry', 'b-break-enemy-cannon']) {
      const defense = buildings.find((building) => building.id === id);
      if (defense) defense.hp = Math.round(defense.maxHp * (
        playableBreakthrough ? breakthroughDifficulty.frontlineDefenseHpRatio : 0.72
      ));
    }

    const playerSpecs: Array<readonly [string, UnitKind, Vec2]> = playableBreakthrough
      ? [
          ['rifle', 'rifle', { x: -38, z: 18 }],
          ['antitank', 'antitank', { x: -34, z: 15 }],
          ['engineer', 'engineer', { x: -41, z: 22 }],
          ['observer', 'scout', { x: -29, z: 15 }],
          ['tank', 'tank', { x: -33, z: 21 }],
        ]
      : [
          ['rifle-1', 'rifle', { x: -8, z: -4 }],
          ['rifle-2', 'rifle', { x: -11, z: -1 }],
          ['antitank', 'antitank', { x: -7, z: 0 }],
          ['engineer', 'engineer', { x: -14, z: 5 }],
          ['observer', 'scout', { x: -2, z: -10 }],
          ['suppressor', 'suppressor', { x: -12, z: -7 }],
          ['tank-1', 'tank', { x: -7, z: -9 }],
          ['tank-2', 'tank', { x: -3, z: -12 }],
          ['artillery-1', 'artillery', { x: -17, z: 4 }],
          ['artillery-2', 'artillery', { x: -15, z: 8 }],
        ];
    const playerForce = playerSpecs.map(([id, kind, position]) => createUnit(
      `u-break-player-${id}`,
      'player',
      kind,
      position,
      Math.PI * 0.72,
    ));
    for (const unit of playerForce) {
      unit.maxHp = Math.round(unit.maxHp * (
        playableBreakthrough ? breakthroughDifficulty.initialPlayerForceHpMultiplier : 2
      ));
      unit.hp = unit.maxHp;
    }
    const observer = playerForce.find((unit) => unit.id === 'u-break-player-observer');
    if (observer && !playableBreakthrough) observer.maxHp = observer.hp = 20_000;

    const enemySpecs: Array<readonly [UnitKind, Vec2]> = playableBreakthrough
      ? [
          ['rifle', { x: 14, z: -31 }],
          ['antitank', { x: 18, z: -32 }],
          ['scout', { x: 12, z: -35 }],
          ['tank', { x: 24, z: -31 }],
          ['artillery', { x: 29, z: -27 }],
        ]
      : [
          ['rifle', { x: 7, z: -13 }],
          ['antitank', { x: 12, z: -12 }],
          ['engineer', { x: 16, z: -8 }],
          ['scout', { x: 7, z: -16 }],
          ['suppressor', { x: 17, z: -11 }],
          ['tank', { x: 20, z: -15 }],
          ['artillery', { x: 25, z: -9 }],
        ];
    const enemyForce = enemySpecs.map(([kind, position]) => createUnit(
      `u-break-enemy-${kind}`,
      'enemy',
      kind,
      position,
      -Math.PI * 0.28,
    ));
    for (let index = 0; index < enemyForce.length; index += 1) {
      const enemy = enemyForce[index];
      const target = playerForce[Math.min(index, playerForce.length - 1)];
      if (!enemy || !target) continue;
      enemy.maxHp = Math.round(enemy.maxHp * (
        playableBreakthrough ? breakthroughDifficulty.initialEnemyForceHpMultiplier : 4
      ));
      enemy.hp = enemy.maxHp;
      enemy.order = playableBreakthrough
        ? { type: 'idle' }
        : enemy.kind === 'engineer'
          ? { type: 'move', target: { x: 10, z: -18 } }
          : { type: 'attack', targetId: target.id };
    }
    if (breakthroughVictoryReview) {
      units.splice(0, units.length);
      const artillery = playerForce.find((unit) => unit.kind === 'artillery');
      const observer = playerForce.find((unit) => unit.kind === 'scout');
      if (enemyHq) {
        enemyHq.position = { x: 18, z: -16 };
        enemyHq.hp = 1;
      }
      if (artillery && enemyHq) {
        artillery.position = { x: 9, z: -14 };
        artillery.cooldownRemaining = 0.35;
        artillery.order = { type: 'attack', targetId: enemyHq.id };
        units.push(artillery);
      }
      if (observer) {
        observer.position = { x: 12, z: -14 };
        observer.order = { type: 'idle' };
        units.push(observer);
      }
      for (let index = buildings.length - 1; index >= 0; index -= 1) {
        if (buildings[index]?.id === 'b-break-enemy-sentry' || buildings[index]?.id === 'b-break-enemy-cannon') {
          buildings.splice(index, 1);
        }
      }
    } else if (breakthroughDefeatReview) {
      units.splice(0, units.length);
      const playerHq = buildings.find((building) => building.id === 'b-player-hq');
      const artillery = enemyForce.find((unit) => unit.kind === 'artillery');
      const observer = enemyForce.find((unit) => unit.kind === 'scout');
      if (playerHq) {
        playerHq.position = { x: 6, z: -16 };
        playerHq.hp = 1;
      }
      if (artillery && playerHq) {
        artillery.position = { x: 15, z: -14 };
        artillery.cooldownRemaining = 0.35;
        artillery.order = { type: 'attack', targetId: playerHq.id };
        units.push(artillery);
      }
      if (observer) {
        observer.position = { x: 12, z: -14 };
        observer.order = { type: 'idle' };
        units.push(observer);
      }
    } else {
      units.push(...playerForce, ...enemyForce);
    }
  }
  if (fixture === 'asset-review') {
    units.push(
      createUnit('u-review-suppressor', 'player', 'suppressor', { x: -38, z: 25 }, Math.PI),
      createUnit('u-review-artillery', 'player', 'artillery', { x: -25, z: 20 }, Math.PI),
    );
  }
  if (fixture === 'enemy-review') {
    const enemyHarvester = units.find((unit) => unit.id === 'u-enemy-harvester');
    if (enemyHarvester) enemyHarvester.cargo = HARVESTER_CARGO_CAPACITY * 0.8;
    units.push(
      createUnit('u-review-player-observer', 'player', 'scout', { x: -9, z: 3 }, Math.PI / 2),
    );
  }
  if (fixture === 'dynamic-review' || fixture === 'dynamic-review-reduced') {
    const tank = units.find((unit) => unit.id === 'u-player-tank');
    const scout = units.find((unit) => unit.id === 'u-player-scout');
    const rifle = units.find((unit) => unit.id === 'u-player-rifle-1');
    if (tank) tank.order = { type: 'move', target: { x: -45, z: 34 } };
    if (scout) scout.order = { type: 'move', target: { x: -57, z: 35 } };
    if (rifle) rifle.order = { type: 'move', target: { x: -43, z: 55 } };
    const harvester = units.find((unit) => unit.id === 'u-player-harvester');
    if (harvester) harvester.cargo = HARVESTER_CARGO_CAPACITY * 0.5;

    const barracks = buildings.find((building) => building.id === 'b-player-barracks');
    if (barracks) {
      barracks.queue.push(
        { unitKind: 'rifle', remaining: 10, total: UNIT_DEFS.rifle.buildTime },
        { unitKind: 'engineer', remaining: UNIT_DEFS.engineer.buildTime, total: UNIT_DEFS.engineer.buildTime },
        { unitKind: 'antitank', remaining: UNIT_DEFS.antitank.buildTime, total: UNIT_DEFS.antitank.buildTime },
      );
      barracks.hp = barracks.maxHp * 0.22;
    }
    const factory = createBuilding('b-review-factory', 'player', 'factory', { x: -33, z: 31 }, Math.PI);
    factory.queue.push(
      { unitKind: 'scout', remaining: 14, total: UNIT_DEFS.scout.buildTime },
      { unitKind: 'suppressor', remaining: UNIT_DEFS.suppressor.buildTime, total: UNIT_DEFS.suppressor.buildTime },
      { unitKind: 'tank', remaining: UNIT_DEFS.tank.buildTime, total: UNIT_DEFS.tank.buildTime },
    );
    buildings.push(factory);
    const construction = createBuilding('b-review-construction', 'player', 'relay', { x: -62, z: 33 });
    construction.buildProgress = 0.48;
    construction.hp = construction.maxHp * construction.buildProgress;
    buildings.push(construction);
  }

  return {
    seed,
    tick: 0,
    elapsed: fixture === 'beacon'
      ? 11 * 60 + 55
      : fixture === 'campaign-demo' || fixture === 'campaign-demo-reduced'
        ? 11 * 60 + 45
        : 0,
    status: 'active',
    statusReason: '',
    units,
    buildings,
    resources: visualGoldReview
      ? [resource('r-gold-ore', -27, 6, 18000)]
      : constructionReview || wreckReview || buildingRuinReview || destructionResidueReview || buildingDamageReview || enemyInfrastructureReview || playerInfrastructureReview || enemyVehicleSocketReview || combatVehicleFamilyReview
        ? []
      : [
        resource('r-player-main', -51, 18, 18000),
        resource('r-enemy-main', 51, -18, 18000),
        resource('r-west-rich', -52, -29, 30000),
        resource('r-east-rich', 52, 29, 30000),
      ],
    blockers: visualGoldReview
      ? [
        blocker('blocker-gold-north', 20, 16, 3.8),
        blocker('blocker-gold-west', -42, 4, 3.2),
      ]
      : combatVehicleFamilyReview
        ? [{ id: 'blocker-combat-vehicle-family-vision-divider', position: { x: 0, z: 0 }, radius: 14, blocksMovement: false, blocksVision: true }]
      : constructionReview || wreckReview || buildingRuinReview || destructionResidueReview || buildingDamageReview || enemyInfrastructureReview || playerInfrastructureReview || enemyVehicleSocketReview
        ? []
      : [
        blocker('blocker-nw-1', -16, 32, 5), blocker('blocker-nw-2', -8, 38, 4),
        blocker('blocker-se-1', 16, -32, 5), blocker('blocker-se-2', 8, -38, 4),
        blocker('blocker-ne-1', 28, 24, 4.5), blocker('blocker-sw-1', -28, -24, 4.5),
      ],
    beacon: {
      id: 'center_relay', position: visualGoldReview || constructionReview || wreckReview || buildingRuinReview || destructionResidueReview || buildingDamageReview || enemyInfrastructureReview || playerInfrastructureReview || enemyVehicleSocketReview || combatVehicleFamilyReview
        ? { x: 70, z: 70 }
        : { x: 0, z: 0 }, radius: 7,
      unlocked: fixture === 'beacon', controllingTeam: null, contested: false,
      playerProgress: 0, enemyProgress: 0, targetProgress: 180,
    },
    ai: {
      enemy: { phase: 'economy', reason: 'initializing', stateEnteredTick: 0 },
    },
    economy: {
      player: { credits: fixture.startsWith('campaign-demo') ? 5200 : fixture.startsWith('breakthrough-demo') ? 6000 : 3200, powerSupply: 150, powerDemand: 45, powerRatio: 1, bandwidthUsed: 0, bandwidthCap: 60, incomePerMinute: 0 },
      enemy: { credits: enemyVehicleSocketReview || combatVehicleFamilyReview ? 0 : fixture.startsWith('campaign-demo') ? 5200 : fixture.startsWith('breakthrough-demo') ? 6000 : 3200, powerSupply: 150, powerDemand: 45, powerRatio: 1, bandwidthUsed: 0, bandwidthCap: 60, incomePerMinute: 0 },
    },
    intel: {
      player: { visibility: visibilityGrid.update([]), radarOnline: false, visibleEnemyIds: [] },
      enemy: { visibility: visibilityGrid.update([]), radarOnline: false, visibleEnemyIds: [] },
    },
    mission: {
      kind: fixture.startsWith('breakthrough-demo') ? 'breakthrough' : 'standard',
      phase: breakthroughVictoryReview || breakthroughDefeatReview
        ? 'command'
        : fixture.startsWith('breakthrough-demo') ? 'deployment' : 'command',
      phaseStartedTick: 0,
      counterattackUnitIds: [],
      reinforcementUnitIds: [],
    },
    technology: {
      player: createTechnologyTeamState(),
      enemy: createTechnologyTeamState(),
    },
    notifications: [],
  };
}

export function assertFlatLevel(state: GameState): string[] {
  const failures: string[] = [];
  const stableIds = new Set<string>();
  for (const anchor of LEVEL_ANCHORS) {
    if (stableIds.has(anchor.id)) failures.push(`duplicate anchor: ${anchor.id}`);
    stableIds.add(anchor.id);
  }
  for (const entity of [...state.units, ...state.buildings, ...state.resources]) {
    if (!Number.isFinite(entity.position.x) || !Number.isFinite(entity.position.z)) {
      failures.push(`invalid position: ${entity.id}`);
    }
  }
  return failures;
}
