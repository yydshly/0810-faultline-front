import { describe, expect, it } from 'vitest';
import { GAME_TICK_SECONDS, MAP_HALF_SIZE, UNIT_DEFS } from './config';
import { LEVEL_ANCHORS, assertFlatLevel, createInitialGameState } from './level';
import { GameSimulation } from './simulation';

describe('灰烬环线关卡数据', () => {
  it('所有稳定锚点唯一且位于平面地图边界内', () => {
    const ids = new Set(LEVEL_ANCHORS.map((anchor) => anchor.id));
    expect(ids.size).toBe(LEVEL_ANCHORS.length);
    for (const anchor of LEVEL_ANCHORS) {
      expect(Math.abs(anchor.position.x)).toBeLessThanOrEqual(MAP_HALF_SIZE);
      expect(Math.abs(anchor.position.z)).toBeLessThanOrEqual(MAP_HALF_SIZE);
    }
  });

  it('初始状态通过平面与坐标检查', () => {
    const state = createInitialGameState();
    expect(assertFlatLevel(state)).toEqual([]);
    expect(state.beacon.position).toEqual({ x: 0, z: 0 });
    expect(state.resources).toHaveLength(4);
  });

  it('双方初始内容形成可玩的镜像骨架', () => {
    const state = createInitialGameState();
    const playerHq = state.buildings.find((building) => building.id === 'b-player-hq');
    const enemyHq = state.buildings.find((building) => building.id === 'b-enemy-hq');
    expect(playerHq?.kind).toBe('hq');
    expect(enemyHq?.kind).toBe('hq');
    expect(state.units.some((unit) => unit.team === 'player' && unit.kind === 'harvester')).toBe(true);
    expect(state.units.some((unit) => unit.team === 'enemy' && unit.kind === 'harvester')).toBe(true);
  });

  it('资产审阅夹具稳定加入压制车和自行炮', () => {
    const state = createInitialGameState(1949, 'asset-review');
    expect(state.units.find((unit) => unit.id === 'u-review-suppressor')?.kind).toBe('suppressor');
    expect(state.units.find((unit) => unit.id === 'u-review-artillery')?.kind).toBe('artillery');
  });
});

describe('formal playable review fixtures', () => {
  it('lays out all player and enemy construction stages on the flat review plane', () => {
    const simulation = new GameSimulation(1949, 'construction-review');
    const state = simulation.state;
    const staged = state.buildings.filter((building) =>
      building.id.startsWith('b-construction-player-') || building.id.startsWith('b-construction-enemy-'))
      .filter((building) => !building.id.endsWith('-hq-anchor'));
    expect(staged).toHaveLength(14);
    expect(new Set(staged.map((building) => building.kind))).toEqual(new Set([
      'reactor', 'refinery', 'barracks', 'factory', 'relay', 'sentry', 'cannon',
    ]));
    expect(staged.filter((building) => building.buildProgress === 0.15)).toHaveLength(6);
    expect(staged.filter((building) => building.buildProgress === 0.48)).toHaveLength(4);
    expect(staged.filter((building) => building.buildProgress === 0.82)).toHaveLength(4);
    const visibleEnemyReviewBuildings = state.buildings.filter((building) =>
      building.team === 'enemy'
      && building.id.startsWith('b-construction-enemy-')
      && !building.id.endsWith('-hq-anchor')
      && state.intel.player.visibleEnemyIds.includes(building.id));
    expect(visibleEnemyReviewBuildings).toHaveLength(7);
    expect(state.resources).toHaveLength(0);
    expect(state.blockers).toHaveLength(0);
    expect(state.beacon.position).toEqual({ x: 70, z: 70 });
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('builds a stable desktop visual-gold lineup with truthful production and cargo state', () => {
    const simulation = new GameSimulation(1949, 'visual-gold-review');
    const state = simulation.state;
    const playerKinds = state.units
      .filter((unit) => unit.team === 'player')
      .map((unit) => unit.kind)
      .sort();
    expect(playerKinds).toEqual(['antitank', 'engineer', 'harvester', 'rifle', 'tank']);
    expect(state.units.filter((unit) => unit.team === 'enemy').map((unit) => unit.kind).sort())
      .toEqual(['rifle', 'tank']);
    expect(state.buildings.find((building) => building.id === 'b-gold-player-hq')?.kind).toBe('hq');
    const factory = state.buildings.find((building) => building.id === 'b-gold-player-factory');
    expect(factory?.kind).toBe('factory');
    expect(factory?.queue).toHaveLength(3);
    const harvester = state.units.find((unit) => unit.id === 'u-gold-player-harvester');
    expect(harvester?.cargo).toBeCloseTo(335);
    expect(harvester?.cargoCapacity).toBe(500);
    expect(state.resources).toHaveLength(1);
    expect(state.blockers).toHaveLength(2);
    expect(state.intel.player.visibleEnemyIds).toEqual(expect.arrayContaining([
      'u-gold-enemy-tank',
      'u-gold-enemy-rifle',
      'b-gold-enemy-sentry',
    ]));
    expect(state.intel.player.visibleEnemyIds).not.toContain('b-gold-enemy-hq-anchor');
    expect(assertFlatLevel(state)).toEqual([]);

    const initialPositions = state.units.map((unit) => [unit.id, unit.position.x, unit.position.z]);
    simulation.step(2);
    expect(simulation.state.units.slice(0, initialPositions.length).map((unit) => [
      unit.id,
      unit.position.x,
      unit.position.z,
    ])).toEqual(initialPositions);
    expect(simulation.state.buildings.find((building) => building.id === 'b-gold-player-factory')?.queue[0]?.remaining)
      .toBeLessThan(180);
  });

  it('compares the two authored main battle tank masters under the same combat contract', () => {
    const state = createInitialGameState(1949, 'hero-tank-review');
    const playerTank = state.units.find((unit) => unit.id === 'u-hero-tank-review');
    const enemyTank = state.units.find((unit) => unit.id === 'u-hero-target-review');
    expect(playerTank).toMatchObject({ team: 'player', kind: 'tank' });
    expect(enemyTank).toMatchObject({ team: 'enemy', kind: 'tank' });
    expect(playerTank?.order).toEqual({ type: 'attack', targetId: enemyTank?.id });
    expect(enemyTank?.order).toEqual({ type: 'attack', targetId: playerTank?.id });
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('stages four delayed, visible vehicle destructions for authored wreck review', () => {
    const state = createInitialGameState(1949, 'wreck-review');
    const reviewUnits = state.units.filter((unit) => unit.id.startsWith('u-wreck-'));
    const targets = reviewUnits.filter((unit) => !unit.id.endsWith('-attacker'));
    const attackers = reviewUnits.filter((unit) => unit.id.endsWith('-attacker'));

    expect(reviewUnits).toHaveLength(8);
    expect(targets.map((unit) => `${unit.team}:${unit.kind}`).sort()).toEqual([
      'enemy:harvester',
      'enemy:tank',
      'player:harvester',
      'player:tank',
    ]);
    expect(targets.every((unit) => unit.hp === 1)).toBe(true);
    expect(attackers).toHaveLength(4);
    expect(attackers.every((unit) => unit.cooldownRemaining === 4.5 && unit.order.type === 'attack')).toBe(true);
    expect(state.resources).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('emits the four real destroyed events only after the wreck assets have a loading window', () => {
    const simulation = new GameSimulation(1949, 'wreck-review');
    simulation.step(4.4);
    expect(simulation.drainEvents().filter((event) => event.type === 'destroyed')).toHaveLength(0);
    expect(simulation.state.units.filter((unit) => unit.id.startsWith('u-wreck-') && !unit.id.endsWith('-attacker')))
      .toHaveLength(4);

    simulation.step(0.4);
    const destroyedIds = simulation.drainEvents()
      .filter((event) => event.type === 'destroyed')
      .map((event) => event.targetId)
      .sort();
    expect(destroyedIds).toEqual([
      'u-wreck-enemy-harvester',
      'u-wreck-enemy-tank',
      'u-wreck-player-harvester',
      'u-wreck-player-tank',
    ]);
  });

  it('stages three vehicle and three infantry residue targets with off-frame logical artillery', () => {
    for (const fixture of ['destruction-residue-review', 'destruction-residue-review-reduced']) {
      const state = createInitialGameState(1949, fixture);
      const targets = state.units.filter((unit) => unit.id.startsWith('u-residue-target-'));
      const attackers = state.units.filter((unit) => unit.id.startsWith('u-residue-attacker-'));

      expect(targets.map((unit) => unit.kind).sort()).toEqual([
        'antitank', 'artillery', 'engineer', 'rifle', 'scout', 'suppressor',
      ]);
      expect(targets.every((unit) =>
        unit.team === 'player'
        && unit.hp === 1
        && unit.cooldownRemaining === 999
        && Math.abs((unit.position.x + unit.position.z) / Math.SQRT2) < 28)).toBe(true);
      expect(attackers).toHaveLength(6);
      expect(attackers.every((unit) =>
        unit.team === 'enemy'
        && unit.kind === 'artillery'
        && unit.cooldownRemaining === 3.7
        && unit.order.type === 'attack'
        && Math.abs((unit.position.x + unit.position.z) / Math.SQRT2) > 28)).toBe(true);
      expect(new Set(attackers.map((unit) => unit.order.type === 'attack' ? unit.order.targetId : undefined)))
        .toEqual(new Set(targets.map((unit) => unit.id)));
      expect(state.buildings.map((building) => building.id).sort()).toEqual([
        'b-residue-enemy-hq-anchor', 'b-residue-player-hq-anchor',
      ]);
      expect(state.resources).toEqual([]);
      expect(state.blockers).toEqual([]);
      expect(state.beacon.position).toEqual({ x: 70, z: 70 });
      expect(assertFlatLevel(state)).toEqual([]);
    }
  });

  it('stages four delayed core-building destructions with off-frame victory anchors', () => {
    for (const fixture of ['building-ruin-review', 'building-ruin-review-reduced']) {
      const state = createInitialGameState(1949, fixture);
      const targets = state.buildings.filter((building) =>
        building.id.startsWith('b-ruin-') && !building.id.endsWith('-anchor'));
      const attackers = state.units.filter((unit) => unit.id.startsWith('u-ruin-'));

      expect(targets.map((building) => `${building.team}:${building.kind}`).sort()).toEqual([
        'enemy:factory',
        'enemy:hq',
        'player:factory',
        'player:hq',
      ]);
      expect(targets.every((building) => building.hp === 1 && building.rotation === 0)).toBe(true);
      expect(attackers).toHaveLength(4);
      expect(attackers.every((unit) =>
        unit.kind === 'artillery'
        && unit.cooldownRemaining === 3.7
        && unit.order.type === 'attack')).toBe(true);
      expect(state.buildings.filter((building) => building.id.endsWith('-hq-anchor'))).toHaveLength(2);
      expect(state.intel.player.visibleEnemyIds).toEqual([]);
      expect(state.resources).toEqual([]);
      expect(state.blockers).toEqual([]);
      expect(state.beacon.position).toEqual({ x: 70, z: 70 });
      expect(assertFlatLevel(state)).toEqual([]);
    }
  });

  it('holds all four core building masters in authoritative damaged and critical rows', () => {
    const simulation = new GameSimulation(1949, 'building-damage-review');
    const reviewBuildings = simulation.state.buildings.filter((building) => building.id.startsWith('b-damage-'));
    expect(reviewBuildings).toHaveLength(8);
    expect(reviewBuildings.filter((building) => building.hp / building.maxHp === 0.52)).toHaveLength(4);
    expect(reviewBuildings.filter((building) => building.hp / building.maxHp === 0.22)).toHaveLength(4);
    expect(new Set(reviewBuildings.map((building) => `${building.team}:${building.kind}`))).toEqual(new Set([
      'player:hq', 'player:factory', 'enemy:hq', 'enemy:factory',
    ]));
    expect(reviewBuildings.every((building) => building.rotation === 0)).toBe(true);
    expect(simulation.state.units).toHaveLength(0);
    expect(simulation.state.intel.player.visibleEnemyIds.filter((id) => id.startsWith('b-damage-enemy-')))
      .toHaveLength(4);
    simulation.step(30);
    expect(simulation.state.buildings.filter((building) => building.id.startsWith('b-damage-'))).toHaveLength(8);
    expect(assertFlatLevel(simulation.state)).toEqual([]);
  });

  it('stages enemy barracks and reactor across healthy, damaged, critical and ruin columns', () => {
    const state = new GameSimulation(1949, 'enemy-infrastructure-review').state;
    const reviewBuildings = state.buildings.filter((building) => building.id.startsWith('b-enemy-infra-')
      && !building.id.endsWith('-anchor'));
    const attackers = state.units.filter((unit) => unit.id.startsWith('u-enemy-infra-'));

    expect(reviewBuildings).toHaveLength(8);
    expect(reviewBuildings.filter((building) => building.id.endsWith('-healthy'))
      .every((building) => building.hp === building.maxHp)).toBe(true);
    expect(reviewBuildings.filter((building) => building.id.endsWith('-damaged'))
      .every((building) => building.hp / building.maxHp === 0.52)).toBe(true);
    expect(reviewBuildings.filter((building) => building.id.endsWith('-critical'))
      .every((building) => building.hp / building.maxHp === 0.22)).toBe(true);
    expect(reviewBuildings.filter((building) => building.id.endsWith('-ruin-target'))
      .every((building) => building.hp === 1)).toBe(true);
    expect(new Set(reviewBuildings.map((building) => building.kind))).toEqual(new Set(['barracks', 'reactor']));
    expect(reviewBuildings.every((building) => building.team === 'enemy' && building.rotation === 0)).toBe(true);
    expect(attackers).toHaveLength(2);
    expect(attackers.every((unit) =>
      unit.team === 'player'
      && unit.kind === 'artillery'
      && unit.cooldownRemaining === 3.7
      && unit.order.type === 'attack')).toBe(true);
    expect(state.buildings.filter((building) => building.id.endsWith('-hq-anchor'))).toHaveLength(2);
    expect(state.intel.player.visibleEnemyIds.filter((id) => id.startsWith('b-enemy-infra-') && !id.endsWith('-anchor')))
      .toHaveLength(8);
    expect(state.resources).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(state.beacon.position).toEqual({ x: 70, z: 70 });
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('creates both infrastructure ruins from delayed authoritative destroyed events', () => {
    const simulation = new GameSimulation(1949, 'enemy-infrastructure-review');
    simulation.step(4.2);
    expect(simulation.drainEvents().filter((event) => event.type === 'destroyed')).toHaveLength(0);

    simulation.step(0.6);
    const destroyedIds = simulation.drainEvents()
      .filter((event) => event.type === 'destroyed')
      .map((event) => event.targetId)
      .sort();
    expect(destroyedIds).toEqual([
      'b-enemy-infra-barracks-ruin-target',
      'b-enemy-infra-reactor-ruin-target',
    ]);
    expect(simulation.state.status).toBe('active');
    expect(simulation.state.buildings.filter((building) => building.id.endsWith('-hq-anchor'))).toHaveLength(2);
    expect(simulation.state.buildings.filter((building) => building.id.startsWith('b-enemy-infra-')
      && !building.id.endsWith('-anchor'))).toHaveLength(6);
  });

  it('stages player barracks and reactor across healthy, damaged, critical and ruin columns', () => {
    const state = new GameSimulation(1949, 'player-infrastructure-review').state;
    const reviewBuildings = state.buildings.filter((building) => building.id.startsWith('b-player-infra-')
      && !building.id.endsWith('-anchor'));
    const attackers = state.units.filter((unit) => unit.id.startsWith('u-player-infra-'));

    expect(reviewBuildings).toHaveLength(8);
    expect(reviewBuildings.filter((building) => building.id.endsWith('-healthy'))
      .every((building) => building.hp === building.maxHp)).toBe(true);
    expect(reviewBuildings.filter((building) => building.id.endsWith('-damaged'))
      .every((building) => building.hp / building.maxHp === 0.52)).toBe(true);
    expect(reviewBuildings.filter((building) => building.id.endsWith('-critical'))
      .every((building) => building.hp / building.maxHp === 0.22)).toBe(true);
    expect(reviewBuildings.filter((building) => building.id.endsWith('-ruin-target'))
      .every((building) => building.hp === 1)).toBe(true);
    expect(new Set(reviewBuildings.map((building) => building.kind))).toEqual(new Set(['barracks', 'reactor']));
    expect(reviewBuildings.every((building) => building.team === 'player' && building.rotation === 0)).toBe(true);
    expect(attackers).toHaveLength(2);
    expect(attackers.every((unit) =>
      unit.team === 'enemy'
      && unit.kind === 'artillery'
      && unit.cooldownRemaining === 3.7
      && unit.order.type === 'attack')).toBe(true);
    expect(state.buildings.filter((building) => building.id.endsWith('-hq-anchor'))).toHaveLength(2);
    expect(state.resources).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(state.beacon.position).toEqual({ x: 70, z: 70 });
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('creates both player infrastructure ruins from delayed authoritative destroyed events', () => {
    const simulation = new GameSimulation(1949, 'player-infrastructure-review');
    const mirror = new GameSimulation(1949, 'player-infrastructure-review');
    simulation.step(4.2);
    mirror.step(4.2);
    expect(simulation.drainEvents().filter((event) => event.type === 'destroyed')).toHaveLength(0);
    expect(mirror.drainEvents().filter((event) => event.type === 'destroyed')).toHaveLength(0);

    simulation.step(0.6);
    mirror.step(0.6);
    const destroyedIds = simulation.drainEvents()
      .filter((event) => event.type === 'destroyed')
      .map((event) => event.targetId)
      .sort();
    expect(destroyedIds).toEqual([
      'b-player-infra-barracks-ruin-target',
      'b-player-infra-reactor-ruin-target',
    ]);
    expect(simulation.state.status).toBe('active');
    expect(simulation.state.buildings.filter((building) => building.id.endsWith('-hq-anchor'))).toHaveLength(2);
    expect(simulation.state.buildings.filter((building) => building.id.startsWith('b-player-infra-')
      && !building.id.endsWith('-anchor'))).toHaveLength(6);
    mirror.drainEvents();
    expect(simulation.hashState()).toBe(mirror.hashState());
  });

  it('holds enemy suppressor and artillery on durable disclosed socket-review targets', () => {
    const state = new GameSimulation(1949, 'enemy-vehicle-socket-review').state;
    const suppressor = state.units.find((unit) => unit.id === 'u-enemy-socket-suppressor');
    const artillery = state.units.find((unit) => unit.id === 'u-enemy-socket-artillery');
    const targets = state.buildings.filter((building) => building.id.startsWith('b-enemy-socket-')
      && building.id.endsWith('-target'));

    expect(state.units).toHaveLength(2);
    expect(suppressor).toMatchObject({ team: 'enemy', kind: 'suppressor', cooldownRemaining: 0.65 });
    expect(artillery).toMatchObject({ team: 'enemy', kind: 'artillery', cooldownRemaining: 0.85 });
    expect(suppressor?.order).toEqual({ type: 'attack', targetId: 'b-enemy-socket-suppressor-target' });
    expect(artillery?.order).toEqual({ type: 'attack', targetId: 'b-enemy-socket-artillery-target' });
    expect(targets).toHaveLength(2);
    expect(targets.every((target) => target.team === 'player' && target.kind === 'hq'
      && target.hp === target.maxHp)).toBe(true);
    expect(state.intel.player.visibleEnemyIds).toEqual(expect.arrayContaining([
      'u-enemy-socket-suppressor',
      'u-enemy-socket-artillery',
    ]));
    expect(state.intel.enemy.visibleEnemyIds).toEqual(expect.arrayContaining([
      'b-enemy-socket-suppressor-target',
      'b-enemy-socket-artillery-target',
    ]));
    expect(state.economy.enemy.credits).toBe(0);
    expect(state.resources).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(state.beacon.position).toEqual({ x: 70, z: 70 });
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('repeats real suppressor and artillery shots without destroying either static target', () => {
    const left = new GameSimulation(1949, 'enemy-vehicle-socket-review');
    const right = new GameSimulation(1949, 'enemy-vehicle-socket-review');
    left.step(9);
    right.step(9);
    const leftEvents = left.drainEvents();
    const rightEvents = right.drainEvents();
    const shotsBySource = (events: typeof leftEvents, sourceId: string) => events.filter((event) =>
      event.type === 'shot' && event.sourceId === sourceId);

    expect(shotsBySource(leftEvents, 'u-enemy-socket-suppressor').length).toBeGreaterThanOrEqual(12);
    expect(shotsBySource(leftEvents, 'u-enemy-socket-artillery').length).toBeGreaterThanOrEqual(2);
    expect(leftEvents.filter((event) => event.type === 'impact').length).toBeGreaterThanOrEqual(10);
    expect(leftEvents.filter((event) => event.type === 'destroyed')).toHaveLength(0);
    expect(left.state.buildings.filter((building) => building.id.endsWith('-target'))).toHaveLength(2);
    expect(left.state.status).toBe('active');
    expect(left.state.ai.enemy).toEqual({ phase: 'economy', reason: 'initializing', stateEnteredTick: 0 });
    expect(leftEvents).toEqual(rightEvents);
    expect(left.hashState()).toBe(right.hashState());
  });

  it('keeps the socket-review targets and match active for a five-minute review session', () => {
    const simulation = new GameSimulation(1949, 'enemy-vehicle-socket-review');
    simulation.step(300);
    const events = simulation.drainEvents();

    expect(simulation.state.status).toBe('active');
    expect(simulation.state.buildings.filter((building) => building.id.endsWith('-target')))
      .toHaveLength(2);
    expect(events.filter((event) => event.type === 'destroyed')).toHaveLength(0);
  });

  it('stages six healthy combat vehicles as three static faction comparison rows', () => {
    const state = new GameSimulation(1949, 'combat-vehicle-family-review').state;
    const reviewUnits = state.units.filter((unit) => unit.id.startsWith('u-combat-vehicle-family-'));

    expect(reviewUnits).toHaveLength(6);
    expect(new Set(reviewUnits.map((unit) => `${unit.team}:${unit.kind}`))).toEqual(new Set([
      'player:scout', 'player:suppressor', 'player:artillery',
      'enemy:scout', 'enemy:suppressor', 'enemy:artillery',
    ]));
    expect(reviewUnits.every((unit) =>
      unit.hp === unit.maxHp
      && unit.rotation === 0
      && unit.order.type === 'idle'
      && unit.cooldownRemaining === 999)).toBe(true);
    expect(state.buildings.filter((building) => building.id.endsWith('-hq-anchor'))).toHaveLength(2);
    expect(state.resources).toEqual([]);
    expect(state.blockers).toEqual([expect.objectContaining({
      id: 'blocker-combat-vehicle-family-vision-divider',
      blocksMovement: false,
      blocksVision: true,
    })]);
    expect(state.beacon.position).toEqual({ x: 70, z: 70 });
    expect(state.economy.enemy.credits).toBe(0);
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('keeps all six family-review vehicles static and combat-free over thirty seconds', () => {
    const simulation = new GameSimulation(1949, 'combat-vehicle-family-review');
    const mirror = new GameSimulation(1949, 'combat-vehicle-family-review');
    const initialPositions = new Map(simulation.state.units.map((unit) => [unit.id, { ...unit.position }]));
    simulation.step(30);
    mirror.step(30);

    expect(simulation.drainEvents()).toEqual([]);
    expect(mirror.drainEvents()).toEqual([]);
    expect(simulation.state.units).toHaveLength(6);
    expect(simulation.state.units.every((unit) =>
      unit.order.type === 'idle'
      && unit.position.x === initialPositions.get(unit.id)?.x
      && unit.position.z === initialPositions.get(unit.id)?.z)).toBe(true);
    expect(simulation.state.status).toBe('active');
    expect(simulation.state.ai.enemy).toEqual({ phase: 'economy', reason: 'initializing', stateEnteredTick: 0 });
    expect(simulation.hashState()).toBe(mirror.hashState());
  });

  it('reproduces all six rigged infantry variants in one deterministic scene', () => {
    const state = createInitialGameState(1949, 'infantry-family-review');
    const expected = [
      ['player', 'rifle'],
      ['player', 'antitank'],
      ['player', 'engineer'],
      ['enemy', 'rifle'],
      ['enemy', 'antitank'],
      ['enemy', 'engineer'],
    ];
    for (const [team, kind] of expected) {
      expect(state.units.some((unit) => unit.id.startsWith('u-family-') && unit.team === team && unit.kind === kind)).toBe(true);
    }
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('provides complete mixed forces and immediate enemy pressure in skirmish', () => {
    const state = createInitialGameState(1949, 'skirmish');
    const playerForce = state.units.filter((unit) => unit.id.startsWith('u-skirmish-player-'));
    const enemyForce = state.units.filter((unit) => unit.id.startsWith('u-skirmish-enemy-'));
    expect(playerForce).toHaveLength(7);
    expect(enemyForce).toHaveLength(7);
    expect(new Set(playerForce.map((unit) => unit.kind)).size).toBe(7);
    expect(enemyForce.filter((unit) => unit.order.type === 'attack')).toHaveLength(6);
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('builds a complete campaign demo opening with production, defense and mixed forces', () => {
    const simulation = new GameSimulation(1949, 'campaign-demo');
    const state = simulation.state;
    const playerForce = state.units.filter((unit) => unit.id.startsWith('u-demo-player-'));
    const enemyForce = state.units.filter((unit) => unit.id.startsWith('u-demo-enemy-'));
    expect(playerForce).toHaveLength(7);
    expect(enemyForce).toHaveLength(7);
    expect(state.elapsed).toBe(11 * 60 + 45);
    expect(state.economy.player.credits).toBe(5200);
    for (const id of ['b-demo-player-relay', 'b-demo-player-factory', 'b-demo-player-sentry']) {
      const building = state.buildings.find((candidate) => candidate.id === id);
      expect(building?.connected, id).toBe(true);
      expect(building?.powered, id).toBe(true);
    }
    expect(assertFlatLevel(state)).toEqual([]);
  });

  it('advances the campaign demo into unlocked objective combat without scripted input', () => {
    const simulation = new GameSimulation(1949, 'campaign-demo');
    const initialEnemyHp = simulation.state.units
      .filter((unit) => unit.id.startsWith('u-demo-enemy-'))
      .reduce((sum, unit) => sum + unit.hp, 0);
    simulation.step(20);
    const currentEnemyHp = simulation.state.units
      .filter((unit) => unit.id.startsWith('u-demo-enemy-'))
      .reduce((sum, unit) => sum + unit.hp, 0);
    expect(simulation.state.beacon.unlocked).toBe(true);
    expect(currentEnemyHp).toBeLessThan(initialEnemyHp);
    expect(simulation.state.status).toBe('active');
  });

  it('builds a powered and navigable breakthrough assault scene', () => {
    const simulation = new GameSimulation(1949, 'breakthrough-demo');
    const state = simulation.state;
    const playerForce = state.units.filter((unit) => unit.id.startsWith('u-break-player-'));
    const enemyForce = state.units.filter((unit) => unit.id.startsWith('u-break-enemy-'));
    expect(playerForce).toHaveLength(5);
    expect(enemyForce).toHaveLength(5);
    expect(new Set(playerForce.map((unit) => unit.kind))).toEqual(
      new Set(['rifle', 'antitank', 'engineer', 'scout', 'tank']),
    );
    expect(enemyForce.every((unit) => unit.order.type === 'idle')).toBe(true);
    expect(playerForce.every((unit) => unit.position.x <= -29 && unit.position.z >= 15)).toBe(true);
    expect(state.economy.player.credits).toBe(6000);
    expect(state.economy.player.bandwidthUsed).toBeLessThanOrEqual(state.economy.player.bandwidthCap);
    expect(state.buildings.find((building) => building.id === 'b-enemy-hq')?.hp).toBe(3900);
    expect(state.mission).toEqual({
      kind: 'breakthrough',
      phase: 'deployment',
      phaseStartedTick: 0,
      counterattackUnitIds: [],
      reinforcementUnitIds: [],
    });
    for (const id of ['b-break-enemy-relay-front', 'b-break-enemy-sentry', 'b-break-enemy-cannon']) {
      const building = state.buildings.find((candidate) => candidate.id === id);
      expect(building?.connected, id).toBe(true);
      expect(building?.powered, id).toBe(true);
    }
    expect(assertFlatLevel(state)).toEqual([]);

    const guardOpening = new Map(enemyForce.map((unit) => [unit.id, { ...unit.position }]));
    simulation.step(60);
    expect(simulation.state.mission.phase).toBe('deployment');
    for (const [id, position] of guardOpening) {
      const guard = simulation.state.units.find((unit) => unit.id === id);
      expect(guard?.position, id).toEqual(position);
      expect(guard?.order.type, id).toBe('idle');
    }
    expect(simulation.drainEvents().some((event) => event.type === 'destroyed')).toBe(false);
  });

  it('advances the breakthrough mission through a committed counterattack and reinforcement wave', () => {
    const simulation = new GameSimulation(1949, 'breakthrough-demo');
    simulation.step(7);
    expect(simulation.state.mission.phase).toBe('deployment');
    expect(simulation.state.notifications.some((notification) => notification.text.includes('完成一次辉晶卸矿'))).toBe(true);

    expect(simulation.issue({
      type: 'build',
      kind: 'sentry',
      position: { x: -18, z: 20 },
      rotation: 0,
    }).ok).toBe(true);
    expect(simulation.issue({
      type: 'produce',
      buildingId: 'b-break-player-factory',
      unitKind: 'tank',
    }).ok).toBe(true);

    simulation.step(35);
    expect(simulation.state.mission.phase).toBe('frontline');
    expect(simulation.state.buildings.some((building) => (
      building.team === 'player' && building.kind === 'sentry' && building.buildProgress >= 1
    ))).toBe(true);
    expect(simulation.state.units.some((unit) => /^u-player-tank-\d{6}$/u.test(unit.id))).toBe(true);

    for (const id of ['b-break-enemy-sentry', 'b-break-enemy-cannon']) {
      const building = simulation.state.buildings.find((candidate) => candidate.id === id);
      if (building) building.hp = 0;
    }
    simulation.step(178);
    expect(simulation.state.mission.phase).toBe('frontline');
    simulation.step(2);
    expect(simulation.state.mission.phase).toBe('counterattack');
    expect(simulation.state.mission.counterattackUnitIds).toHaveLength(3);
    for (const id of simulation.state.mission.counterattackUnitIds) {
      const unit = simulation.state.units.find((candidate) => candidate.id === id);
      expect(unit?.team, id).toBe('enemy');
      expect(unit?.order.type, id).toBe('attackMove');
      if (unit) unit.hp = 0;
    }
    simulation.step(148);
    expect(simulation.state.mission.phase).toBe('counterattack');
    simulation.step(2);
    expect(simulation.state.mission.phase).toBe('reinforcement');
    expect(simulation.state.beacon.unlocked).toBe(true);
    expect(simulation.state.mission.reinforcementUnitIds).toHaveLength(5);
    for (const id of simulation.state.mission.reinforcementUnitIds) {
      const unit = simulation.state.units.find((candidate) => candidate.id === id);
      expect(unit?.team, id).toBe('player');
      expect(unit?.order.type, id).toBe('attackMove');
    }

    simulation.step(148);
    expect(simulation.state.mission.phase).toBe('reinforcement');
    simulation.step(2);
    expect(simulation.state.mission.phase).toBe('command');
    expect(assertFlatLevel(simulation.state)).toEqual([]);
  }, 20_000);

  it('provides deterministic breakthrough result routes for browser victory and defeat QA', () => {
    const cases = [
      ['breakthrough-demo-victory-review', 'victory', '敌方指挥核心被摧毁'],
      ['breakthrough-demo-defeat-review', 'defeat', '指挥核心被摧毁'],
    ] as const;

    for (const [fixture, expectedStatus, reason] of cases) {
      const simulation = new GameSimulation(1949, fixture);
      expect(simulation.state.mission).toMatchObject({ kind: 'breakthrough', phase: 'command' });
      for (let tick = 0; tick < 240 && simulation.state.status === 'active'; tick += 1) {
        simulation.step(GAME_TICK_SECONDS);
      }
      expect(simulation.state.status).toBe(expectedStatus);
      expect(simulation.state.statusReason).toBe(reason);
      expect(simulation.state.mission.phase).toBe('complete');
    }
  });

  it('runs the golden breakthrough from real preparation milestones to a deterministic natural victory', () => {
    const simulation = new GameSimulation(1949, 'breakthrough-demo');
    const mirror = new GameSimulation(1949, 'breakthrough-demo');
    const prepare = (candidate: GameSimulation): void => {
      expect(candidate.issue({
        type: 'build',
        kind: 'sentry',
        position: { x: -18, z: 20 },
        rotation: 0,
      }).ok).toBe(true);
      for (const unitKind of ['artillery', 'tank', 'tank', 'artillery'] as const) {
        expect(candidate.issue({
          type: 'produce',
          buildingId: 'b-break-player-factory',
          unitKind,
        }).ok, unitKind).toBe(true);
      }
      expect(candidate.issue({
        type: 'setRally',
        buildingId: 'b-break-player-factory',
        target: { x: -8, z: -6 },
      }).ok).toBe(true);
    };
    const combatIds = (candidate: GameSimulation): string[] => candidate.state.units
      .filter((unit) => unit.team === 'player' && unit.kind !== 'harvester' && unit.kind !== 'engineer')
      .map((unit) => unit.id);
    const issueAttackMove = (candidate: GameSimulation, target: { x: number; z: number }): void => {
      expect(candidate.issue({ type: 'attackMove', unitIds: combatIds(candidate), target }).ok).toBe(true);
    };

    prepare(simulation);
    prepare(mirror);
    expect(simulation.hashState()).toBe(mirror.hashState());
    for (let seconds = 0; seconds < 70 && simulation.state.mission.phase === 'deployment'; seconds += 1) {
      simulation.step(1);
      mirror.step(1);
    }
    expect(simulation.state.mission.phase).toBe('frontline');
    expect(mirror.state.mission.phase).toBe('frontline');
    expect(simulation.state.elapsed).toBeGreaterThanOrEqual(40);
    expect(simulation.state.elapsed).toBeLessThanOrEqual(60);
    expect(simulation.hashState()).toBe(mirror.hashState());

    issueAttackMove(simulation, { x: 18, z: -24 });
    issueAttackMove(mirror, { x: 18, z: -24 });
    for (let seconds = 0; seconds < 290 && simulation.state.mission.phase === 'frontline'; seconds += 1) {
      simulation.step(1);
      mirror.step(1);
    }
    expect(simulation.state.mission.phase).toBe('counterattack');
    expect(mirror.state.mission.phase).toBe('counterattack');
    expect(simulation.hashState()).toBe(mirror.hashState());
    expect(simulation.state.units.filter((unit) => (
      unit.team === 'player'
      && unit.kind !== 'harvester'
      && unit.kind !== 'engineer'
      && unit.position.x > -12
      && unit.position.z < 0
    )).length).toBeGreaterThanOrEqual(3);

    issueAttackMove(simulation, { x: 22, z: -28 });
    for (let seconds = 0; seconds < 240 && simulation.state.mission.phase === 'counterattack'; seconds += 1) {
      simulation.step(1);
    }
    expect(simulation.state.mission.phase).toBe('reinforcement');
    expect(simulation.state.beacon.unlocked).toBe(true);
    expect(simulation.state.mission.reinforcementUnitIds).toHaveLength(5);

    issueAttackMove(simulation, { x: 26, z: -30 });
    for (let seconds = 0; seconds < 170 && simulation.state.mission.phase === 'reinforcement'; seconds += 1) {
      simulation.step(1);
    }
    expect(simulation.state.mission.phase).toBe('command');

    const finalLanding = { x: 42, z: -39 };
    issueAttackMove(simulation, finalLanding);
    for (let seconds = 0; seconds < 200 && simulation.state.status === 'active'; seconds += 1) {
      simulation.step(1);
    }
    expect(
      simulation.state.status,
      `terminal=${simulation.state.status} reason=${simulation.state.statusReason} elapsed=${simulation.state.elapsed.toFixed(2)} enemyHq=${simulation.state.buildings.find((building) => building.id === 'b-enemy-hq')?.hp ?? 0} playerCombat=${combatIds(simulation).length}`,
    ).toBe('victory');
    expect(simulation.state.statusReason).toBe('敌方指挥核心被摧毁');
    expect(simulation.state.mission.phase).toBe('complete');
    expect(simulation.state.elapsed).toBeGreaterThanOrEqual(8 * 60);
    expect(simulation.state.elapsed).toBeLessThanOrEqual(12 * 60);
    expect(simulation.state.units.some((unit) => (
      unit.team === 'player'
      && unit.kind !== 'harvester'
      && unit.position.x >= finalLanding.x - 12
      && unit.position.z <= finalLanding.z + 12
    ))).toBe(true);
    expect(assertFlatLevel(simulation.state)).toEqual([]);
  }, 30_000);

  it('turns the final enemy assault into a natural defeat when the player abandons the front', () => {
    const simulation = new GameSimulation(1949, 'breakthrough-demo');
    expect(simulation.issue({
      type: 'build',
      kind: 'sentry',
      position: { x: -18, z: 20 },
      rotation: 0,
    }).ok).toBe(true);
    expect(simulation.issue({
      type: 'produce',
      buildingId: 'b-break-player-factory',
      unitKind: 'scout',
    }).ok).toBe(true);

    for (let seconds = 0; seconds < 20 * 60 && simulation.state.status === 'active'; seconds += 1) {
      simulation.step(1);
    }

    expect(simulation.state.status).toBe('defeat');
    expect(simulation.state.statusReason).toBe('指挥核心被摧毁');
    expect(simulation.state.elapsed).toBeGreaterThanOrEqual(12 * 60);
    expect(simulation.state.elapsed).toBeLessThanOrEqual(17 * 60);
    expect(simulation.state.mission.phase).toBe('complete');
    expect(simulation.state.buildings.filter((building) => (
      building.team === 'enemy' && building.kind === 'relay' && building.hp > 0
    ))).toHaveLength(2);
  }, 30_000);

  it('keeps every breakthrough difficulty flat, mirrored, and ordered by authored durability', () => {
    const fixtures = [
      'breakthrough-demo-cadet',
      'breakthrough-demo',
      'breakthrough-demo-veteran',
    ] as const;
    const playerTankHp: number[] = [];
    const enemyTankHp: number[] = [];
    const enemyHqHp: number[] = [];

    for (const fixture of fixtures) {
      const left = new GameSimulation(1949, fixture);
      const right = new GameSimulation(1949, fixture);
      expect(assertFlatLevel(left.state), fixture).toEqual([]);
      expect(left.hashState(), fixture).toBe(right.hashState());
      expect(left.issue({
        type: 'build', kind: 'sentry', position: { x: -18, z: 20 }, rotation: 0,
      }).ok).toBe(true);
      expect(right.issue({
        type: 'build', kind: 'sentry', position: { x: -18, z: 20 }, rotation: 0,
      }).ok).toBe(true);
      expect(left.issue({
        type: 'produce', buildingId: 'b-break-player-factory', unitKind: 'scout',
      }).ok).toBe(true);
      expect(right.issue({
        type: 'produce', buildingId: 'b-break-player-factory', unitKind: 'scout',
      }).ok).toBe(true);
      left.step(45);
      right.step(45);
      expect(left.hashState(), `${fixture} progressed hash`).toBe(right.hashState());
      expect(assertFlatLevel(left.state), `${fixture} progressed plane`).toEqual([]);

      playerTankHp.push(left.state.units.find((unit) => unit.id === 'u-break-player-tank')?.maxHp ?? 0);
      enemyTankHp.push(left.state.units.find((unit) => unit.id === 'u-break-enemy-tank')?.maxHp ?? 0);
      enemyHqHp.push(left.state.buildings.find((building) => building.id === 'b-enemy-hq')?.hp ?? 0);
    }

    expect(playerTankHp[0]).toBeGreaterThan(playerTankHp[1] ?? 0);
    expect(playerTankHp[1]).toBeGreaterThan(playerTankHp[2] ?? 0);
    expect(enemyTankHp[0]).toBeLessThan(enemyTankHp[1] ?? 0);
    expect(enemyTankHp[1]).toBeLessThan(enemyTankHp[2] ?? 0);
    expect(enemyHqHp[0]).toBeLessThan(enemyHqHp[1] ?? 0);
    expect(enemyHqHp[1]).toBeLessThan(enemyHqHp[2] ?? 0);
  }, 20_000);

  it('lets the cadet golden route finish naturally inside the eight-to-twelve-minute contract', () => {
    const simulation = new GameSimulation(1949, 'breakthrough-demo-cadet');
    const mirror = new GameSimulation(1949, 'breakthrough-demo-cadet');
    const prepare = (candidate: GameSimulation): void => {
      expect(candidate.issue({
        type: 'build', kind: 'sentry', position: { x: -18, z: 20 }, rotation: 0,
      }).ok).toBe(true);
      for (const unitKind of ['artillery', 'tank', 'tank', 'artillery'] as const) {
        expect(candidate.issue({
          type: 'produce', buildingId: 'b-break-player-factory', unitKind,
        }).ok).toBe(true);
      }
      expect(candidate.issue({
        type: 'setRally', buildingId: 'b-break-player-factory', target: { x: -8, z: -6 },
      }).ok).toBe(true);
    };
    const combatIds = (candidate: GameSimulation): string[] => candidate.state.units
      .filter((unit) => unit.team === 'player' && unit.kind !== 'harvester' && unit.kind !== 'engineer')
      .map((unit) => unit.id);
    const attackMove = (candidate: GameSimulation, x: number, z: number): void => {
      expect(candidate.issue({ type: 'attackMove', unitIds: combatIds(candidate), target: { x, z } }).ok).toBe(true);
    };

    prepare(simulation);
    prepare(mirror);
    for (let seconds = 0; seconds < 70 && simulation.state.mission.phase === 'deployment'; seconds += 1) {
      simulation.step(1);
      mirror.step(1);
    }
    expect(simulation.hashState()).toBe(mirror.hashState());
    attackMove(simulation, 18, -24);
    for (let seconds = 0; seconds < 290 && simulation.state.mission.phase === 'frontline'; seconds += 1) {
      simulation.step(1);
    }
    expect(simulation.state.mission.phase).toBe('counterattack');
    attackMove(simulation, 22, -28);
    for (let seconds = 0; seconds < 240 && simulation.state.mission.phase === 'counterattack'; seconds += 1) {
      simulation.step(1);
    }
    expect(simulation.state.mission.phase).toBe('reinforcement');
    expect(simulation.state.mission.reinforcementUnitIds).toHaveLength(6);
    attackMove(simulation, 26, -30);
    for (let seconds = 0; seconds < 170 && simulation.state.mission.phase === 'reinforcement'; seconds += 1) {
      simulation.step(1);
    }
    expect(simulation.state.mission.phase).toBe('command');
    attackMove(simulation, 42, -39);
    for (let seconds = 0; seconds < 220 && simulation.state.status === 'active'; seconds += 1) {
      simulation.step(1);
    }

    expect(simulation.state.status).toBe('victory');
    expect(simulation.state.elapsed).toBeGreaterThanOrEqual(8 * 60);
    expect(simulation.state.elapsed).toBeLessThanOrEqual(12 * 60);
    expect(assertFlatLevel(simulation.state)).toEqual([]);
  }, 30_000);

  it('starts veteran pressure earlier without damaging the player during deployment', () => {
    const guarded = new GameSimulation(1949, 'breakthrough-demo-veteran');
    const openingHp = guarded.state.units
      .filter((unit) => unit.team === 'player')
      .reduce((total, unit) => total + unit.hp, 0);
    guarded.step(120);
    expect(guarded.state.mission.phase).toBe('deployment');
    expect(guarded.state.units.filter((unit) => unit.team === 'player').reduce(
      (total, unit) => total + unit.hp,
      0,
    )).toBe(openingHp);
    expect(guarded.drainEvents().some((event) => event.type === 'destroyed')).toBe(false);

    const simulation = new GameSimulation(1949, 'breakthrough-demo-veteran');
    expect(simulation.issue({
      type: 'build', kind: 'sentry', position: { x: -18, z: 20 }, rotation: 0,
    }).ok).toBe(true);
    expect(simulation.issue({
      type: 'produce', buildingId: 'b-break-player-factory', unitKind: 'scout',
    }).ok).toBe(true);
    for (let seconds = 0; seconds < 16 * 60 && simulation.state.status === 'active'; seconds += 1) {
      simulation.step(1);
    }
    expect(simulation.state.status).toBe('defeat');
    expect(simulation.state.elapsed).toBeGreaterThanOrEqual(9 * 60);
    expect(simulation.state.elapsed).toBeLessThan(14 * 60);
    expect(simulation.state.mission.phase).toBe('complete');
  }, 30_000);
});

describe('单位内容契约', () => {
  it('所有可战斗单位都有可执行的移动和视野参数', () => {
    for (const [kind, definition] of Object.entries(UNIT_DEFS)) {
      expect(definition.speed, `${kind} speed`).toBeGreaterThan(0);
      expect(definition.sight, `${kind} sight`).toBeGreaterThan(0);
      expect(definition.maxHp, `${kind} hp`).toBeGreaterThan(0);
      expect(definition.radius, `${kind} radius`).toBeGreaterThan(0);
    }
  });
});

describe('dynamic presentation fixture', () => {
  it('keeps cargo and production populated long enough for truthful review', () => {
    const state = createInitialGameState(1949, 'dynamic-review');
    const harvester = state.units.find((unit) => unit.id === 'u-player-harvester');
    const barracks = state.buildings.find((building) => building.id === 'b-player-barracks');
    const factory = state.buildings.find((building) => building.id === 'b-review-factory');
    expect(harvester?.cargo).toBe(250);
    expect(harvester?.cargoCapacity).toBe(500);
    expect(barracks?.queue).toHaveLength(3);
    expect(factory?.queue).toHaveLength(3);
    expect(assertFlatLevel(state)).toEqual([]);
  });
});
