// 和了判定・役・符・点数計算

import type { Rules } from './rules'
import { YAKU_BY_ID } from './yakuData'
import {
  GREEN_KINDS,
  KIND_COUNT,
  isDragon,
  isHonor,
  isSimple,
  isTerminal,
  isWind,
  isYaochu,
  kindShort,
  numOf,
  suitOf,
  type Kind,
} from './tiles'

export type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan' | 'kakan'

export interface MeldInfo {
  type: MeldKind
  /** 順子なら一番小さい牌、刻子・槓子ならその牌 */
  kind: Kind
}

export interface WinInput {
  /** 手の内の牌（和了牌を含む） */
  closed: Kind[]
  melds: MeldInfo[]
  winKind: Kind
  tsumo: boolean
  seatWind: Kind
  roundWind: Kind
  riichi?: boolean
  doubleRiichi?: boolean
  ippatsu?: boolean
  haitei?: boolean
  houtei?: boolean
  rinshan?: boolean
  chankan?: boolean
  tenhou?: boolean
  chiihou?: boolean
  /** ドラ（表示牌ではなく、ドラそのもの）。表示牌の数だけ並べる */
  doraKinds: Kind[]
  uraKinds: Kind[]
  akaCount: number
  rules: Pick<Rules, 'kuitan' | 'kazoeYakuman' | 'kiriageMangan' | 'doubleYakuman'>
}

export interface YakuHit {
  id: string
  name: string
  han: number
  /** 役満の倍数（役満でなければ undefined） */
  yakuman?: number
}

export type WaitType = 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon' | 'chiitoi' | 'kokushi'

export interface WinResult {
  yaku: YakuHit[]
  /** ドラ込みの翻数（役満なら 0） */
  han: number
  fu: number
  yakuman: number
  dora: number
  ura: number
  aka: number
  /** 基本点 */
  base: number
  limit: string
  fuDetail: { label: string; fu: number }[]
  wait: WaitType
}

type GroupType = 'shuntsu' | 'koutsu' | 'kantsu'
interface Group {
  type: GroupType
  kind: Kind
  /** 鳴いた面子、またはロンで完成した刻子 */
  open: boolean
  /** 副露（暗槓含む）由来か */
  fromMeld: boolean
}

const groupKinds = (g: Group): Kind[] =>
  g.type === 'shuntsu' ? [g.kind, g.kind + 1, g.kind + 2] : g.type === 'koutsu' ? [g.kind, g.kind, g.kind] : [g.kind, g.kind, g.kind, g.kind]

const groupHasYaochu = (g: Group) => groupKinds(g).some(isYaochu)
const groupHasTerminal = (g: Group) => groupKinds(g).some(isTerminal)

/** 面子だけへの分解をすべて列挙 */
function decomposeMentsu(c: number[], start: number, acc: Group[], out: Group[][]) {
  let i = start
  while (i < KIND_COUNT && c[i] === 0) i++
  if (i === KIND_COUNT) {
    out.push(acc.slice())
    return
  }
  if (c[i] >= 3) {
    c[i] -= 3
    acc.push({ type: 'koutsu', kind: i, open: false, fromMeld: false })
    decomposeMentsu(c, i, acc, out)
    acc.pop()
    c[i] += 3
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--, c[i + 1]--, c[i + 2]--
    acc.push({ type: 'shuntsu', kind: i, open: false, fromMeld: false })
    decomposeMentsu(c, i, acc, out)
    acc.pop()
    c[i]++, c[i + 1]++, c[i + 2]++
  }
}

/** 4面子1雀頭への分解（手の内のみ）。[雀頭, 面子[]] の一覧 */
export function decomposeAgari(counts: number[]): { pair: Kind; groups: Group[] }[] {
  const res: { pair: Kind; groups: Group[] }[] = []
  const total = counts.reduce((a, b) => a + b, 0)
  if (total % 3 !== 2) return res
  const c = counts.slice()
  for (let p = 0; p < KIND_COUNT; p++) {
    if (c[p] < 2) continue
    c[p] -= 2
    const out: Group[][] = []
    decomposeMentsu(c, 0, [], out)
    for (const groups of out) res.push({ pair: p, groups })
    c[p] += 2
  }
  return res
}

export function isChiitoiShape(counts: number[]): boolean {
  let pairs = 0
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 0) continue
    if (counts[k] !== 2) return false
    pairs++
  }
  return pairs === 7
}

export function isKokushiShape(counts: number[]): boolean {
  let pair = false
  let total = 0
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 0) continue
    if (!isYaochu(k)) return false
    if (counts[k] === 2) {
      if (pair) return false
      pair = true
    } else if (counts[k] !== 1) return false
    total += counts[k]
  }
  return pair && total === 14
}

const ceil100 = (x: number) => Math.ceil(x / 100) * 100
const ceil10 = (x: number) => Math.ceil(x / 10) * 10

function yakuHit(id: string, han: number, nameOverride?: string): YakuHit {
  return { id, name: nameOverride ?? YAKU_BY_ID[id]?.name ?? id, han }
}

function yakumanHit(id: string, mult: number, nameOverride?: string): YakuHit {
  return { id, name: nameOverride ?? YAKU_BY_ID[id]?.name ?? id, han: 13 * mult, yakuman: mult }
}

const WIND_JP = ['東', '南', '西', '北']
const DRAGON_JP = ['白', '發', '中']

function countDora(input: WinInput) {
  const all: Kind[] = input.closed.slice()
  for (const m of input.melds) {
    if (m.type === 'chi') all.push(m.kind, m.kind + 1, m.kind + 2)
    else if (m.type === 'pon') all.push(m.kind, m.kind, m.kind)
    else all.push(m.kind, m.kind, m.kind, m.kind)
  }
  let dora = 0
  for (const d of input.doraKinds) for (const k of all) if (k === d) dora++
  let ura = 0
  if (input.riichi || input.doubleRiichi) for (const d of input.uraKinds) for (const k of all) if (k === d) ura++
  return { dora, ura, aka: input.akaCount, all }
}

function limitFor(han: number, fu: number, rules: WinInput['rules']): { base: number; limit: string } {
  if (han >= 13) return rules.kazoeYakuman ? { base: 8000, limit: '数え役満' } : { base: 6000, limit: '三倍満' }
  if (han >= 11) return { base: 6000, limit: '三倍満' }
  if (han >= 8) return { base: 4000, limit: '倍満' }
  if (han >= 6) return { base: 3000, limit: '跳満' }
  if (han >= 5) return { base: 2000, limit: '満貫' }
  const base = fu * Math.pow(2, han + 2)
  if (base >= 2000) return { base: 2000, limit: '満貫' }
  if (rules.kiriageMangan && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) return { base: 2000, limit: '満貫' }
  return { base, limit: '' }
}

function yakumanLimit(n: number): string {
  if (n <= 1) return '役満'
  return ['', '役満', 'ダブル役満', 'トリプル役満'][n] ?? `${n}倍役満`
}

/** 状況役（リーチ・ツモ・一発など）を足す */
function situationalYaku(input: WinInput, menzen: boolean): YakuHit[] {
  const y: YakuHit[] = []
  if (input.doubleRiichi) y.push(yakuHit('doubleRiichi', 2))
  else if (input.riichi) y.push(yakuHit('riichi', 1))
  if (input.ippatsu && (input.riichi || input.doubleRiichi)) y.push(yakuHit('ippatsu', 1))
  if (menzen && input.tsumo) y.push(yakuHit('tsumo', 1))
  if (input.haitei && input.tsumo) y.push(yakuHit('haitei', 1))
  if (input.houtei && !input.tsumo) y.push(yakuHit('houtei', 1))
  if (input.rinshan && input.tsumo) y.push(yakuHit('rinshan', 1))
  if (input.chankan && !input.tsumo) y.push(yakuHit('chankan', 1))
  return y
}

function situationalYakuman(input: WinInput): YakuHit[] {
  const y: YakuHit[] = []
  if (input.tenhou) y.push(yakumanHit('tenhou', 1))
  if (input.chiihou) y.push(yakumanHit('chiihou', 1))
  return y
}

/** 色系の役（混一色・清一色）。kinds = 全牌 */
function colorYaku(kinds: Kind[], menzen: boolean): YakuHit[] {
  const suits = new Set(kinds.filter((k) => !isHonor(k)).map(suitOf))
  const hasHonor = kinds.some(isHonor)
  if (suits.size === 1) {
    if (hasHonor) return [yakuHit('honitsu', menzen ? 3 : 2)]
    return [yakuHit('chinitsu', menzen ? 6 : 5)]
  }
  return []
}

function finalize(
  input: WinInput,
  yaku: YakuHit[],
  fu: number,
  fuDetail: { label: string; fu: number }[],
  wait: WaitType,
): WinResult | null {
  const yakumanList = yaku.filter((y) => y.yakuman)
  const dora = countDora(input)
  if (yakumanList.length > 0) {
    const n = yakumanList.reduce((a, y) => a + (y.yakuman ?? 0), 0)
    return {
      yaku: yakumanList,
      han: 0,
      fu,
      yakuman: n,
      dora: dora.dora,
      ura: dora.ura,
      aka: dora.aka,
      base: 8000 * n,
      limit: yakumanLimit(n),
      fuDetail,
      wait,
    }
  }
  if (yaku.length === 0) return null
  const han = yaku.reduce((a, y) => a + y.han, 0) + dora.dora + dora.ura + dora.aka
  const lim = limitFor(han, fu, input.rules)
  return {
    yaku,
    han,
    fu,
    yakuman: 0,
    dora: dora.dora,
    ura: dora.ura,
    aka: dora.aka,
    base: lim.base,
    limit: lim.limit,
    fuDetail,
    wait,
  }
}

function better(a: WinResult | null, b: WinResult | null): WinResult | null {
  if (!a) return b
  if (!b) return a
  if (b.base !== a.base) return b.base > a.base ? b : a
  if (b.han !== a.han) return b.han > a.han ? b : a
  return b.fu > a.fu ? b : a
}

function evaluateRegular(
  input: WinInput,
  pair: Kind,
  closedGroups: Group[],
  meldGroups: Group[],
  wait: WaitType,
  winGroup: number,
): WinResult | null {
  const { rules, seatWind, roundWind } = input
  // ロンで完成した刻子は明刻扱い
  const cg = closedGroups.map((g, i) => (i === winGroup && wait === 'shanpon' && !input.tsumo ? { ...g, open: true } : g))
  const groups = [...cg, ...meldGroups]
  const menzen = meldGroups.every((g) => !g.open)
  const allKinds: Kind[] = [pair, pair, ...groups.flatMap(groupKinds)]
  const yaku: YakuHit[] = []

  // ---- 役満 ----
  const ym: YakuHit[] = situationalYakuman(input)
  const pungs = groups.filter((g) => g.type !== 'shuntsu')
  const pungKinds = pungs.map((g) => g.kind)
  const concealedPungs = pungs.filter((g) => !g.open).length
  const kans = groups.filter((g) => g.type === 'kantsu').length
  if ([31, 32, 33].every((k) => pungKinds.includes(k))) ym.push(yakumanHit('daisangen', 1))
  if (concealedPungs === 4) {
    const tanki = wait === 'tanki'
    ym.push(yakumanHit('suuankou', tanki && rules.doubleYakuman ? 2 : 1, tanki ? '四暗刻単騎' : undefined))
  }
  if (allKinds.every(isHonor)) ym.push(yakumanHit('tsuuiisou', 1))
  if (allKinds.every((k) => GREEN_KINDS.has(k))) ym.push(yakumanHit('ryuuiisou', 1))
  if (allKinds.every(isTerminal)) ym.push(yakumanHit('chinroutou', 1))
  const windPungs = pungKinds.filter(isWind).length
  if (windPungs === 4) ym.push(yakumanHit('daisuushii', rules.doubleYakuman ? 2 : 1))
  else if (windPungs === 3 && isWind(pair)) ym.push(yakumanHit('shousuushii', 1))
  if (kans === 4) ym.push(yakumanHit('suukantsu', 1))
  if (menzen) {
    const suits = new Set(allKinds.map(suitOf))
    if (suits.size === 1 && !isHonor(allKinds[0])) {
      const s = suitOf(allKinds[0]) * 9
      const c = new Array(9).fill(0)
      for (const k of allKinds) c[k - s]++
      const need = [3, 1, 1, 1, 1, 1, 1, 1, 3]
      if (need.every((n, i) => c[i] >= n)) {
        c[input.winKind - s]--
        const junsei = need.every((n, i) => c[i] === n)
        ym.push(yakumanHit('chuuren', junsei && rules.doubleYakuman ? 2 : 1, junsei ? '純正九蓮宝燈' : undefined))
      }
    }
  }
  if (ym.length > 0) return finalize(input, ym, 0, [], wait)

  // ---- 通常役 ----
  yaku.push(...situationalYaku(input, menzen))

  const isYakuhaiPair = isDragon(pair) || pair === seatWind || pair === roundWind
  const allShuntsu = groups.every((g) => g.type === 'shuntsu')
  const pinfu = menzen && allShuntsu && !isYakuhaiPair && wait === 'ryanmen'
  if (pinfu) yaku.push(yakuHit('pinfu', 1))

  if (allKinds.every(isSimple) && (menzen || rules.kuitan)) yaku.push(yakuHit('tanyao', 1))

  if (menzen) {
    const seqs = groups.filter((g) => g.type === 'shuntsu').map((g) => g.kind)
    const cnt = new Map<number, number>()
    for (const s of seqs) cnt.set(s, (cnt.get(s) ?? 0) + 1)
    let peiko = 0
    for (const v of cnt.values()) peiko += Math.floor(v / 2)
    if (peiko >= 2) yaku.push(yakuHit('ryanpeikou', 3))
    else if (peiko === 1) yaku.push(yakuHit('iipeiko', 1))
  }

  for (const g of pungs) {
    if (isDragon(g.kind)) yaku.push(yakuHit('yakuhai', 1, `役牌 ${DRAGON_JP[g.kind - 31]}`))
    if (g.kind === roundWind) yaku.push(yakuHit('yakuhai', 1, `場風 ${WIND_JP[g.kind - 27]}`))
    if (g.kind === seatWind) yaku.push(yakuHit('yakuhai', 1, `自風 ${WIND_JP[g.kind - 27]}`))
  }

  const seqKinds = groups.filter((g) => g.type === 'shuntsu').map((g) => g.kind)
  for (let n = 0; n < 7; n++) {
    if ([0, 9, 18].every((s) => seqKinds.includes(s + n))) {
      yaku.push(yakuHit('sanshoku', menzen ? 2 : 1))
      break
    }
  }
  for (const s of [0, 9, 18]) {
    if ([0, 3, 6].every((o) => seqKinds.includes(s + o))) {
      yaku.push(yakuHit('ittsu', menzen ? 2 : 1))
      break
    }
  }

  const hasSeq = seqKinds.length > 0
  if (hasSeq && groups.every(groupHasYaochu) && isYaochu(pair)) {
    if (allKinds.some(isHonor)) yaku.push(yakuHit('chanta', menzen ? 2 : 1))
    else if (groups.every(groupHasTerminal)) yaku.push(yakuHit('junchan', menzen ? 3 : 2))
  }

  if (pungs.length === 4) yaku.push(yakuHit('toitoi', 2))
  if (concealedPungs === 3) yaku.push(yakuHit('sanankou', 2))
  for (let n = 0; n < 9; n++) {
    if ([0, 9, 18].every((s) => pungKinds.includes(s + n))) {
      yaku.push(yakuHit('sanshokuDoukou', 2))
      break
    }
  }
  if (kans === 3) yaku.push(yakuHit('sankantsu', 2))
  if (pungKinds.filter(isDragon).length === 2 && isDragon(pair)) yaku.push(yakuHit('shousangen', 2))
  if (allKinds.every(isYaochu)) yaku.push(yakuHit('honroutou', 2))
  yaku.push(...colorYaku(allKinds, menzen))

  // ---- 符 ----
  const fuDetail: { label: string; fu: number }[] = []
  let fu: number
  if (pinfu) {
    fu = input.tsumo ? 20 : 30
    fuDetail.push({ label: input.tsumo ? '平和ツモ' : '平和ロン（副底20＋門前ロン10）', fu })
  } else {
    let f = 20
    fuDetail.push({ label: '副底', fu: 20 })
    if (menzen && !input.tsumo) {
      f += 10
      fuDetail.push({ label: '門前ロン', fu: 10 })
    }
    if (input.tsumo) {
      f += 2
      fuDetail.push({ label: 'ツモ', fu: 2 })
    }
    for (const g of groups) {
      if (g.type === 'shuntsu') continue
      let v = 2
      if (isYaochu(g.kind)) v *= 2
      if (!g.open) v *= 2
      if (g.type === 'kantsu') v *= 4
      f += v
      const name = `${g.open ? '明' : '暗'}${g.type === 'kantsu' ? '槓' : '刻'} ${kindShort(g.kind)}`
      fuDetail.push({ label: name, fu: v })
    }
    let pf = 0
    if (isDragon(pair)) pf += 2
    if (pair === seatWind) pf += 2
    if (pair === roundWind) pf += 2
    if (pf) {
      f += pf
      fuDetail.push({ label: `役牌の雀頭 ${kindShort(pair)}`, fu: pf })
    }
    if (wait === 'kanchan' || wait === 'penchan' || wait === 'tanki') {
      f += 2
      fuDetail.push({ label: { kanchan: '嵌張待ち', penchan: '辺張待ち', tanki: '単騎待ち' }[wait], fu: 2 })
    }
    fu = ceil10(f)
    if (!menzen && fu === 20) fu = 30
  }
  return finalize(input, yaku, fu, fuDetail, wait)
}

function meldToGroup(m: MeldInfo): Group {
  if (m.type === 'chi') return { type: 'shuntsu', kind: m.kind, open: true, fromMeld: true }
  if (m.type === 'pon') return { type: 'koutsu', kind: m.kind, open: true, fromMeld: true }
  return { type: 'kantsu', kind: m.kind, open: m.type !== 'ankan', fromMeld: true }
}

/**
 * 和了の評価。役がない・和了形でない場合は null。
 * 複数の解釈がある場合は一番高い点数を返す。
 */
export function evaluateWin(input: WinInput): WinResult | null {
  const counts = new Array(KIND_COUNT).fill(0)
  for (const k of input.closed) counts[k]++
  const meldGroups = input.melds.map(meldToGroup)
  let best: WinResult | null = null

  // 国士無双
  if (input.melds.length === 0 && isKokushiShape(counts)) {
    const thirteen = counts[input.winKind] === 2
    const ym = situationalYakuman(input)
    ym.push(yakumanHit('kokushi', thirteen && input.rules.doubleYakuman ? 2 : 1, thirteen ? '国士無双十三面' : undefined))
    return finalize(input, ym, 0, [], 'kokushi')
  }

  // 七対子
  if (input.melds.length === 0 && isChiitoiShape(counts)) {
    const all = input.closed
    const ym = situationalYakuman(input)
    if (all.every(isHonor)) ym.push(yakumanHit('tsuuiisou', 1))
    if (ym.length > 0) {
      best = better(best, finalize(input, ym, 25, [], 'chiitoi'))
    } else {
      const yaku: YakuHit[] = [...situationalYaku(input, true), yakuHit('chiitoitsu', 2)]
      if (all.every(isSimple)) yaku.push(yakuHit('tanyao', 1))
      if (all.every(isYaochu)) yaku.push(yakuHit('honroutou', 2))
      yaku.push(...colorYaku(all, true))
      best = better(best, finalize(input, yaku, 25, [{ label: '七対子', fu: 25 }], 'chiitoi'))
    }
  }

  // 一般形
  for (const { pair, groups } of decomposeAgari(counts)) {
    const w = input.winKind
    if (pair === w) best = better(best, evaluateRegular(input, pair, groups, meldGroups, 'tanki', -1))
    groups.forEach((g, i) => {
      if (g.type === 'koutsu' && g.kind === w) {
        best = better(best, evaluateRegular(input, pair, groups, meldGroups, 'shanpon', i))
      } else if (g.type === 'shuntsu' && w >= g.kind && w <= g.kind + 2) {
        let wait: WaitType
        if (w === g.kind + 1) wait = 'kanchan'
        else if (w === g.kind) wait = numOf(g.kind) === 7 ? 'penchan' : 'ryanmen'
        else wait = numOf(g.kind) === 1 ? 'penchan' : 'ryanmen'
        best = better(best, evaluateRegular(input, pair, groups, meldGroups, wait, i))
      }
    })
  }
  return best
}

/** 点数の支払い */
export interface Payment {
  /** ロンの場合：放銃者が払う額（本場込み） */
  ron?: number
  /** ツモの場合：親が払う額 / 子が払う額（本場込み） */
  tsumoDealer?: number
  tsumoChild?: number
  /** 和了者の収入合計（本場込み・供託除く） */
  total: number
}

export function calcPayment(base: number, winnerIsDealer: boolean, tsumo: boolean, honba: number): Payment {
  if (!tsumo) {
    const p = ceil100(base * (winnerIsDealer ? 6 : 4)) + honba * 300
    return { ron: p, total: p }
  }
  if (winnerIsDealer) {
    const each = ceil100(base * 2) + honba * 100
    return { tsumoChild: each, total: each * 3 }
  }
  const d = ceil100(base * 2) + honba * 100
  const c = ceil100(base) + honba * 100
  return { tsumoDealer: d, tsumoChild: c, total: d + c * 2 }
}

/** 表示用：点数の文字列（例: 3900 / 1000-2000 / 2000オール） */
export function paymentLabel(base: number, winnerIsDealer: boolean, tsumo: boolean): string {
  const p = calcPayment(base, winnerIsDealer, tsumo, 0)
  if (!tsumo) return `${p.ron}点`
  if (winnerIsDealer) return `${p.tsumoChild}点オール`
  return `${p.tsumoChild}-${p.tsumoDealer}点`
}

