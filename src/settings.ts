// アプリの設定（ルール以外）と保存

import type { CpuLevel } from './engine/ai'
import { normalizeRules, type Rules } from './engine/rules'

export type HintMode = 'before' | 'after' | 'off'
export type Speed = 'slow' | 'normal' | 'fast'

export interface AppSettings {
  /** 打ち筋サポート: 打つ前のヒント / 打った直後の指摘 / なし */
  hintMode: HintMode
  cpuLevel: CpuLevel
  /** 手牌の下に牌の名前を表示 */
  showNames: boolean
  speed: Speed
  /** 鳴きの確認をしない（ロン以外は自動でスルー） */
  autoPassCalls: boolean
  /** 鳴き・リーチの助言を出す */
  callAdvice: boolean
  /** 効果音 */
  se: boolean
  /** 効果音の大きさ（0〜100） */
  seVolume: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  hintMode: 'before',
  cpuLevel: 'normal',
  showNames: true,
  speed: 'normal',
  autoPassCalls: false,
  callAdvice: true,
  se: true,
  seVolume: 70,
}

const KEY_SETTINGS = 'mj-practice:settings'
const KEY_RULES = 'mj-practice:rules'
const KEY_GAME = 'mj-practice:game'
const KEY_STATS = 'mj-practice:stats'

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(v))
  } catch {
    // 保存できない環境（プライベートモードなど）でも遊べるようにする
  }
}

export const loadSettings = (): AppSettings => ({ ...DEFAULT_SETTINGS, ...(load<Partial<AppSettings>>(KEY_SETTINGS) ?? {}) })
export const saveSettings = (s: AppSettings) => save(KEY_SETTINGS, s)
export const loadRules = (): Rules => normalizeRules(load<Partial<Rules>>(KEY_RULES))
export const saveRules = (r: Rules) => save(KEY_RULES, r)
export const loadSavedGame = <T,>(): T | null => load<T>(KEY_GAME)
export const saveGame = (g: unknown) => save(KEY_GAME, g)

export interface PlayStats {
  games: number
  ranks: [number, number, number, number]
  rounds: number
  wins: number
  dealIns: number
  riichi: number
  /** 打牌の評価の累計 */
  verdicts: { best: number; good: number; soso: number; bad: number }
}

export const EMPTY_STATS: PlayStats = {
  games: 0,
  ranks: [0, 0, 0, 0],
  rounds: 0,
  wins: 0,
  dealIns: 0,
  riichi: 0,
  verdicts: { best: 0, good: 0, soso: 0, bad: 0 },
}

export const loadStats = (): PlayStats => {
  const s = load<PlayStats>(KEY_STATS)
  return s ? { ...EMPTY_STATS, ...s, verdicts: { ...EMPTY_STATS.verdicts, ...(s.verdicts ?? {}) } } : structuredClone(EMPTY_STATS)
}
export const saveStats = (s: PlayStats) => save(KEY_STATS, s)
