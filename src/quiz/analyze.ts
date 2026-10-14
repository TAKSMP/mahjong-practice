// 定石クイズの解析：問題の「正解」と「理由の数字」は、麻雀エンジンの計算結果を使う

import { shanten, ukeire, waitingKinds, type UkeireTile } from '../engine/shanten'
import { doraFromIndicator, kindLabel, kindsToCounts, numOf, parseKinds, type Kind } from '../engine/tiles'
import { calcPayment, evaluateWin, paymentLabel, type MeldInfo, type WinResult } from '../engine/yaku'
import type { DiscardQ, Meld, SafeQ, ScoreQ, Situation, WaitQ } from './types'

export function meldInfos(melds?: Meld[]): MeldInfo[] {
  return (melds ?? []).map((m) => ({ type: m.t, kind: Math.min(...parseKinds(m.k)) }))
}

/** 副露の牌（見えている牌として数える） */
function meldKinds(melds?: Meld[]): Kind[] {
  const out: Kind[] = []
  for (const m of melds ?? []) {
    const ks = parseKinds(m.k)
    out.push(...ks)
    if (m.t === 'minkan' || m.t === 'ankan') out.push(ks[0])
  }
  return out
}

/** 自分の手以外で見えている牌 */
export function visibleOf(sit: Situation | undefined, melds: Meld[] | undefined, extra: string[] = []): number[] {
  const ks: Kind[] = [...meldKinds(melds)]
  if (sit?.dora) ks.push(...parseKinds(sit.dora))
  for (const e of extra) ks.push(...parseKinds(e))
  return kindsToCounts(ks)
}

// ---------------------------------------------------------------- 何切る

export interface DiscardRow {
  kind: Kind
  shanten: number
  tiles: UkeireTile[]
  /** 有効牌の残り枚数 */
  total: number
}

/** 手牌の各種類について「切ったらどうなるか」。良い順に並べる */
export function analyzeDiscards(q: Pick<DiscardQ, 'hand' | 'melds' | 'sit' | 'show'>): DiscardRow[] {
  const hand = parseKinds(q.hand)
  const counts = kindsToCounts(hand)
  const meldCount = q.melds?.length ?? 0
  const vis = visibleOf(q.sit, q.melds, (q.show ?? []).map((r) => r.tiles))
  const rows: DiscardRow[] = []
  for (const k of new Set(hand)) {
    counts[k]--
    const sh = shanten(counts, meldCount)
    // 切った牌は河に出る（見える牌になる）
    vis[k]++
    const uk = ukeire(counts, meldCount, vis, sh)
    vis[k]--
    counts[k]++
    rows.push({ kind: k, shanten: sh, tiles: uk.tiles, total: uk.total })
  }
  rows.sort((a, b) => a.shanten - b.shanten || b.total - a.total || a.kind - b.kind)
  return rows
}

/** 受け入れが最大（シャンテン数が最小）の牌 */
export function bestEfficiency(rows: DiscardRow[]): Kind[] {
  const top = rows[0]
  return rows.filter((r) => r.shanten === top.shanten && r.total === top.total).map((r) => r.kind)
}

// ---------------------------------------------------------------- 待ち

export interface WaitRow {
  kind: Kind
  remaining: number
}

export function analyzeWait(q: Pick<WaitQ, 'hand' | 'melds' | 'sit' | 'show' | 'river'>): { waits: WaitRow[]; furiten: boolean } {
  const hand = parseKinds(q.hand)
  const counts = kindsToCounts(hand)
  const vis = visibleOf(q.sit, q.melds, [...(q.show ?? []).map((r) => r.tiles), q.river ?? ''])
  const kinds = waitingKinds(counts, q.melds?.length ?? 0)
  const river = new Set(parseKinds(q.river ?? ''))
  const waits = kinds.map((k) => ({ kind: k, remaining: Math.max(0, 4 - counts[k] - vis[k]) }))
  return { waits, furiten: kinds.some((k) => river.has(k)) }
}

// ---------------------------------------------------------------- 点数

export interface ScoreInfo {
  res: WinResult
  dealer: boolean
  tsumo: boolean
  /** 点数の表示（例: 3900点 / 1000-2000点） */
  pointLabel: string
  /** 問いに対するエンジンの答え */
  answer: string
}

const SCORE_RULES = { kuitan: true, kazoeYakuman: true, kiriageMangan: false, doubleYakuman: true } as const

export function analyzeScore(q: Pick<ScoreQ, 'win' | 'ask'>): ScoreInfo | null {
  const w = q.win
  const res = evaluateWin({
    closed: parseKinds(w.closed),
    melds: meldInfos(w.melds),
    winKind: parseKinds(w.winTile)[0],
    tsumo: !!w.tsumo,
    seatWind: 27 + w.sw,
    roundWind: 27 + w.rw,
    riichi: !!w.riichi,
    ippatsu: !!w.ippatsu,
    doraKinds: parseKinds(w.dora ?? '').map(doraFromIndicator),
    uraKinds: [],
    akaCount: w.aka ?? 0,
    rules: SCORE_RULES,
  })
  if (!res) return null
  const dealer = w.sw === 0
  const tsumo = !!w.tsumo
  const pointLabel = paymentLabel(res.base, dealer, tsumo)
  const answer =
    q.ask === 'han' ? `${res.han}翻` : q.ask === 'fu' ? `${res.fu}符` : q.ask === 'limit' ? res.limit || '満貫未満' : pointLabel
  return { res, dealer, tsumo, pointLabel, answer }
}

export function ronPoints(res: WinResult, dealer: boolean): number {
  return calcPayment(res.base, dealer, false, 0).ron ?? 0
}

// ---------------------------------------------------------------- 安全度

export interface SafeRow {
  kind: Kind
  /** 小さいほど安全 */
  risk: number
  /** 短い分類（現物・スジ・カベ…） */
  label: string
  /** 理由（1行） */
  detail: string
}

/** リーチ者の河と見えている牌から、各牌の放銃リスクの目安を出す */
export function analyzeSafety(q: Pick<SafeQ, 'river' | 'hand' | 'seen'>): SafeRow[] {
  const hand = parseKinds(q.hand)
  const river = parseKinds(q.river)
  const riverSet = new Set(river)
  const seenCounts = kindsToCounts([...hand, ...river, ...parseKinds(q.seen ?? '')])
  const left = (k: Kind) => 4 - seenCounts[k] // 相手が持てる残り枚数
  const name = (x: Kind) => kindLabel(x)
  const sujiText = (n: number) => ['1-4-7（イースーチー）', '2-5-8（リャンウーパー）', '3-6-9（サンローキュー）'][(n - 1) % 3]
  const rows: SafeRow[] = []
  for (const k of new Set(hand)) {
    if (riverSet.has(k)) {
      rows.push({ kind: k, risk: 0, label: '現物', detail: 'リーチした人がすでに捨てている牌。ロンされません。' })
      continue
    }
    if (k >= 27) {
      const r = left(k)
      if (r <= 0) rows.push({ kind: k, risk: 0, label: '4枚見え', detail: '4枚とも見えているので、相手は持っていません。' })
      else if (r === 1) rows.push({ kind: k, risk: 5, label: '字牌（残り1枚）', detail: '残り1枚。当たるのは単騎待ちだけ。' })
      else if (r === 2) rows.push({ kind: k, risk: 9, label: '字牌（残り2枚）', detail: '残り2枚。単騎か、2枚持ちのシャンポン待ちだけ。' })
      else rows.push({ kind: k, risk: 12, label: '字牌（見えていない）', detail: 'まだ見えていない字牌。単騎・シャンポンで当たることがあります。' })
      continue
    }
    const n = numOf(k)
    let risk = 0
    const notes: string[] = []
    let ryanmenSides = 0
    let ryanmenOpen = 0
    let kabeHit = false
    let sujiHit = 0
    // 右側のペアで待つ両面（n+1,n+2 を持って n・n+3 待ち）
    if (n <= 6) {
      ryanmenSides++
      if (riverSet.has(k + 3)) {
        sujiHit++
        notes.push(`${name(k + 3)}が現物（${sujiText(n)}のスジ）`)
      } else if (left(k + 1) <= 0 || left(k + 2) <= 0) {
        kabeHit = true
        notes.push(`${name(left(k + 1) <= 0 ? k + 1 : k + 2)}が4枚見え（カベ）`)
      } else {
        ryanmenOpen++
        risk += 10
      }
    }
    // 左側のペアで待つ両面（n-2,n-1 を持って n-3・n 待ち）
    if (n >= 4) {
      ryanmenSides++
      if (riverSet.has(k - 3)) {
        sujiHit++
        notes.push(`${name(k - 3)}が現物（${sujiText(n)}のスジ）`)
      } else if (left(k - 1) <= 0 || left(k - 2) <= 0) {
        kabeHit = true
        notes.push(`${name(left(k - 1) <= 0 ? k - 1 : k - 2)}が4枚見え（カベ）`)
      } else {
        ryanmenOpen++
        risk += 10
      }
    }
    // ペンチャン（12→3、89→7）
    if (n === 3 && left(k - 1) > 0 && left(k - 2) > 0) risk += 4
    if (n === 7 && left(k + 1) > 0 && left(k + 2) > 0) risk += 4
    // カンチャン
    if (n >= 2 && n <= 8 && left(k - 1) > 0 && left(k + 1) > 0) risk += 5
    // 単騎・シャンポン
    const r = left(k)
    if (r >= 1) risk += 3 + (r >= 2 ? 1 : 0)
    let label: string
    if (ryanmenOpen === 0 && sujiHit === 2) label = '両スジ'
    else if (ryanmenOpen === 0 && kabeHit && sujiHit === 0) label = 'カベ'
    else if (ryanmenOpen === 0) label = 'スジ'
    else if (sujiHit > 0 && ryanmenSides === 2) label = '片スジ'
    else label = '無スジ'
    let detail = notes.join('、')
    if (ryanmenOpen > 0 && !detail) detail = 'スジでもカベでもありません。両面待ちで当たる可能性があります。'
    else if (ryanmenOpen > 0) detail += '。もう片方はまだ危険です。'
    else detail += '。両面待ちで当たる形が消えています（カンチャン・単騎などは残ります）。'
    rows.push({ kind: k, risk, label, detail })
  }
  rows.sort((a, b) => a.risk - b.risk || a.kind - b.kind)
  return rows
}

// ---------------------------------------------------------------- 計算の補助（解説用）

export function shantenOfHand(hand: string, melds = 0): number {
  return shanten(kindsToCounts(parseKinds(hand)), melds)
}

/** 13枚（相当）の手の有効牌。見えている牌は考えない */
export function ukeireOfHand(hand: string, melds = 0): { shanten: number; tiles: UkeireTile[]; total: number } {
  const counts = kindsToCounts(parseKinds(hand))
  return ukeire(counts, melds, new Array(34).fill(0))
}
