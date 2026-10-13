import { describe, expect, it } from 'vitest'
import { SOUND_NAMES, buildChain, makeNoiseBuffer, scheduleSound } from '../sound'

/** 音声機能のかわりになる簡単な偽物（呼ばれ方だけ記録する） */
class Param {
  value = 0
  calls = 0
  setValueAtTime(v: number) {
    this.value = v
    this.calls++
  }
  linearRampToValueAtTime() {
    this.calls++
  }
  exponentialRampToValueAtTime(v: number) {
    // 0 以下には変化できない（本物の Web Audio と同じ決まり）
    if (!(v > 0)) throw new Error('exponential ramp to non-positive value')
    this.calls++
  }
}

class FakeNode {
  gain = new Param()
  frequency = new Param()
  Q = new Param()
  pan = new Param()
  threshold = new Param()
  knee = new Param()
  ratio = new Param()
  attack = new Param()
  release = new Param()
  type = 'sine'
  buffer: unknown = null
  connected: FakeNode[] = []
  started: number | null = null
  stopped: number | null = null
  connect(n: FakeNode) {
    this.connected.push(n)
    return n
  }
  start(when: number) {
    this.started = when
  }
  stop(when: number) {
    this.stopped = when
  }
}

class FakeCtx {
  sampleRate = 8000
  currentTime = 0
  destination = new FakeNode()
  sources: FakeNode[] = []
  createGain() {
    return new FakeNode()
  }
  createDynamicsCompressor() {
    return new FakeNode()
  }
  createBiquadFilter() {
    return new FakeNode()
  }
  createStereoPanner() {
    return new FakeNode()
  }
  createOscillator() {
    const n = new FakeNode()
    this.sources.push(n)
    return n
  }
  createBufferSource() {
    const n = new FakeNode()
    this.sources.push(n)
    return n
  }
  createBuffer(_ch: number, len: number) {
    return { getChannelData: () => new Float32Array(len) }
  }
}

describe('効果音', () => {
  it('すべての効果音が、エラーなく組み立てられる', () => {
    for (const name of SOUND_NAMES) {
      const ctx = new FakeCtx()
      const out = buildChain(ctx as unknown as BaseAudioContext, 0.7)
      const noise = makeNoiseBuffer(ctx as unknown as BaseAudioContext)
      const end = scheduleSound(ctx as unknown as BaseAudioContext, out, noise, name, 1, { pan: 0.5, vel: 1 })
      expect(ctx.sources.length, name).toBeGreaterThan(0)
      // 鳴り終わりが、効果音として長すぎない（役満・1位の演出でも 3 秒以内）
      expect(end, name).toBeGreaterThan(0.05)
      expect(end, name).toBeLessThan(3)
      for (const src of ctx.sources) {
        expect(src.started, name).not.toBeNull()
        expect(src.stopped, name).not.toBeNull()
        // 予定の時刻より前に鳴り始めない・止まらない
        expect(src.started!, name).toBeGreaterThanOrEqual(1)
        expect(src.stopped!, name).toBeGreaterThan(src.started!)
        expect(src.stopped!, name).toBeLessThanOrEqual(1 + end + 0.001)
      }
    }
  })

  it('音の名前は重複しない', () => {
    expect(new Set(SOUND_NAMES).size).toBe(SOUND_NAMES.length)
  })
})
