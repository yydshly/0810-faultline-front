import { describe, expect, it } from 'vitest';
import {
  AUDIO_CUE_KINDS,
  createAudioCue,
  GameAudio,
  mapSimulationEventToAudioCue,
  worldXToStereoPan,
} from './audio';
import type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  GainNodeLike,
  OscillatorNodeLike,
  StereoPannerNodeLike,
} from './audio';
import type { SimulationEvent } from './types';

const event = (
  type: SimulationEvent['type'],
  overrides: Partial<Omit<SimulationEvent, 'type'>> = {},
): SimulationEvent => ({ type, at: { x: 0, z: 0 }, ...overrides });

class FakeParam implements AudioParamLike {
  public value = 0;
  public readonly scheduled: Array<{ type: 'set' | 'ramp'; value: number; time: number }> = [];

  public setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.scheduled.push({ type: 'set', value, time });
  }

  public linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.scheduled.push({ type: 'ramp', value, time });
  }
}

class FakeNode implements AudioNodeLike {
  public readonly connections: AudioNodeLike[] = [];
  public disconnected = false;

  public connect(destination: AudioNodeLike): AudioNodeLike {
    this.connections.push(destination);
    return destination;
  }

  public disconnect(): void {
    this.disconnected = true;
  }
}

class FakeOscillator extends FakeNode implements OscillatorNodeLike {
  public type: OscillatorType = 'sine';
  public readonly frequency = new FakeParam();
  public onended: (() => void) | null = null;
  public readonly startTimes: number[] = [];
  public readonly stopTimes: number[] = [];

  public start(when = 0): void {
    this.startTimes.push(when);
  }

  public stop(when = 0): void {
    this.stopTimes.push(when);
  }

  public finish(): void {
    this.onended?.();
  }
}

class FakeGain extends FakeNode implements GainNodeLike {
  public readonly gain = new FakeParam();
}

class FakePanner extends FakeNode implements StereoPannerNodeLike {
  public readonly pan = new FakeParam();
}

class FakeAudioContext implements AudioContextLike {
  public currentTime = 0;
  public state = 'suspended';
  public readonly destination = new FakeNode();
  public readonly oscillators: FakeOscillator[] = [];
  public readonly gains: FakeGain[] = [];
  public readonly panners: FakePanner[] = [];
  public resumeCalls = 0;
  public closeCalls = 0;
  public resumeError = false;

  public createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  public createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  public createStereoPanner(): FakePanner {
    const panner = new FakePanner();
    this.panners.push(panner);
    return panner;
  }

  public async resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeError) throw new Error('resume failed');
    this.state = 'running';
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
    this.state = 'closed';
  }
}

class FakeAudioContextWithoutPanner implements AudioContextLike {
  public currentTime = 0;
  public state = 'running';
  public readonly destination = new FakeNode();
  public readonly oscillators: FakeOscillator[] = [];

  public createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  public createGain(): FakeGain {
    return new FakeGain();
  }
}

describe('SimulationEvent 音效映射', () => {
  it('覆盖有限提示集合，并区分轻重射击与研究开始/完成', () => {
    const mappings: Array<[SimulationEvent, (typeof AUDIO_CUE_KINDS)[number]]> = [
      [event('command'), 'command'],
      [event('shot', { amount: 12 }), 'shotLight'],
      [event('shot', { amount: 48 }), 'shotHeavy'],
      [event('shot', { amount: 10, radius: 3 }), 'shotHeavy'],
      [event('impact'), 'impact'],
      [event('destroyed'), 'destroyed'],
      [event('alert'), 'warning'],
      [event('deposit'), 'deposit'],
      [event('built'), 'buildComplete'],
      [event('produced'), 'productionComplete'],
      [event('research', { amount: 1_000 }), 'command'],
      [event('research'), 'researchComplete'],
      [event('repair'), 'repair'],
      [event('cancelled'), 'cancelled'],
    ];

    for (const [input, expected] of mappings) {
      const cue = mapSimulationEventToAudioCue(input);
      expect(cue.kind).toBe(expected);
      expect(AUDIO_CUE_KINDS).toContain(cue.kind);
      expect(Number.isFinite(cue.durationSeconds)).toBe(true);
      expect(cue.durationSeconds).toBeGreaterThan(0);
    }
    expect(new Set([
      ...mappings.map(([input]) => mapSimulationEventToAudioCue(input).kind),
      createAudioCue('warning').kind,
    ])).toEqual(
      new Set(AUDIO_CUE_KINDS),
    );
  });

  it('提供独立高优先级 warning 提示，不依赖 SimulationEvent', () => {
    const warning = createAudioCue('warning', 4);
    const command = mapSimulationEventToAudioCue(event('command'));

    expect(warning.kind).toBe('warning');
    expect(warning.priority).toBeGreaterThan(command.priority);
    expect(warning.pan).toBe(1);
    expect(warning.throttleMs).toBeGreaterThan(0);
  });

  it('关键完成与摧毁提示优先级高于高频战斗反馈', () => {
    const destroyed = mapSimulationEventToAudioCue(event('destroyed'));
    const research = mapSimulationEventToAudioCue(event('research'));
    const shot = mapSimulationEventToAudioCue(event('shot', { amount: 10 }));
    const repair = mapSimulationEventToAudioCue(event('repair'));

    expect(destroyed.priority).toBeGreaterThan(research.priority);
    expect(research.priority).toBeGreaterThan(shot.priority);
    expect(shot.priority).toBeGreaterThan(repair.priority);
  });

  it('把世界 X 稳定裁剪到立体声 pan 范围', () => {
    expect(worldXToStereoPan(-200, 0, 80)).toBe(-1);
    expect(worldXToStereoPan(20, 0, 80)).toBe(0.25);
    expect(worldXToStereoPan(60, 20, 80)).toBe(0.5);
    expect(worldXToStereoPan(200, 0, 80)).toBe(1);
    expect(worldXToStereoPan(Number.NaN, 0, 80)).toBe(0);
    expect(worldXToStereoPan(20, 0, 0)).toBe(0);
    expect(mapSimulationEventToAudioCue(event('command', { at: { x: 40, z: 99 } }), {
      listenerX: 0,
      panDistance: 80,
    }).pan).toBe(0.5);
  });
});

describe('GameAudio', () => {
  it('只在用户手势 unlock 时创建并恢复上下文', async () => {
    const context = new FakeAudioContext();
    let factoryCalls = 0;
    const audio = new GameAudio({
      contextFactory: () => {
        factoryCalls += 1;
        return context;
      },
    });

    expect(audio.available).toBe(true);
    expect(audio.unlocked).toBe(false);
    expect(audio.consume([event('command')])).toBe(0);
    expect(factoryCalls).toBe(0);

    await expect(audio.unlock()).resolves.toBe(true);
    expect(factoryCalls).toBe(1);
    expect(context.resumeCalls).toBe(1);
    expect(audio.unlocked).toBe(true);
    await expect(audio.unlock()).resolves.toBe(true);
    expect(factoryCalls).toBe(1);
  });

  it('AudioContext 不存在或创建失败时安全降级', async () => {
    const unavailable = new GameAudio({ contextFactory: null });
    expect(unavailable.available).toBe(false);
    await expect(unavailable.unlock()).resolves.toBe(false);
    expect(unavailable.consume([event('destroyed')])).toBe(0);

    const recoveredContext = new FakeAudioContext();
    recoveredContext.state = 'running';
    let attempts = 0;
    const throwing = new GameAudio({
      contextFactory: () => {
        attempts += 1;
        if (attempts === 1) throw new Error('temporarily blocked');
        return recoveredContext;
      },
    });
    expect(throwing.available).toBe(true);
    await expect(throwing.unlock()).resolves.toBe(false);
    expect(throwing.available).toBe(true);
    expect(throwing.unlocked).toBe(false);
    await expect(throwing.unlock()).resolves.toBe(true);
    expect(attempts).toBe(2);
    expect(throwing.available).toBe(true);
    expect(throwing.unlocked).toBe(true);
  });

  it('恢复失败时关闭旧上下文，并让新上下文从干净节流时钟重试', async () => {
    const first = new FakeAudioContext();
    const second = new FakeAudioContext();
    second.state = 'running';
    let factoryCalls = 0;
    const audio = new GameAudio({
      contextFactory: () => {
        factoryCalls += 1;
        return factoryCalls === 1 ? first : second;
      },
    });

    await audio.unlock();
    first.currentTime = 120;
    expect(audio.consume([event('command')])).toBe(1);
    first.state = 'suspended';
    first.resumeError = true;
    await expect(audio.unlock()).resolves.toBe(false);
    expect(first.closeCalls).toBe(1);
    expect(audio.activeVoiceCount).toBe(0);
    expect(audio.available).toBe(true);

    await expect(audio.unlock()).resolves.toBe(true);
    expect(factoryCalls).toBe(2);
    expect(audio.consume([event('command')])).toBe(1);
  });

  it('后台挂起后 unlocked 实时变为 false，并可由下一次手势恢复', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context });
    await audio.unlock();
    expect(audio.unlocked).toBe(true);

    context.state = 'suspended';
    expect(audio.unlocked).toBe(false);
    expect(audio.consume([event('command')])).toBe(0);
    await expect(audio.unlock()).resolves.toBe(true);
    expect(audio.unlocked).toBe(true);
    expect(context.resumeCalls).toBe(2);
  });

  it('消费事件、设置声像，并在节点结束后释放整个声部', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context, panDistance: 80 });
    await audio.unlock();

    expect(audio.consume([event('deposit', { at: { x: 40, z: 0 } })], 0)).toBe(1);
    expect(audio.activeVoiceCount).toBe(1);
    expect(context.panners[0]?.pan.scheduled[0]?.value).toBe(0.5);
    expect(context.oscillators[0]?.startTimes).toEqual([0]);

    context.oscillators[0]?.finish();
    expect(audio.activeVoiceCount).toBe(0);
    expect(context.oscillators[0]?.disconnected).toBe(true);
    expect(context.gains[0]?.disconnected).toBe(true);
    expect(context.panners[0]?.disconnected).toBe(true);
  });

  it('可直接播放 UI 命令拒绝 warning，并应用世界 X 声像', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context, panDistance: 80 });
    await audio.unlock();

    expect(audio.playWarning(40, 0)).toBe(true);
    expect(context.oscillators[0]?.frequency.scheduled[0]?.value).toBe(340);
    expect(context.panners[0]?.pan.scheduled[0]?.value).toBe(0.5);
  });

  it('节流同类高频提示，但在窗口结束后允许再次播放', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context });
    await audio.unlock();
    const shots = [event('shot', { amount: 8 }), event('shot', { amount: 9 })];

    expect(audio.consume(shots)).toBe(1);
    expect(context.oscillators).toHaveLength(1);
    context.currentTime = 0.1;
    expect(audio.consume([event('shot', { amount: 8 })])).toBe(1);
    expect(context.oscillators).toHaveLength(2);
  });

  it('允许主线按玩家视野过滤不可听见的敌方事件', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context });
    await audio.unlock();
    const events = [
      event('destroyed', { team: 'enemy', sourceId: 'hidden-enemy' }),
      event('command', { team: 'player' }),
    ];

    expect(audio.consume(events, 0, (item) => item.team !== 'enemy')).toBe(1);
    expect(context.oscillators).toHaveLength(1);
    expect(context.oscillators[0]?.frequency.scheduled[0]?.value).toBe(620);
  });

  it('总声部满载时先保留关键事件，并拒绝更低优先级提示', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context, maxVoices: 1 });
    await audio.unlock();

    expect(audio.consume([event('repair'), event('destroyed')])).toBe(1);
    expect(audio.activeVoiceCount).toBe(1);
    expect(context.oscillators).toHaveLength(1);
    expect(context.oscillators[0]?.frequency.scheduled[0]?.value).toBe(105);

    context.currentTime = 1;
    expect(audio.consume([event('repair')])).toBe(0);
    expect(context.oscillators).toHaveLength(1);
  });

  it('高优先级提示可抢占已经占满的低优先级声部', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context, maxVoices: 1 });
    await audio.unlock();

    expect(audio.consume([event('repair')])).toBe(1);
    const repairOscillator = context.oscillators[0];
    context.currentTime = 0.5;
    expect(audio.consume([event('destroyed')])).toBe(1);
    expect(audio.activeVoiceCount).toBe(1);
    expect(context.oscillators).toHaveLength(2);
    expect(repairOscillator?.stopTimes).toContain(0.5);
    expect(repairOscillator?.disconnected).toBe(true);
  });

  it('静音会立即停止声部，解除静音后可继续消费事件', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context });
    await audio.unlock();

    expect(audio.consume([event('command')])).toBe(1);
    audio.setMuted(true);
    expect(audio.muted).toBe(true);
    expect(audio.activeVoiceCount).toBe(0);
    expect(audio.consume([event('deposit')])).toBe(0);

    expect(audio.toggleMuted()).toBe(false);
    context.currentTime = 0.5;
    expect(audio.consume([event('deposit')])).toBe(1);
  });

  it('无 StereoPannerNode 时仍能以单声道安全播放', async () => {
    const context = new FakeAudioContextWithoutPanner();
    const audio = new GameAudio({ contextFactory: () => context });
    await expect(audio.unlock()).resolves.toBe(true);
    expect(audio.consume([event('built')])).toBe(1);
    expect(context.oscillators).toHaveLength(1);
  });

  it('dispose 释放节点并关闭上下文', async () => {
    const context = new FakeAudioContext();
    const audio = new GameAudio({ contextFactory: () => context });
    await audio.unlock();
    audio.consume([event('produced')]);
    audio.dispose();

    expect(audio.available).toBe(false);
    expect(audio.unlocked).toBe(false);
    expect(audio.activeVoiceCount).toBe(0);
    expect(context.closeCalls).toBe(1);
  });
});
