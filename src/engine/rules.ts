// ルール設定（カスタム可能な項目）

export interface Rules {
  /** 東風戦 / 半荘戦 */
  length: 'tonpuu' | 'hanchan'
  /** 配給原点 */
  startPoints: number
  /** 返し（原点）。オカ・西入・アガリやめの基準 */
  returnPoints: number
  /** ウマ [2着/3着の差, 1着/4着の差] 例: [10, 20] → +20 +10 -10 -20 */
  uma: [number, number]
  /** オカ（(返し-配給原点)×4 をトップ取り） */
  oka: boolean
  /** 赤ドラの枚数 */
  aka: 0 | 3 | 4
  /** 喰いタン */
  kuitan: boolean
  /** 後付け（なしの場合、鳴いた手はすべての待ちで役が確定しているときだけ和了れる） */
  atozuke: boolean
  /** 一発 */
  ippatsu: boolean
  /** 裏ドラ */
  uradora: boolean
  /** カンドラ（カン裏も含む） */
  kandora: boolean
  /** 箱下（0点未満）で終了 */
  tobi: boolean
  /** ダブロン / 頭ハネ */
  multiRon: 'double' | 'atamahane'
  /** 途中流局（九種九牌・四風連打・四家立直・四槓散了・三家和） */
  tochuRyuukyoku: boolean
  /** 流し満貫 */
  nagashiMangan: boolean
  /** 西入（オーラスで誰も返しに届かなければ延長） */
  westRound: boolean
  /** オーラスで親がトップならアガリやめ */
  agariYame: boolean
  /** 数え役満（13翻以上で役満。なしなら三倍満止まり） */
  kazoeYakuman: boolean
  /** 切り上げ満貫（4翻30符・3翻60符を満貫に） */
  kiriageMangan: boolean
  /** ダブル役満（国士13面・四暗刻単騎・純正九蓮・大四喜） */
  doubleYakuman: boolean
  /** 親の連荘条件: テンパイ連荘 / 和了連荘 */
  renchan: 'tenpai' | 'agari'
}

export const DEFAULT_RULES: Rules = {
  length: 'hanchan',
  startPoints: 25000,
  returnPoints: 30000,
  uma: [10, 20],
  oka: true,
  aka: 3,
  kuitan: true,
  atozuke: true,
  ippatsu: true,
  uradora: true,
  kandora: true,
  tobi: true,
  multiRon: 'double',
  tochuRyuukyoku: true,
  nagashiMangan: true,
  westRound: true,
  agariYame: true,
  kazoeYakuman: true,
  kiriageMangan: false,
  doubleYakuman: true,
  renchan: 'tenpai',
}

export interface RulePreset {
  id: string
  name: string
  desc: string
  rules: Rules
}

export const RULE_PRESETS: RulePreset[] = [
  {
    id: 'standard',
    name: '標準（ネット麻雀風）',
    desc: '半荘・赤3枚・喰いタン後付けあり・ウマ10-20',
    rules: DEFAULT_RULES,
  },
  {
    id: 'beginner',
    name: 'はじめて向け（東風）',
    desc: '東風戦で短く。途中流局なし・飛びなし',
    rules: {
      ...DEFAULT_RULES,
      length: 'tonpuu',
      tobi: false,
      tochuRyuukyoku: false,
      westRound: false,
    },
  },
  {
    id: 'mleague',
    name: 'プロリーグ風',
    desc: '半荘・赤3枚・ウマ10-30・途中流局なし・飛びなし・西入なし',
    rules: {
      ...DEFAULT_RULES,
      uma: [10, 30],
      tobi: false,
      tochuRyuukyoku: false,
      westRound: false,
      nagashiMangan: false,
      doubleYakuman: false,
      kiriageMangan: false,
    },
  },
  {
    id: 'classic',
    name: '昔ながら（赤なし）',
    desc: '半荘・赤なし・喰いタンなし・後付けなし・切り上げ満貫',
    rules: {
      ...DEFAULT_RULES,
      aka: 0,
      kuitan: false,
      atozuke: false,
      kiriageMangan: true,
    },
  },
]

export function normalizeRules(r: Partial<Rules> | null | undefined): Rules {
  return { ...DEFAULT_RULES, ...(r ?? {}) }
}
