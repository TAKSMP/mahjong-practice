// 定石クイズの問題データの型
// 牌は parseKinds の書き方（例: '234m567p東東'）で書く。答えは手書きだが、
// 何切る・待ち・点数・安全度は、テストでエンジンの計算結果と照らし合わせて確かめる。

export type CategoryId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface Category {
  id: CategoryId
  name: string
  icon: string
  /** 分野の説明（1〜2行） */
  blurb: string
}

export interface PatternSample {
  tiles: string
  note: string
}

/** 覚えるための「型」（定石）。問題はいずれかの型に属する */
export interface Pattern {
  id: string
  cat: CategoryId
  name: string
  /** 一言で言うと（暗記用） */
  rule: string
  /** くわしい説明 */
  detail: string
  /** 図（牌の並びと一言） */
  samples?: PatternSample[]
}

/** 局面の情報 */
export interface Situation {
  /** 場風: 0=東場 1=南場 */
  rw?: 0 | 1
  /** 自風: 0=東家(親) 1=南家 2=西家 3=北家 */
  sw?: 0 | 1 | 2 | 3
  /** ドラ表示牌 */
  dora?: string
  /** 巡目 */
  turn?: number
  /** 補足（点数状況・他家の状況など） */
  note?: string
}

/** 問題文の下に並べて見せる牌（河・副露・見えている牌など） */
export interface ShowRow {
  label: string
  tiles: string
}

export interface Meld {
  t: 'chi' | 'pon' | 'minkan' | 'ankan'
  /** 例: '345m' / '555m' */
  k: string
}

export interface QBase {
  pattern: string
  sit?: Situation
  prompt: string
  show?: ShowRow[]
  /** 解説（なぜそれが正解か） */
  why: string
  /** 他の選択肢が良くない理由・補足 */
  note?: string
  /** 正誤にかかわらず最後に出す「覚えるポイント」。省略時は型の rule を出す */
  memo?: string
}

/** 何切る：手牌の中から切る牌を選ぶ */
export interface DiscardQ extends QBase {
  type: 'discard'
  /** 手牌（ツモ牌を最後に書く。副露分は含まない） */
  hand: string
  melds?: Meld[]
  /** 正解の牌（種類） */
  answers: string
  /** 別解（正解ではないが同じくらい良い牌） */
  accept?: string
  /**
   * eff    = 最大の受け入れ（シャンテン数優先）の牌だけが正解
   * shanten = シャンテン数を戻さない牌が正解（受け入れ以外の価値を含む）
   * none   = エンジンでは確かめない判断
   */
  check: 'eff' | 'shanten' | 'none'
}

/** 待ち当て：待ち牌をすべて選ぶ */
export interface WaitQ extends QBase {
  type: 'wait'
  /** 手牌13枚（副露分は含まない） */
  hand: string
  melds?: Meld[]
  /** 選択肢にする牌の種類 */
  options: string
  /** 待ち牌（正解） */
  answers: string
  /** 自分の河（フリテンの確認用） */
  river?: string
}

/** 安全牌選び：リーチを受けて、どれを切るか */
export interface SafeQ extends QBase {
  type: 'safe'
  /** リーチした人の河（古い順。最後が宣言牌） */
  river: string
  /** 手牌（ツモ牌を最後に） */
  hand: string
  /** そのほかに見えている牌（他家の河・ドラ表示牌など。カベの判断に使う） */
  seen?: string
  answers: string
  accept?: string
}

export interface Fact {
  label: string
  /** 手牌（13枚相当。副露分は含まない） */
  hand: string
  /** 副露の数 */
  melds?: number
  /** 期待するシャンテン数（テスト用） */
  expect: number
}

/** 選択問題の答えの裏づけ（テストでエンジンと照合する） */
export type ChoiceVerify =
  | { kind: 'furiten'; hand: string; river: string; expect: boolean }
  | { kind: 'remaining'; hand: string; visible: string; expect: number }
  /** 候補の牌のうち、いちばん危険な牌（options と同じ順の牌） */
  | { kind: 'danger'; river: string; hand: string; seen?: string; candidates: string; highest: string }

/** ふつうの選択問題 */
export interface ChoiceQ extends QBase {
  type: 'choice'
  options: string[]
  answer: number
  /** 解説に出す、エンジンの計算（シャンテン数の比較など） */
  facts?: Fact[]
  verify?: ChoiceVerify
}

/** 点数・翻・符の問題 */
export interface ScoreQ extends QBase {
  type: 'score'
  win: {
    /** 手牌（和了牌を含み、副露は含まない） */
    closed: string
    melds?: Meld[]
    /** 和了牌 */
    winTile: string
    tsumo?: boolean
    riichi?: boolean
    ippatsu?: boolean
    /** ドラ表示牌 */
    dora?: string
    aka?: number
    /** 自風・場風 0=東 1=南 2=西 3=北 */
    sw: 0 | 1 | 2 | 3
    rw: 0 | 1
  }
  ask: 'han' | 'fu' | 'point' | 'limit'
  options: string[]
  answer: number
  /** エンジンが出す答え（テスト用。選択肢の正解と一致する） */
  expect: string
}

export type Question = DiscardQ | WaitQ | SafeQ | ChoiceQ | ScoreQ

/** 問題集に入れる形（id は自動で付く） */
export type QuestionData = Question & { id: string }
