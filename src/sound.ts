// 効果音（BGMなし）
// 音声ファイルは使わず、Web Audio API でその場で合成する。
// （1ファイルで配れて、オフラインでも鳴り、読み込み待ちもない）

export type SoundName =
  | 'discard' // 他家が牌を切る
  | 'discardMe' // 自分が牌を切る
  | 'draw' // 自分のツモ
  | 'select' // 牌を選ぶ
  | 'deny' // 切れない牌をタップした
  | 'tap' // ボタン
  | 'prompt' // 鳴き・ロンの確認が出た
  | 'pon'
  | 'chi'
  | 'kan'
  | 'riichi'
  | 'ron'
  | 'tsumo'
  | 'win' // 自分が和了（通常）
  | 'winBig' // 自分が和了（満貫以上）
  | 'winYakuman' // 自分が和了（役満）
  | 'lose' // 放銃
  | 'resultOther' // 他家の和了
  | 'drawGame' // 流局
  | 'shuffle' // 局のはじまり
  | 'undo'
  | 'rank1'
  | 'rank2'
  | 'rank3'
  | 'rank4'

export const SOUND_NAMES: SoundName[] = [
  'discard',
  'discardMe',
  'draw',
  'select',
  'deny',
  'tap',
  'prompt',
  'pon',
  'chi',
  'kan',
  'riichi',
  'ron',
  'tsumo',
  'win',
  'winBig',
  'winYakuman',
  'lose',
  'resultOther',
  'drawGame',
  'shuffle',
  'undo',
  'rank1',
  'rank2',
  'rank3',
  'rank4',
]

export interface PlayOpts {
  /** 左右の位置 -1（左）〜 1（右） */
  pan?: number
  /** 強さ 0〜1 */
  vel?: number
  /** 鳴らし始めるまでの秒数 */
  delay?: number
}

// ---------- 音の部品 ----------
interface Shape {
  /** 開始（秒、この音の先頭から） */
  t?: number
  dur: number
  vol: number
  atk?: number
  pan?: number
  filter?: { type: BiquadFilterType; f: number; f2?: number; q?: number }
}

interface OscSpec extends Shape {
  type?: OscillatorType
  f: number
  /** 終わりの周波数（指定すると滑らかに変化） */
  f2?: number
}

interface NoiseSpec extends Shape {
  /** ノイズの読み出し開始位置（秒）。毎回少し変えて、音を単調にしない */
  offset?: number
}

/** 1回分の音を組み立てる */
export class Rec {
  /** この音が鳴り終わるまでの秒数 */
  end = 0
  constructor(
    readonly ctx: BaseAudioContext,
    readonly out: AudioNode,
    readonly t0: number,
    readonly noiseBuf: AudioBuffer,
  ) {}

  private shape(src: AudioScheduledSourceNode, o: Shape, start: (when: number) => void) {
    const ctx = this.ctx
    const t = this.t0 + (o.t ?? 0)
    let node: AudioNode = src
    if (o.filter) {
      const bq = ctx.createBiquadFilter()
      bq.type = o.filter.type
      bq.frequency.setValueAtTime(o.filter.f, t)
      if (o.filter.f2) bq.frequency.exponentialRampToValueAtTime(o.filter.f2, t + o.dur)
      bq.Q.value = o.filter.q ?? 1
      node.connect(bq)
      node = bq
    }
    const g = ctx.createGain()
    const atk = o.atk ?? 0.004
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(o.vol, 0.0002), t + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    node.connect(g)
    node = g
    if (o.pan && 'createStereoPanner' in ctx) {
      const p = ctx.createStereoPanner()
      p.pan.value = Math.max(-1, Math.min(1, o.pan))
      node.connect(p)
      node = p
    }
    node.connect(this.out)
    start(t)
    src.stop(t + o.dur + 0.05)
    this.end = Math.max(this.end, (o.t ?? 0) + o.dur + 0.05)
  }

  osc(o: OscSpec) {
    const src = this.ctx.createOscillator()
    src.type = o.type ?? 'sine'
    const t = this.t0 + (o.t ?? 0)
    src.frequency.setValueAtTime(o.f, t)
    if (o.f2) src.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur)
    this.shape(src, o, (when) => src.start(when))
  }

  noise(o: NoiseSpec) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    this.shape(src, o, (when) => src.start(when, o.offset ?? Math.random() * 0.3))
  }
}

type Recipe = (r: Rec, o: { pan: number; vel: number }) => void

/** ドレミ（周波数） */
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.5
const G6 = 1568

/** ファンファーレ用：音を並べる */
function notes(r: Rec, list: [number, number, number][], vol: number, type: OscillatorType = 'triangle') {
  for (const [t, f, d] of list) {
    r.osc({ t, f, dur: d, vol, type, filter: { type: 'lowpass', f: 3200 }, atk: 0.01 })
    r.osc({ t, f: f / 2, dur: d, vol: vol * 0.7, type: 'sine', atk: 0.01 })
  }
}

/** 鐘のような響き */
function bell(r: Rec, t: number, f: number, dur: number, vol: number) {
  r.osc({ t, f, dur, vol, type: 'sine', atk: 0.002 })
  r.osc({ t, f: f * 2.76, dur: dur * 0.5, vol: vol * 0.35, type: 'sine', atk: 0.002 })
  r.osc({ t, f: f * 5.4, dur: dur * 0.25, vol: vol * 0.15, type: 'sine', atk: 0.002 })
}

export const RECIPES: Record<SoundName, Recipe> = {
  // 牌が卓に当たる「カッ」
  discard: (r, { pan, vel }) => {
    const k = 0.92 + Math.random() * 0.16
    r.noise({ dur: 0.05, vol: 0.5 * vel, filter: { type: 'bandpass', f: 2400 * k, q: 0.9 }, pan, atk: 0.002 })
    r.osc({ f: 230 * k, f2: 90, dur: 0.07, vol: 0.5 * vel, pan, atk: 0.002 })
    r.noise({ t: 0.012, dur: 0.035, vol: 0.2 * vel, filter: { type: 'highpass', f: 4500 }, pan })
  },
  discardMe: (r, { pan, vel }) => {
    const k = 0.95 + Math.random() * 0.1
    r.noise({ dur: 0.06, vol: 0.7 * vel, filter: { type: 'bandpass', f: 2100 * k, q: 0.8 }, pan, atk: 0.002 })
    r.osc({ f: 260 * k, f2: 80, dur: 0.09, vol: 0.7 * vel, pan, atk: 0.002 })
    r.noise({ t: 0.014, dur: 0.04, vol: 0.25 * vel, filter: { type: 'highpass', f: 4000 }, pan })
  },
  draw: (r, { vel }) => {
    r.noise({ dur: 0.03, vol: 0.12 * vel, filter: { type: 'highpass', f: 3500 } })
    r.osc({ f: 520, f2: 400, dur: 0.045, vol: 0.06 * vel })
  },
  select: (r, { vel }) => {
    r.osc({ type: 'triangle', f: 1300, f2: 1000, dur: 0.045, vol: 0.12 * vel })
  },
  deny: (r, { vel }) => {
    for (const t of [0, 0.1]) r.osc({ t, type: 'square', f: 150, f2: 110, dur: 0.07, vol: 0.09 * vel, filter: { type: 'lowpass', f: 600 } })
  },
  tap: (r, { vel }) => {
    r.osc({ f: 700, f2: 1000, dur: 0.07, vol: 0.13 * vel })
    r.noise({ dur: 0.02, vol: 0.05 * vel, filter: { type: 'highpass', f: 5000 } })
  },
  // 鳴き・ロンの確認が出た「ピコン」
  prompt: (r, { vel }) => {
    bell(r, 0, 988, 0.26, 0.22 * vel)
    bell(r, 0.11, 1319, 0.36, 0.22 * vel)
  },
  pon: (r, { vel }) => {
    r.osc({ f: 440, f2: 330, dur: 0.24, vol: 0.5 * vel })
    r.osc({ type: 'triangle', f: 880, f2: 660, dur: 0.13, vol: 0.15 * vel })
    r.noise({ dur: 0.05, vol: 0.3 * vel, filter: { type: 'bandpass', f: 900, q: 1 } })
  },
  chi: (r, { vel }) => {
    r.osc({ f: 587, f2: 494, dur: 0.2, vol: 0.4 * vel })
    r.osc({ type: 'triangle', f: 1175, f2: 988, dur: 0.11, vol: 0.12 * vel })
    r.noise({ dur: 0.04, vol: 0.25 * vel, filter: { type: 'bandpass', f: 1400, q: 1 } })
  },
  kan: (r, { vel }) => {
    r.osc({ f: 262, f2: 110, dur: 0.38, vol: 0.6 * vel })
    r.osc({ type: 'triangle', f: 660, f2: 440, dur: 0.16, vol: 0.15 * vel })
    r.noise({ dur: 0.07, vol: 0.4 * vel, filter: { type: 'bandpass', f: 700, q: 0.8 } })
    bell(r, 0.12, G6, 0.5, 0.14 * vel)
  },
  // 点棒を出す「チャリン」
  riichi: (r, { vel }) => {
    r.noise({ dur: 0.06, vol: 0.22 * vel, filter: { type: 'highpass', f: 3000 } })
    r.osc({ f: 150, f2: 60, dur: 0.25, vol: 0.5 * vel })
    bell(r, 0.03, 1760, 0.9, 0.2 * vel)
    bell(r, 0.16, 2349, 0.7, 0.12 * vel)
  },
  // 「ドン！」
  ron: (r, { vel }) => {
    r.noise({ dur: 0.35, vol: 0.5 * vel, atk: 0.005, filter: { type: 'bandpass', f: 4000, f2: 300, q: 0.7 } })
    r.osc({ f: 140, f2: 45, dur: 0.42, vol: 0.7 * vel, atk: 0.003 })
    for (const f of [392, 494, 587]) r.osc({ t: 0.05, type: 'sawtooth', f, dur: 0.5, vol: 0.09 * vel, filter: { type: 'lowpass', f: 1800 } })
  },
  // 「キラリ」
  tsumo: (r, { vel }) => {
    notes(r, [[0, C5, 0.3], [0.075, E5, 0.3], [0.15, G5, 0.3], [0.225, C6, 0.5]], 0.2 * vel)
    r.noise({ t: 0.22, dur: 0.3, vol: 0.07 * vel, filter: { type: 'highpass', f: 6000 } })
  },
  win: (r, { vel }) => {
    notes(r, [[0, C5, 0.18], [0.12, E5, 0.18], [0.24, G5, 0.18], [0.4, C6, 0.7]], 0.2 * vel, 'square')
    bell(r, 0.4, C6 * 2, 0.8, 0.1 * vel)
  },
  winBig: (r, { vel }) => {
    notes(
      r,
      [[0, C5, 0.15], [0.1, E5, 0.15], [0.2, G5, 0.15], [0.3, C6, 0.15], [0.42, E6, 0.15], [0.54, G6, 0.9]],
      0.2 * vel,
      'square',
    )
    r.noise({ t: 0.5, dur: 0.8, vol: 0.1 * vel, atk: 0.05, filter: { type: 'highpass', f: 5500 } })
    bell(r, 0.54, C6 * 2, 1.0, 0.12 * vel)
    r.osc({ t: 0.54, f: 130, f2: 70, dur: 0.5, vol: 0.4 * vel })
  },
  winYakuman: (r, { vel }) => {
    for (const t of [0, 0.22, 0.44]) r.osc({ t, f: 120, f2: 55, dur: 0.3, vol: 0.6 * vel })
    notes(
      r,
      [[0.7, C5, 0.14], [0.8, E5, 0.14], [0.9, G5, 0.14], [1.0, C6, 0.14], [1.1, E6, 0.14], [1.2, G6, 0.14], [1.35, C6 * 2, 1.4]],
      0.2 * vel,
      'square',
    )
    r.noise({ t: 0.7, dur: 1.6, vol: 0.12 * vel, atk: 0.3, filter: { type: 'highpass', f: 5000 } })
    for (const [t, f] of [[1.35, C6], [1.45, G6], [1.55, C6 * 2]] as [number, number][]) bell(r, t, f, 1.2, 0.12 * vel)
  },
  lose: (r, { vel }) => {
    r.osc({ type: 'sawtooth', f: 392, f2: 370, dur: 0.3, vol: 0.2 * vel, filter: { type: 'lowpass', f: 500 } })
    r.osc({ t: 0.25, type: 'sawtooth', f: 311, f2: 233, dur: 0.6, vol: 0.2 * vel, filter: { type: 'lowpass', f: 450 } })
  },
  resultOther: (r, { vel }) => {
    r.osc({ type: 'triangle', f: 660, dur: 0.15, vol: 0.12 * vel })
    r.osc({ t: 0.08, type: 'triangle', f: 880, dur: 0.2, vol: 0.12 * vel })
  },
  drawGame: (r, { vel }) => {
    r.osc({ f: 440, f2: 392, dur: 0.3, vol: 0.18 * vel })
    r.osc({ t: 0.22, f: 330, f2: 311, dur: 0.5, vol: 0.18 * vel })
  },
  // 牌をかき混ぜる「ジャラジャラ」
  shuffle: (r, { vel }) => {
    r.noise({ dur: 0.55, vol: 0.14 * vel, atk: 0.1, filter: { type: 'lowpass', f: 900 } })
    for (let i = 0; i < 10; i++) {
      r.noise({
        t: i * 0.05 + Math.random() * 0.03,
        dur: 0.05,
        vol: (0.16 + Math.random() * 0.1) * vel,
        pan: (Math.random() - 0.5) * 0.8,
        filter: { type: 'bandpass', f: 1500 + Math.random() * 2500, q: 1.2 },
      })
    }
  },
  undo: (r, { vel }) => {
    r.osc({ f: 700, f2: 300, dur: 0.16, vol: 0.15 * vel })
    r.noise({ dur: 0.1, vol: 0.05 * vel, filter: { type: 'bandpass', f: 1200, f2: 400, q: 1 } })
  },
  rank1: (r, { vel }) => {
    notes(
      r,
      [[0, C5, 0.15], [0.12, E5, 0.15], [0.24, G5, 0.15], [0.36, C6, 0.15], [0.52, G5, 0.12], [0.64, C6, 0.12], [0.76, E6, 0.12], [0.9, G6, 1.1]],
      0.2 * vel,
      'square',
    )
    bell(r, 0.9, C6 * 2, 1.2, 0.12 * vel)
    r.noise({ t: 0.85, dur: 1.0, vol: 0.1 * vel, atk: 0.1, filter: { type: 'highpass', f: 5500 } })
  },
  rank2: (r, { vel }) => {
    notes(r, [[0, C5, 0.18], [0.14, E5, 0.18], [0.28, G5, 0.7]], 0.18 * vel, 'triangle')
  },
  rank3: (r, { vel }) => {
    notes(r, [[0, G5 * 0.75, 0.2], [0.16, C5, 0.6]], 0.16 * vel, 'triangle')
  },
  rank4: (r, { vel }) => {
    r.osc({ type: 'sawtooth', f: 330, f2: 311, dur: 0.35, vol: 0.18 * vel, filter: { type: 'lowpass', f: 450 } })
    r.osc({ t: 0.3, type: 'sawtooth', f: 262, f2: 196, dur: 0.8, vol: 0.18 * vel, filter: { type: 'lowpass', f: 400 } })
  },
}

// ---------- 出力の経路（音量・音割れ防止） ----------
export function buildChain(ctx: BaseAudioContext, volume: number): GainNode {
  const input = ctx.createGain()
  input.gain.value = volume
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 12
  comp.ratio.value = 6
  comp.attack.value = 0.003
  comp.release.value = 0.15
  input.connect(comp)
  comp.connect(ctx.destination)
  return input
}

export function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 1)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** 指定の時刻から音を鳴らす。鳴り終わるまでの秒数を返す */
export function scheduleSound(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, name: SoundName, when: number, o: PlayOpts = {}): number {
  const r = new Rec(ctx, out, when, noise)
  RECIPES[name](r, { pan: o.pan ?? 0, vel: o.vel ?? 1 })
  return r.end
}

// ---------- 再生（アプリから使う） ----------
let ctx: AudioContext | null = null
let chain: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let enabled = true
let volume = 0.7
const lastPlayed = new Map<SoundName, number>()

declare global {
  interface Window {
    /** テスト用：鳴らした効果音を知るためのフック */
    __onSound?: (name: SoundName) => void
    webkitAudioContext?: typeof AudioContext
  }
}

function getContext(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? window.webkitAudioContext
  if (!AC) return null
  try {
    // iPhone でも、他のアプリの音楽を止めない（消音スイッチは尊重される）
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'ambient'
  } catch {
    /* 対応していない端末は何もしない */
  }
  try {
    ctx = new AC()
    chain = buildChain(ctx, volume)
    noiseBuf = makeNoiseBuffer(ctx)
  } catch {
    ctx = null
  }
  return ctx
}

export function configureSound(on: boolean, vol: number) {
  enabled = on
  volume = Math.max(0, Math.min(1, vol))
  if (chain) chain.gain.value = volume
}

/** ユーザーの操作の中で呼ぶ（スマホは、操作があるまで音を出せない） */
export function unlockSound() {
  const c = getContext()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

export function playSound(name: SoundName, o: PlayOpts = {}) {
  window.__onSound?.(name)
  if (!enabled || volume <= 0) return
  const c = getContext()
  if (!c || !chain || !noiseBuf) return
  if (c.state !== 'running') {
    // まだ操作がなくて鳴らせない。溜めておくと、あとで一斉に鳴ってしまうので捨てる
    c.resume().catch(() => {})
    return
  }
  const now = c.currentTime
  const prev = lastPlayed.get(name) ?? -1
  if (now - prev < 0.03) return // 同じ音の連打を避ける
  lastPlayed.set(name, now)
  try {
    scheduleSound(c, chain, noiseBuf, name, now + (o.delay ?? 0) + 0.005, o)
  } catch {
    /* 音が鳴らなくてもゲームは続ける */
  }
}
