import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS, GAME_TICK_SECONDS, UNIT_DEFS } from './config';
import { GameSimulation } from './simulation';
import { createTechnologyTeamState, TECHNOLOGY_DEFS } from './technology';
import { VisibilityGrid } from './visibility';

const stepTicks = (simulation: GameSimulation, ticks: number): void => {
  for (let index = 0; index < ticks; index += 1) simulation.step(GAME_TICK_SECONDS);
};

describe('GameSimulation 确定性与命令', () => {
  it('相同种子和命令产生相同状态哈希', () => {
    const left = new GameSimulation(1949);
    const right = new GameSimulation(1949);
    const command = { type: 'move' as const, unitIds: ['u-player-scout'], target: { x: -18, z: 20 } };
    expect(left.issue(command).ok).toBe(true);
    expect(right.issue(command).ok).toBe(true);
    stepTicks(left, 500);
    stepTicks(right, 500);
    expect(left.hashState()).toBe(right.hashState());
  });

  it('includes cargo capacity in deterministic state hashes', () => {
    const left = new GameSimulation(1950);
    const right = new GameSimulation(1950);
    const rightHarvester = right.state.units.find((unit) => unit.id === 'u-player-harvester');
    expect(rightHarvester).toBeDefined();
    if (!rightHarvester) return;
    rightHarvester.cargoCapacity += 1;
    expect(left.hashState()).not.toBe(right.hashState());
  });

  it('移动命令让单位抵达目标附近', () => {
    const simulation = new GameSimulation(77);
    const target = { x: -18, z: 20 };
    expect(simulation.issue({ type: 'move', unitIds: ['u-player-scout'], target }).ok).toBe(true);
    stepTicks(simulation, 400);
    const scout = simulation.state.units.find((unit) => unit.id === 'u-player-scout');
    expect(scout).toBeDefined();
    expect(Math.hypot((scout?.position.x ?? 0) - target.x, (scout?.position.z ?? 0) - target.z)).toBeLessThanOrEqual(0.3);
  });

  it('移动命令使用 A* 绕过阻挡直线的岩体', () => {
    const simulation = new GameSimulation(78);
    const scout = simulation.state.units.find((unit) => unit.id === 'u-player-scout');
    expect(scout).toBeDefined();
    if (!scout) return;
    scout.position = { x: -12, z: 0 };
    simulation.state.blockers = [{
      id: 'test-rock', position: { x: 0, z: 0 }, radius: 6,
      blocksMovement: true, blocksVision: false,
    }];
    const target = { x: 12, z: 0 };
    expect(simulation.issue({ type: 'move', unitIds: [scout.id], target }).ok).toBe(true);
    expect(scout.order.waypoints?.some((point) => Math.abs(point.z) > 6)).toBe(true);
    stepTicks(simulation, 220);
    expect(Math.hypot(scout.position.x - target.x, scout.position.z - target.z)).toBeLessThan(1.2);
  });

  it('多单位移动为每个单位分配稳定且分离的编队槽位', () => {
    const left = new GameSimulation(79);
    const right = new GameSimulation(79);
    const unitIds = ['u-player-scout', 'u-player-rifle-1', 'u-player-rifle-2'];
    const command = { type: 'move' as const, unitIds, target: { x: -10, z: 18 } };
    expect(left.issue(command).ok).toBe(true);
    expect(right.issue(command).ok).toBe(true);
    const leftTargets = unitIds.map((id) => left.state.units.find((unit) => unit.id === id)?.order.target);
    const rightTargets = unitIds.map((id) => right.state.units.find((unit) => unit.id === id)?.order.target);
    expect(leftTargets).toEqual(rightTargets);
    expect(new Set(leftTargets.map((target) => `${target?.x.toFixed(3)},${target?.z.toFixed(3)}`)).size).toBe(3);
    for (let index = 0; index < leftTargets.length; index += 1) {
      for (let other = index + 1; other < leftTargets.length; other += 1) {
        const first = leftTargets[index];
        const second = leftTargets[other];
        expect(first && second ? Math.hypot(first.x - second.x, first.z - second.z) : 0).toBeGreaterThan(2.5);
      }
    }
    stepTicks(left, 800);
    for (let index = 0; index < unitIds.length; index += 1) {
      const unit = left.state.units.find((candidate) => candidate.id === unitIds[index]);
      const target = leftTargets[index];
      expect(unit?.order.type, unitIds[index]).toBe('idle');
      expect(unit && target ? Math.hypot(unit.position.x - target.x, unit.position.z - target.z) : Number.POSITIVE_INFINITY)
        .toBeLessThanOrEqual(0.3);
    }
  });

  it('采集车完成采集和回炼后增加辉晶', () => {
    const simulation = new GameSimulation(88);
    const before = simulation.state.economy.player.credits;
    expect(simulation.issue({
      type: 'gather', unitIds: ['u-player-harvester'], resourceId: 'r-player-main',
    }).ok).toBe(true);
    stepTicks(simulation, 900);
    expect(simulation.state.economy.player.credits).toBeGreaterThan(before);
    expect(simulation.state.resources.find((item) => item.id === 'r-player-main')?.amount).toBeLessThan(18000);
  });

  it('合法建筑放置扣费并生成施工状态', () => {
    const simulation = new GameSimulation(99);
    const position = { x: -67, z: 58 };
    expect(simulation.validateBuild('reactor', position, 0).valid).toBe(true);
    const before = simulation.state.economy.player.credits;
    expect(simulation.issue({ type: 'build', kind: 'reactor', position, rotation: 0 }).ok).toBe(true);
    expect(simulation.state.economy.player.credits).toBe(before - 600);
    expect(simulation.state.buildings.some((building) => building.team === 'player' && building.kind === 'reactor' && building.buildProgress < 1)).toBe(true);
  });

  it('兵营队列完成后生成新单位', () => {
    const simulation = new GameSimulation(101);
    const before = simulation.state.units.filter((unit) => unit.team === 'player' && unit.kind === 'rifle').length;
    expect(simulation.issue({ type: 'produce', buildingId: 'b-player-barracks', unitKind: 'rifle' }).ok).toBe(true);
    stepTicks(simulation, 300);
    const after = simulation.state.units.filter((unit) => unit.team === 'player' && unit.kind === 'rifle').length;
    expect(after).toBe(before + 1);
  });

  it('快速交战夹具可以造成可观察伤害', () => {
    const simulation = new GameSimulation(303, 'combat');
    const targetBefore = simulation.state.units.find((unit) => unit.id === 'u-fixture-enemy')?.hp ?? 0;
    expect(simulation.issue({
      type: 'attack', unitIds: ['u-fixture-player'], targetId: 'u-fixture-enemy',
    }).ok).toBe(true);
    stepTicks(simulation, 200);
    const targetAfter = simulation.state.units.find((unit) => unit.id === 'u-fixture-enemy')?.hp ?? 0;
    expect(targetAfter).toBeLessThan(targetBefore);
  });

  it('emits one high-priority player alert when a friendly unit is hit', () => {
    const simulation = new GameSimulation(304, 'combat');
    const player = simulation.state.units.find((unit) => unit.id === 'u-fixture-player');
    const enemy = simulation.state.units.find((unit) => unit.id === 'u-fixture-enemy');
    expect(player).toBeDefined();
    expect(enemy).toBeDefined();
    if (!player || !enemy) return;

    player.position = { x: 0, z: 13.5 };
    enemy.position = { x: 0, z: 0 };
    enemy.kind = 'artillery';
    enemy.radius = UNIT_DEFS.artillery.radius;
    enemy.maxHp = UNIT_DEFS.artillery.maxHp;
    enemy.hp = enemy.maxHp;
    enemy.order = { type: 'attack', targetId: player.id };

    stepTicks(simulation, 18);
    const alerts = simulation.drainEvents().filter((event) => event.type === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ team: 'player', targetId: player.id, at: player.position });
    expect(alerts[0]?.sourceId).toBeUndefined();
    expect(simulation.state.notifications.some((notification) => (
      notification.text === '我方部队遭到攻击'
      && notification.at?.x === player.position.x
      && notification.at?.z === player.position.z
    ))).toBe(true);
  });

  it('rate-limits repeated attacks on the same friendly alert category', () => {
    const simulation = new GameSimulation(306, 'combat');
    const harvester = simulation.state.units.find((unit) => unit.id === 'u-fixture-player');
    const suppressor = simulation.state.units.find((unit) => unit.id === 'u-fixture-enemy');
    expect(harvester).toBeDefined();
    expect(suppressor).toBeDefined();
    if (!harvester || !suppressor) return;

    harvester.position = { x: 0, z: 4 };
    harvester.kind = 'harvester';
    harvester.radius = UNIT_DEFS.harvester.radius;
    harvester.maxHp = 5_000;
    harvester.hp = harvester.maxHp;
    harvester.order = { type: 'idle' };
    suppressor.position = { x: 0, z: 0 };
    suppressor.kind = 'suppressor';
    suppressor.radius = UNIT_DEFS.suppressor.radius;
    suppressor.order = { type: 'attack', targetId: harvester.id };

    stepTicks(simulation, 60);
    const alerts = simulation.drainEvents().filter((event) => event.type === 'alert');
    expect(alerts).toHaveLength(1);
    expect(simulation.state.notifications.filter((notification) => notification.text === '采矿车遭到袭击')).toHaveLength(1);
  });

  it('sends nearby idle defenders to investigate an unseen artillery firing position', () => {
    const configure = (simulation: GameSimulation): void => {
      const artillery = simulation.state.units.find((unit) => unit.id === 'u-fixture-player');
      const defender = simulation.state.units.find((unit) => unit.id === 'u-fixture-enemy');
      const factory = simulation.state.buildings.find((building) => building.id === 'b-enemy-barracks');
      expect(artillery).toBeDefined();
      expect(defender).toBeDefined();
      expect(factory).toBeDefined();
      if (!artillery || !defender || !factory) return;
      artillery.position = { x: 0, z: 0 };
      artillery.kind = 'artillery';
      artillery.radius = UNIT_DEFS.artillery.radius;
      artillery.maxHp = UNIT_DEFS.artillery.maxHp;
      artillery.hp = artillery.maxHp;
      artillery.order = { type: 'attack', targetId: factory.id };
      factory.position = { x: 0, z: 16 };
      defender.position = { x: 0, z: 15 };
      defender.order = { type: 'idle' };
    };
    const left = new GameSimulation(305, 'combat');
    const right = new GameSimulation(305, 'combat');
    configure(left);
    configure(right);

    stepTicks(left, 1);
    stepTicks(right, 1);
    expect(left.state.intel.enemy.visibleEnemyIds).not.toContain('u-fixture-player');
    stepTicks(left, 15);
    stepTicks(right, 15);

    const defender = left.state.units.find((unit) => unit.id === 'u-fixture-enemy');
    const factory = left.state.buildings.find((building) => building.id === 'b-enemy-barracks');
    expect(factory?.hp).toBeLessThan(factory?.maxHp ?? 0);
    expect(defender?.order.type).toBe('attackMove');
    expect(defender?.order.target).toEqual({ x: 0, z: 0 });
    expect(left.state.intel.enemy.visibleEnemyIds).not.toContain('u-fixture-player');
    expect(left.hashState()).toBe(right.hashState());

    const leftArtillery = left.state.units.find((unit) => unit.id === 'u-fixture-player');
    const rightArtillery = right.state.units.find((unit) => unit.id === 'u-fixture-player');
    if (leftArtillery) leftArtillery.hp = 0;
    if (rightArtillery) rightArtillery.hp = 0;
    stepTicks(left, 280);
    stepTicks(right, 280);
    const returnedDefender = left.state.units.find((unit) => unit.id === 'u-fixture-enemy');
    expect(returnedDefender ? Math.hypot(returnedDefender.position.x, returnedDefender.position.z - 15) : Infinity)
      .toBeLessThan(2);
    expect(left.hashState()).toBe(right.hashState());
  });

  it('responds to facility damage during breakthrough deployment', () => {
    const simulation = new GameSimulation(307, 'combat');
    const artillery = simulation.state.units.find((unit) => unit.id === 'u-fixture-player');
    const defender = simulation.state.units.find((unit) => unit.id === 'u-fixture-enemy');
    const factory = simulation.state.buildings.find((building) => building.id === 'b-enemy-barracks');
    expect(artillery).toBeDefined();
    expect(defender).toBeDefined();
    expect(factory).toBeDefined();
    if (!artillery || !defender || !factory) return;

    simulation.state.mission.kind = 'breakthrough';
    simulation.state.mission.phase = 'deployment';
    simulation.state.mission.phaseStartedTick = 0;
    artillery.position = { x: 0, z: 0 };
    artillery.kind = 'artillery';
    artillery.radius = UNIT_DEFS.artillery.radius;
    artillery.maxHp = UNIT_DEFS.artillery.maxHp;
    artillery.hp = artillery.maxHp;
    artillery.order = { type: 'attack', targetId: factory.id };
    factory.position = { x: 0, z: 16 };
    defender.position = { x: 0, z: 15 };
    defender.order = { type: 'idle' };

    stepTicks(simulation, 18);

    expect(factory.hp).toBeLessThan(factory.maxHp);
    expect(defender.order.type).toBe('attackMove');
    expect(defender.order.target).toEqual({ x: 0, z: 0 });
  });

  it('mobilizes local guards when another enemy observer can already see the attacker', () => {
    const simulation = new GameSimulation(308, 'combat');
    const artillery = simulation.state.units.find((unit) => unit.id === 'u-fixture-player');
    const defender = simulation.state.units.find((unit) => unit.id === 'u-fixture-enemy');
    const factory = simulation.state.buildings.find((building) => building.id === 'b-enemy-barracks');
    expect(artillery).toBeDefined();
    expect(defender).toBeDefined();
    expect(factory).toBeDefined();
    if (!artillery || !defender || !factory) return;

    artillery.position = { x: 0, z: 0 };
    artillery.kind = 'artillery';
    artillery.radius = UNIT_DEFS.artillery.radius;
    artillery.maxHp = UNIT_DEFS.artillery.maxHp;
    artillery.hp = artillery.maxHp;
    artillery.order = { type: 'attack', targetId: factory.id };
    factory.position = { x: 0, z: 16 };
    defender.position = { x: 0, z: 2 };
    defender.order = { type: 'idle' };

    stepTicks(simulation, 18);

    expect(simulation.state.intel.enemy.visibleEnemyIds).toContain(artillery.id);
    expect(factory.hp).toBeLessThan(factory.maxHp);
    expect(defender.order.type).toBe('attackMove');
    expect(defender.order.target).toEqual({ x: 0, z: 0 });
  });

  it('destroys the four ruin-review buildings through deterministic disclosed simulation combat', () => {
    const fixtures = ['building-ruin-review', 'building-ruin-review-reduced'];
    const expectedTargets = [
      'b-ruin-enemy-factory',
      'b-ruin-enemy-hq',
      'b-ruin-player-factory',
      'b-ruin-player-hq',
    ];

    for (const fixture of fixtures) {
      const left = new GameSimulation(1949, fixture);
      const right = new GameSimulation(1949, fixture);

      left.step(GAME_TICK_SECONDS);
      right.step(GAME_TICK_SECONDS);
      expect(left.state.intel.player.visibleEnemyIds).toEqual(expect.arrayContaining([
        'b-ruin-enemy-hq',
        'b-ruin-enemy-factory',
      ]));
      expect(left.state.ai.enemy).toEqual({ phase: 'economy', reason: 'initializing', stateEnteredTick: 0 });

      left.step(4.2);
      right.step(4.2);
      expect(left.drainEvents().filter((event) => event.type === 'destroyed')).toHaveLength(0);
      expect(right.drainEvents().filter((event) => event.type === 'destroyed')).toHaveLength(0);
      expect(left.state.buildings.filter((building) => expectedTargets.includes(building.id))).toHaveLength(4);

      left.step(0.5);
      right.step(0.5);
      const leftDestroyed = left.drainEvents()
        .filter((event) => event.type === 'destroyed')
        .map((event) => event.targetId)
        .sort();
      const rightDestroyed = right.drainEvents()
        .filter((event) => event.type === 'destroyed')
        .map((event) => event.targetId)
        .sort();
      expect(leftDestroyed).toEqual(expectedTargets);
      expect(rightDestroyed).toEqual(expectedTargets);
      expect(left.state.buildings.filter((building) => expectedTargets.includes(building.id))).toHaveLength(0);
      expect(left.state.status).toBe('active');
      expect(left.state.ai.enemy).toEqual({ phase: 'economy', reason: 'initializing', stateEnteredTick: 0 });
      expect(left.hashState()).toBe(right.hashState());
    }
  });

  it('emits six deterministic residue-review destructions around 4.5 seconds and stays active', () => {
    const fixtures = ['destruction-residue-review', 'destruction-residue-review-reduced'];
    const expectedTargets = [
      'u-residue-target-antitank',
      'u-residue-target-artillery',
      'u-residue-target-engineer',
      'u-residue-target-rifle',
      'u-residue-target-scout',
      'u-residue-target-suppressor',
    ];
    const finalHashes: string[] = [];

    for (const fixture of fixtures) {
      const left = new GameSimulation(1949, fixture);
      const right = new GameSimulation(1949, fixture);
      expect(left.state.intel.player.visibleEnemyIds.filter((id) => id.startsWith('u-residue-attacker-')))
        .toEqual([]);
      left.step(4.3);
      right.step(4.3);
      expect(left.drainEvents().filter((event) => event.type === 'destroyed')).toHaveLength(0);
      expect(right.drainEvents().filter((event) => event.type === 'destroyed')).toHaveLength(0);
      expect(left.state.units.filter((unit) => expectedTargets.includes(unit.id))).toHaveLength(6);

      left.step(0.4);
      right.step(0.4);
      const leftDestroyed = left.drainEvents()
        .filter((event) => event.type === 'destroyed')
        .map((event) => event.targetId)
        .sort();
      const rightDestroyed = right.drainEvents()
        .filter((event) => event.type === 'destroyed')
        .map((event) => event.targetId)
        .sort();
      expect(leftDestroyed).toEqual(expectedTargets);
      expect(rightDestroyed).toEqual(expectedTargets);
      expect(left.state.units.filter((unit) => expectedTargets.includes(unit.id))).toHaveLength(0);
      expect(left.state.units.filter((unit) => unit.id.startsWith('u-residue-attacker-'))).toHaveLength(6);
      expect(left.state.status).toBe('active');
      expect(left.state.ai.enemy).toEqual({ phase: 'economy', reason: 'initializing', stateEnteredTick: 0 });
      expect(left.hashState()).toBe(right.hashState());
      finalHashes.push(left.hashState());
    }
    expect(finalHashes[0]).toBe(finalHashes[1]);
  });

  it('工兵维修受损友军时消耗辉晶并恢复生命', () => {
    const simulation = new GameSimulation(404);
    const engineer = simulation.state.units.find((unit) => unit.id === 'u-player-engineer');
    const hq = simulation.state.buildings.find((building) => building.id === 'b-player-hq');
    expect(engineer).toBeDefined();
    expect(hq).toBeDefined();
    if (!engineer || !hq) return;
    engineer.position = { x: -43.5, z: 46 };
    hq.hp -= 120;
    const hpBefore = hq.hp;
    const creditsBefore = simulation.state.economy.player.credits;
    expect(simulation.issue({
      type: 'repair', unitIds: [engineer.id], targetId: hq.id,
    }).ok).toBe(true);
    stepTicks(simulation, 80);
    expect(hq.hp).toBeGreaterThan(hpBefore);
    expect(hq.hp).toBe(hq.maxHp);
    expect(simulation.state.economy.player.credits).toBeLessThan(creditsBefore);
  });

  it('炮兵命中对范围内敌军造成衰减伤害且不误伤友军', () => {
    const simulation = new GameSimulation(505);
    const artillery = simulation.state.units.find((unit) => unit.id === 'u-player-tank');
    const primary = simulation.state.units.find((unit) => unit.id === 'u-enemy-rifle-1');
    const nearby = simulation.state.units.find((unit) => unit.id === 'u-enemy-rifle-2');
    const far = simulation.state.units.find((unit) => unit.id === 'u-enemy-antitank');
    const friendly = simulation.state.units.find((unit) => unit.id === 'u-player-rifle-1');
    expect(artillery && primary && nearby && far && friendly).toBeTruthy();
    if (!artillery || !primary || !nearby || !far || !friendly) return;

    artillery.kind = 'artillery';
    artillery.position = { x: 0, z: 0 };
    artillery.radius = UNIT_DEFS.artillery.radius;
    primary.kind = 'engineer';
    primary.position = { x: 8, z: 0 };
    nearby.kind = 'engineer';
    nearby.position = { x: 10.5, z: 0 };
    far.kind = 'engineer';
    far.position = { x: 14, z: 0 };
    friendly.kind = 'engineer';
    friendly.position = { x: 9, z: 0 };
    simulation.state.units = [artillery, primary, nearby, far, friendly];
    simulation.state.blockers = [];
    stepTicks(simulation, 1);

    const primaryBefore = primary.hp;
    const nearbyBefore = nearby.hp;
    const farBefore = far.hp;
    const friendlyBefore = friendly.hp;
    expect(simulation.issue({ type: 'attack', unitIds: [artillery.id], targetId: primary.id }).ok).toBe(true);
    stepTicks(simulation, 20);

    expect(primary.hp).toBeLessThan(primaryBefore);
    expect(nearby.hp).toBeLessThan(nearbyBefore);
    expect(primaryBefore - primary.hp).toBeGreaterThan(nearbyBefore - nearby.hp);
    expect(far.hp).toBe(farBefore);
    expect(friendly.hp).toBe(friendlyBefore);
  });

  it('敌方 AI 以可检查状态扩张，并在基地受威胁时转入防守', () => {
    const economy = new GameSimulation(606);
    stepTicks(economy, 20);
    expect(economy.state.ai.enemy.phase).toBe('economy');
    expect(economy.state.buildings.some(
      (building) => building.team === 'enemy' && building.kind === 'factory' && building.buildProgress < 1,
    )).toBe(true);

    const defense = new GameSimulation(607);
    const tank = defense.state.units.find((unit) => unit.id === 'u-player-tank');
    expect(tank).toBeDefined();
    if (!tank) return;
    tank.position = { x: 50, z: -38 };
    stepTicks(defense, 20);
    expect(defense.state.ai.enemy.phase).toBe('defend');
    expect(defense.state.ai.enemy.reason).toMatch(/threat|defense/);
  });

  it('隐藏敌军不能被指定攻击，侦察后可锁定且离开后保留已探索区域', () => {
    const simulation = new GameSimulation(701);
    const scout = simulation.state.units.find((unit) => unit.id === 'u-player-scout');
    const tank = simulation.state.units.find((unit) => unit.id === 'u-player-tank');
    const enemyHq = simulation.state.buildings.find((building) => building.id === 'b-enemy-hq');
    expect(scout && tank && enemyHq).toBeTruthy();
    if (!scout || !tank || !enemyHq) return;

    expect(simulation.issue({ type: 'attack', unitIds: [tank.id], targetId: enemyHq.id }).ok).toBe(false);
    scout.position = { x: 40, z: -40 };
    stepTicks(simulation, 1);
    expect(simulation.issue({ type: 'stop', unitIds: [scout.id] }).ok).toBe(true);
    expect(simulation.state.intel.player.visibleEnemyIds).toContain(enemyHq.id);
    expect(simulation.issue({ type: 'attack', unitIds: [tank.id], targetId: enemyHq.id }).ok).toBe(true);

    scout.position = { x: -34, z: 39 };
    stepTicks(simulation, 1);
    expect(simulation.issue({ type: 'stop', unitIds: [scout.id] }).ok).toBe(true);
    expect(simulation.state.intel.player.visibleEnemyIds).not.toContain(enemyHq.id);
    const snapshot = simulation.state.intel.player.visibility;
    const grid = new VisibilityGrid({ bounds: snapshot.bounds, cellSize: snapshot.cellSize });
    expect(grid.getState(snapshot, enemyHq.position)).toBe('explored');
  });

  it('雷达在电力比例跌破阈值时离线', () => {
    const simulation = new GameSimulation(702);
    expect(simulation.state.intel.player.radarOnline).toBe(true);
    const reactor = simulation.state.buildings.find((building) => building.id === 'b-player-reactor');
    expect(reactor).toBeDefined();
    if (!reactor) return;
    reactor.kind = 'factory';
    stepTicks(simulation, 1);
    expect(simulation.state.economy.player.powerRatio).toBeLessThan(0.7);
    expect(simulation.state.intel.player.radarOnline).toBe(false);
  });

  it('信号增幅研究完成后扩大雷达侦测范围', () => {
    const simulation = new GameSimulation(708);
    const playerHq = simulation.state.buildings.find((building) => building.id === 'b-player-hq');
    const enemyScout = simulation.state.units.find((unit) => unit.id === 'u-enemy-scout');
    expect(playerHq && enemyScout).toBeTruthy();
    if (!playerHq || !enemyScout) return;
    simulation.state.buildings = simulation.state.buildings.filter(
      (building) => building.team === 'enemy' || building.id === playerHq.id,
    );
    for (const unit of simulation.state.units.filter((candidate) => candidate.team === 'player')) {
      unit.position = { ...playerHq.position };
    }
    enemyScout.position = { x: playerHq.position.x + 23.5, z: playerHq.position.z };
    stepTicks(simulation, 1);
    expect(simulation.state.intel.player.visibleEnemyIds).not.toContain(enemyScout.id);
    simulation.state.technology.player = createTechnologyTeamState(['signalAmplifier']);
    stepTicks(simulation, 1);
    expect(simulation.state.intel.player.visibleEnemyIds).toContain(enemyScout.id);
  });

  it('研究完成只触发一次并提升现有与新生产单位的生命上限', () => {
    const simulation = new GameSimulation(703);
    const rifle = simulation.state.units.find((unit) => unit.id === 'u-player-rifle-1');
    expect(rifle).toBeDefined();
    if (!rifle) return;
    const originalMaxHp = rifle.maxHp;
    expect(simulation.issue({ type: 'research', kind: 'compositeArmor' }).ok).toBe(true);
    simulation.state.technology.player = {
      completed: [],
      current: {
        kind: 'compositeArmor',
        elapsedSeconds: TECHNOLOGY_DEFS.compositeArmor.durationSeconds - GAME_TICK_SECONDS,
      },
    };
    stepTicks(simulation, 1);
    expect(simulation.state.technology.player.completed).toContain('compositeArmor');
    expect(rifle.maxHp).toBeCloseTo(originalMaxHp * 1.15, 6);
    const boostedMaxHp = rifle.maxHp;
    stepTicks(simulation, 2);
    expect(rifle.maxHp).toBe(boostedMaxHp);

    expect(simulation.issue({ type: 'produce', buildingId: 'b-player-barracks', unitKind: 'rifle' }).ok).toBe(true);
    stepTicks(simulation, 250);
    const newestRifle = simulation.state.units
      .filter((unit) => unit.team === 'player' && unit.kind === 'rifle')
      .sort((left, right) => left.id.localeCompare(right.id))
      .at(-1);
    expect(newestRifle?.maxHp).toBeCloseTo(UNIT_DEFS.rifle.maxHp * 1.15, 6);
  });

  it('高效精炼把实际回炼收入提高 20%', () => {
    const simulation = new GameSimulation(704);
    const harvester = simulation.state.units.find((unit) => unit.id === 'u-player-harvester');
    const refinery = simulation.state.buildings.find((building) => building.id === 'b-player-refinery');
    expect(harvester && refinery).toBeTruthy();
    if (!harvester || !refinery) return;
    simulation.state.technology.player = createTechnologyTeamState(['efficientRefining']);
    harvester.position = { ...refinery.position };
    harvester.cargo = 100;
    harvester.order = { type: 'return', targetId: refinery.id };
    const before = simulation.state.economy.player.credits;
    stepTicks(simulation, 1);
    expect(simulation.state.economy.player.credits - before).toBeCloseTo(120, 6);
  });

  it('施工、生产和研究取消均只返还基础成本的 75%', () => {
    const construction = new GameSimulation(705);
    const buildBefore = construction.state.economy.player.credits;
    expect(construction.issue({ type: 'build', kind: 'reactor', position: { x: -67, z: 58 }, rotation: 0 }).ok).toBe(true);
    const queuedBuilding = construction.state.buildings.find(
      (building) => building.team === 'player' && building.kind === 'reactor' && building.buildProgress < 1,
    );
    expect(queuedBuilding).toBeDefined();
    if (!queuedBuilding) return;
    expect(construction.issue({ type: 'cancelConstruction', buildingId: queuedBuilding.id }).ok).toBe(true);
    expect(construction.state.economy.player.credits).toBe(buildBefore - 600 + 450);
    expect(construction.issue({ type: 'cancelConstruction', buildingId: queuedBuilding.id }).ok).toBe(false);

    const production = new GameSimulation(706);
    const productionBefore = production.state.economy.player.credits;
    expect(production.issue({ type: 'produce', buildingId: 'b-player-barracks', unitKind: 'rifle' }).ok).toBe(true);
    expect(production.issue({ type: 'cancelProduction', buildingId: 'b-player-barracks' }).ok).toBe(true);
    expect(production.state.economy.player.credits).toBe(productionBefore - 180 + 135);
    expect(production.issue({ type: 'cancelProduction', buildingId: 'b-player-barracks' }).ok).toBe(false);

    const research = new GameSimulation(707);
    const researchBefore = research.state.economy.player.credits;
    expect(research.issue({ type: 'research', kind: 'efficientRefining' }).ok).toBe(true);
    expect(research.issue({ type: 'cancelResearch' }).ok).toBe(true);
    expect(research.state.economy.player.credits).toBe(researchBefore - 800 + 600);
    expect(research.issue({ type: 'cancelResearch' }).ok).toBe(false);
  });

  it('哨戒塔按固定冷却自动攻击可见敌军且不伤害友军', () => {
    const simulation = new GameSimulation(801);
    const position = { x: -67, z: 58 };
    expect(simulation.issue({ type: 'build', kind: 'sentry', position, rotation: 0 }).ok).toBe(true);
    const sentry = simulation.state.buildings.find(
      (building) => building.team === 'player' && building.kind === 'sentry',
    );
    const enemy = simulation.state.units.find((unit) => unit.id === 'u-enemy-rifle-1');
    const friendly = simulation.state.units.find((unit) => unit.id === 'u-player-rifle-1');
    expect(sentry && enemy && friendly).toBeTruthy();
    if (!sentry || !enemy || !friendly) return;
    sentry.buildProgress = 1;
    sentry.hp = sentry.maxHp;
    enemy.kind = 'engineer';
    friendly.kind = 'engineer';
    enemy.position = { x: -58, z: 58 };
    friendly.position = { x: -58, z: 59 };
    simulation.state.units = [enemy, friendly];

    const enemyBefore = enemy.hp;
    const friendlyBefore = friendly.hp;
    stepTicks(simulation, 1);
    const firstEvents = simulation.drainEvents();
    expect(firstEvents.some((event) => event.type === 'shot' && event.sourceId === sentry.id)).toBe(true);
    expect(sentry.cooldownRemaining).toBeCloseTo(BUILDING_DEFS.sentry.weapon?.cooldown ?? 0, 6);
    expect(sentry.aimRotation).not.toBe(sentry.rotation);
    stepTicks(simulation, 7);
    expect(simulation.drainEvents().some((event) => event.type === 'shot' && event.sourceId === sentry.id)).toBe(false);
    stepTicks(simulation, 1);
    expect(simulation.drainEvents().some((event) => event.type === 'shot' && event.sourceId === sentry.id)).toBe(true);
    expect(enemy.hp).toBeLessThan(enemyBefore);
    expect(friendly.hp).toBe(friendlyBefore);
  });

  it('重炮塔命中对邻近敌军造成衰减伤害且过滤同阵营单位', () => {
    const simulation = new GameSimulation(802);
    const position = { x: -67, z: 58 };
    expect(simulation.issue({ type: 'build', kind: 'cannon', position, rotation: 0 }).ok).toBe(true);
    const cannon = simulation.state.buildings.find(
      (building) => building.team === 'player' && building.kind === 'cannon',
    );
    const primary = simulation.state.units.find((unit) => unit.id === 'u-enemy-tank');
    const nearby = simulation.state.units.find((unit) => unit.id === 'u-enemy-antitank');
    const friendly = simulation.state.units.find((unit) => unit.id === 'u-player-tank');
    expect(cannon && primary && nearby && friendly).toBeTruthy();
    if (!cannon || !primary || !nearby || !friendly) return;
    cannon.buildProgress = 1;
    cannon.hp = cannon.maxHp;
    primary.cooldownRemaining = 999;
    nearby.kind = 'engineer';
    nearby.cooldownRemaining = 999;
    friendly.kind = 'engineer';
    primary.position = { x: -56, z: 58 };
    nearby.position = { x: -54, z: 58 };
    friendly.position = { x: -55, z: 58 };
    simulation.state.units = [primary, nearby, friendly];

    const primaryBefore = primary.hp;
    const nearbyBefore = nearby.hp;
    const friendlyBefore = friendly.hp;
    stepTicks(simulation, 15);
    expect(primary.hp).toBeLessThan(primaryBefore);
    expect(nearby.hp).toBeLessThan(nearbyBefore);
    expect(primaryBefore - primary.hp).toBeGreaterThan(nearbyBefore - nearby.hp);
    expect(friendly.hp).toBe(friendlyBefore);
  });

  it('防御塔在施工、断网或低电时停火并在条件恢复后继续', () => {
    const simulation = new GameSimulation(803);
    const home = { x: -67, z: 58 };
    expect(simulation.issue({ type: 'build', kind: 'sentry', position: home, rotation: 0 }).ok).toBe(true);
    const sentry = simulation.state.buildings.find(
      (building) => building.team === 'player' && building.kind === 'sentry',
    );
    const enemy = simulation.state.units.find((unit) => unit.id === 'u-enemy-rifle-1');
    const reactor = simulation.state.buildings.find((building) => building.id === 'b-player-reactor');
    expect(sentry && enemy && reactor).toBeTruthy();
    if (!sentry || !enemy || !reactor) return;
    enemy.position = { x: -58, z: 58 };
    simulation.state.units = [enemy];
    const before = enemy.hp;
    stepTicks(simulation, 3);
    expect(enemy.hp).toBe(before);

    sentry.buildProgress = 1;
    sentry.hp = sentry.maxHp;
    sentry.position = { x: 0, z: 0 };
    enemy.position = { x: 8, z: 0 };
    stepTicks(simulation, 6);
    expect(sentry.connected).toBe(false);
    expect(enemy.hp).toBe(before);

    sentry.position = { ...home };
    enemy.position = { x: -58, z: 58 };
    reactor.kind = 'factory';
    stepTicks(simulation, 6);
    expect(simulation.state.economy.player.powerRatio).toBeLessThan(0.7);
    expect(enemy.hp).toBe(before);

    reactor.kind = 'reactor';
    stepTicks(simulation, 8);
    expect(simulation.state.economy.player.powerRatio).toBeGreaterThanOrEqual(0.7);
    expect(enemy.hp).toBeLessThan(before);
  });
});
