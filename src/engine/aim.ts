// 今の手から「狙える役」を調べ、その役で和了できる見込み（%）を見積もる。
//
// 1) 役ごとに「その役の形に絞ったシャンテン数」(dist) を計算する。
//    例：断么九なら1・9・字牌を無いものとして数える／役牌なら、その牌の刻子を必須にして数える。
// 2) その役を決め打ちして進めたときに、残りの巡目で和了できる割合を、
//    見えていない牌からランダムにツモる試行（モンテカルロ）で見積もる。
//    ・自分のツモと、他家の捨て牌（ロン・ポン・チー）を考える
//    ・他家の和了や、他家に鳴かれて牌が来なくなることは考えない（あくまで目安）

import {
  liveRemaining,
  meldInfo,
  seatWindIndex,
  visibleCounts,
  type GameState,
} from './game'
import type { Rules } from './rules'
import { shanten, shantenChiitoi, shantenKokushi, shantenNormalEx, shantenToitoi, waitingKinds } from './shanten'
import { KIND_COUNT, isHonor, isSimple, kindOf, numOf, suitOf, type Kind } from './tiles'
import { evaluateWin, type MeldInfo, type WinResult } from './yaku'
import { YAKU_BY_ID } from './yakuData'

const INF = 99

export interface AimCtx {
  /** 自分から見て、まだ見えていない牌の枚数（他家の手牌・山の中） */
  unseen: number[]
  seatWind: Kind
  roundWind: Kind
  rules: Rules
}

/** 同じ役でも狙い方がいくつもある（三色なら数字、一気通貫・混一色なら色）。名前つきの1通り */
interface Variant {
  name: string
  dist: (c: number[], melds: MeldInfo[], ctx: AimCtx) => number
}

interface AimDef {
  key: string
  /** 役の解説（YAKU_BY_ID）のキー */
  id: string
  label: string
  /** 門前の翻数 / 鳴いたときの翻数（0 = 門前のみ） */
  han: number
  openHan: number
  /** 狙い方の候補。役のシャンテン数は、この中でいちばん近いもの */
  variants: Variant[]
  goal: (r: WinResult) => boolean
  /** シミュレーションで鳴きを使うか */
  calls: 'none' | 'pon' | 'both'
  tip: string
}

// ---------- 小さな道具 ----------
const closedMelds = (melds: MeldInfo[]) => melds.every((m) => m.type === 'ankan')
const hasId =
  (...ids: string[]) =>
  (r: WinResult) =>
    r.yaku.some((y) => ids.includes(y.id))

function sameBlock(m: MeldInfo, b: Kind[]): boolean {
  if (b[0] === b[1]) return m.type !== 'chi' && m.kind === b[0]
  return m.type === 'chi' && m.kind === b[0]
}

/**
 * 決め打ちした面子（blocks）を必ず作る前提でのシャンテン数。
 * - すでに副露で作っている面子・手牌で揃っている面子 → 完成
 * - 2枚そろっている → 搭子／1枚以下 → 枠だけ確保（0枚ならさらに+1）
 * - その面子に必要な牌が、手牌＋見えていない牌で足りなければ不可能（INF）
 */
function forcedShanten(c0: number[], melds: MeldInfo[], blocks: Kind[][], ctx: AimCtx): number {
  const used = melds.map(() => false)
  const open: Kind[][] = []
  let extraM = 0
  let matched = 0
  for (const b of blocks) {
    const idx = melds.findIndex((m, i) => !used[i] && sameBlock(m, b))
    if (idx >= 0) {
      used[idx] = true
      extraM++
      matched++
    } else open.push(b)
  }
  const need = new Array(KIND_COUNT).fill(0)
  for (const b of open) for (const k of b) need[k]++
  for (let k = 0; k < KIND_COUNT; k++) if (need[k] > 0 && c0[k] + ctx.unseen[k] < need[k]) return INF
  const c = c0.slice()
  let extraT = 0
  let reserved = 0
  let penalty = 0
  for (const b of open) {
    let e = 0
    for (const k of b) {
      if (c[k] > 0) {
        c[k]--
        e++
      }
    }
    if (e === 3) extraM++
    else if (e === 2) extraT++
    else {
      reserved++
      if (e === 0) penalty++
    }
  }
  return shantenNormalEx(c, { meldCount: melds.length - matched, extraM, extraT, reserved }) + penalty
}

/** 使える牌の種類を絞った（restrict）一般形のシャンテン数。七対子も考える（門前のみ） */
function restricted(c: number[], melds: MeldInfo[], keep: (k: Kind) => boolean, meldOk: (m: MeldInfo) => boolean): number {
  if (melds.some((m) => !meldOk(m))) return INF
  const z = c.map((v, k) => (keep(k) ? v : 0))
  let d = shantenNormalEx(z, { meldCount: melds.length })
  if (melds.length === 0) d = Math.min(d, shantenChiitoi(z))
  return d
}

const SUITS = [0, 1, 2]
const SUIT_NAME = ['萬', '筒', '索']
const DRAGON_JP = ['白', '發', '中']
const WIND_JP = ['東', '南', '西', '北']

const meldKindsOf = (m: MeldInfo): Kind[] => (m.type === 'chi' ? [m.kind, m.kind + 1, m.kind + 2] : [m.kind])
const meldAllSimple = (m: MeldInfo) => meldKindsOf(m).every(isSimple)
const meldInSuit = (m: MeldInfo, s: number, withHonor: boolean) =>
  m.type === 'chi' ? suitOf(m.kind) === s : suitOf(m.kind) === s || (withHonor && isHonor(m.kind))

// ---------- 狙える役の定義 ----------
function buildAims(ctx: AimCtx): AimDef[] {
  const y = (id: string) => YAKU_BY_ID[id]
  const defs: AimDef[] = []
  type AddArg = {
    key: string
    id: string
    label?: string
    han?: number
    openHan?: number
    dist?: Variant['dist']
    variants?: Variant[]
    goal: AimDef['goal']
    calls: AimDef['calls']
    tip: string
  }
  const add = (d: AddArg) =>
    defs.push({
      key: d.key,
      id: d.id,
      label: d.label ?? y(d.id).name,
      han: d.han ?? y(d.id).han,
      openHan: d.openHan ?? y(d.id).openHan,
      variants: d.variants ?? [{ name: '', dist: d.dist! }],
      goal: d.goal,
      calls: d.calls,
      tip: d.tip,
    })

  add({
    key: 'riichi',
    id: 'riichi',
    dist: (c, melds) => (closedMelds(melds) ? shanten(c, melds.length) : INF),
    goal: () => true,
    calls: 'none',
    tip: '鳴かずにテンパイを目指します。テンパイしたらリーチをかけると、役がなくても和了れて、裏ドラも期待できます。',
  })

  add({
    key: 'tanyao',
    id: 'tanyao',
    dist: (c, melds) => {
      if (!ctx.rules.kuitan && !closedMelds(melds)) return INF
      return restricted(c, melds, isSimple, meldAllSimple)
    },
    goal: hasId('tanyao'),
    calls: 'both',
    tip: ctx.rules.kuitan
      ? '1・9・字牌を先に切って、2〜8の牌を集めます。鳴いても成立するルールなので、ポン・チーでスピードアップもできます。'
      : '1・9・字牌を先に切って、2〜8の牌を集めます。このルールでは鳴くと成立しないので、鳴かずに進めましょう。',
  })

  add({
    key: 'pinfu',
    id: 'pinfu',
    dist: (c, melds) => {
      if (melds.length > 0) return INF
      const z = c.slice()
      for (const k of [31, 32, 33, ctx.roundWind, ctx.seatWind]) z[k] = 0 // 役牌は雀頭にできない
      return shantenNormalEx(z, { noTriplets: true })
    },
    goal: hasId('pinfu'),
    calls: 'none',
    tip: '順子（連続した数字）だけで作り、雀頭は役牌以外にします。両面待ちでテンパイすると成立。同じ牌を3枚そろえる刻子は作らないのがコツです。',
  })

  // 役牌（白・發・中・場風・自風）
  const yakuhaiKinds = [...new Set([31, 32, 33, ctx.roundWind, ctx.seatWind])]
  for (const k of yakuhaiKinds) {
    const names: string[] = []
    let label: string
    let han = 0
    if (k >= 31) {
      names.push(`役牌 ${DRAGON_JP[k - 31]}`)
      label = `役牌 ${DRAGON_JP[k - 31]}`
      han = 1
    } else {
      const w = WIND_JP[k - 27]
      if (k === ctx.roundWind) {
        names.push(`場風 ${w}`)
        han++
      }
      if (k === ctx.seatWind) {
        names.push(`自風 ${w}`)
        han++
      }
      label = han === 2 ? `ダブ${w}（場風＋自風）` : k === ctx.roundWind ? `場風 ${w}` : `自風 ${w}`
    }
    add({
      key: `yakuhai-${k}`,
      id: 'yakuhai',
      label,
      han,
      openHan: han,
      dist: (c, melds) => forcedShanten(c, melds, [[k, k, k]], ctx),
      goal: (r) => r.yaku.some((h) => names.includes(h.name)),
      calls: 'pon',
      tip: `${label.replace(/（.*）/, '')}を2枚持っているときが狙い目。他家が捨てたらポンして、${han}翻を確定させましょう。鳴いても翻数は変わりません。`,
    })
  }

  add({
    key: 'iipeiko',
    id: 'iipeiko',
    variants: SUITS.flatMap((su) =>
      [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const st = su * 9 + i
        return {
          name: `${i + 1}${i + 2}${i + 3}${SUIT_NAME[su]}の順子を2組`,
          dist: (c: number[], melds: MeldInfo[]) =>
            melds.length > 0 ? INF : forcedShanten(c, melds, [[st, st + 1, st + 2], [st, st + 1, st + 2]], ctx),
        }
      }),
    ),
    goal: hasId('iipeiko', 'ryanpeikou'),
    calls: 'none',
    tip: '同じ順子を2組作ります（例：二二三三四四萬）。鳴かずに進める必要があります。',
  })

  add({
    key: 'chiitoi',
    id: 'chiitoitsu',
    dist: (c, melds) => (melds.length > 0 ? INF : shantenChiitoi(c)),
    goal: hasId('chiitoitsu'),
    calls: 'none',
    tip: '対子（同じ牌2枚の組）を7組集めます。待ちは1種類の単騎なので、字牌など出やすい牌で待つのがコツです。',
  })

  add({
    key: 'sanshoku',
    id: 'sanshoku',
    variants: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      name: `萬・筒・索の ${n}${n + 1}${n + 2} をそろえる`,
      dist: (c: number[], melds: MeldInfo[]) =>
        forcedShanten(c, melds, SUITS.map((su) => [su * 9 + n - 1, su * 9 + n, su * 9 + n + 1]), ctx),
    })),
    goal: hasId('sanshoku'),
    calls: 'both',
    tip: '萬子・筒子・索子で、同じ数字の順子（例：345）を1組ずつ作ります。真ん中の数字の順子が作りやすいです。',
  })

  add({
    key: 'ittsu',
    id: 'ittsu',
    variants: SUITS.map((su) => ({
      name: `${SUIT_NAME[su]}子の 123・456・789`,
      dist: (c: number[], melds: MeldInfo[]) =>
        forcedShanten(c, melds, [[su * 9, su * 9 + 1, su * 9 + 2], [su * 9 + 3, su * 9 + 4, su * 9 + 5], [su * 9 + 6, su * 9 + 7, su * 9 + 8]], ctx),
    })),
    goal: hasId('ittsu'),
    calls: 'both',
    tip: '同じ種類の数牌で、123・456・789の順子を1組ずつそろえます。',
  })

  add({
    key: 'toitoi',
    id: 'toitoi',
    dist: (c, melds) => (melds.some((m) => m.type === 'chi') ? INF : shantenToitoi(c, melds.length)),
    goal: hasId('toitoi'),
    calls: 'pon',
    tip: '同じ牌を3枚ずつ集めて、刻子4つと雀頭で作ります。対子がたくさんあるときはポンで進めます。',
  })

  add({
    key: 'honitsu',
    id: 'honitsu',
    variants: SUITS.map((su) => ({
      name: `${SUIT_NAME[su]}子＋字牌`,
      dist: (c: number[], melds: MeldInfo[]) =>
        restricted(c, melds, (k) => isHonor(k) || suitOf(k) === su, (m) => meldInSuit(m, su, true)),
    })),
    goal: hasId('honitsu', 'chinitsu'),
    calls: 'both',
    tip: '1種類の数牌と字牌だけで作ります。他の色の牌を先に切り、ポン・チーを使うとスピードが上がります。',
  })

  add({
    key: 'chinitsu',
    id: 'chinitsu',
    variants: SUITS.map((su) => ({
      name: `${SUIT_NAME[su]}子`,
      dist: (c: number[], melds: MeldInfo[]) =>
        restricted(c, melds, (k) => !isHonor(k) && suitOf(k) === su, (m) => !isHonor(m.kind) && meldInSuit(m, su, false)),
    })),
    goal: hasId('chinitsu'),
    calls: 'both',
    tip: '1種類の数牌だけで作ります。難しいですが、成功すると6翻（鳴いても5翻）の大きな手になります。',
  })

  add({
    key: 'daisangen',
    id: 'daisangen',
    dist: (c, melds) => forcedShanten(c, melds, [[31, 31, 31], [32, 32, 32], [33, 33, 33]], ctx),
    goal: hasId('daisangen'),
    calls: 'pon',
    tip: '白・發・中をすべて刻子（3枚ずつ）にします。ポンでもOK。役満です。',
  })

  add({
    key: 'kokushi',
    id: 'kokushi',
    dist: (c, melds) => (melds.length > 0 ? INF : shantenKokushi(c)),
    goal: hasId('kokushi'),
    calls: 'none',
    tip: '1・9・字牌の13種類を1枚ずつ集めて、どれか1つを対子にします。13種のうち9種以上そろってから狙うのが目安です。',
  })

  return defs
}

// ---------- 結果の型 ----------
export interface AimRow {
  key: string
  /** 役の解説（YAKU_BY_ID）のキー */
  id: string
  label: string
  han: number
  openHan: number
  /** いまの鳴き状況での翻数 */
  hanNow: number
  closedOnly: boolean
  /** この役の形に絞ったシャンテン数（-1 = 完成） */
  dist: number
  /** 和了できる見込み（0〜1）。null = 計算中 */
  prob: number | null
  needed: { kind: Kind; remaining: number }[]
  neededTotal: number
  keep: Kind[]
  junk: Kind[]
  /** 状況の説明（1行ずつ） */
  lines: string[]
  tip: string
  yakuman: boolean
}

export interface AimSnapshot {
  rows: AimRow[]
  done: boolean
  /** 試行回数（1役あたり） */
  trials: number
  /** 残りの巡目（自分のツモ回数） */
  draws: number
  /** 残りのツモ回数が0のとき、ロンだけが見込み */
  summary: string
}

export function distText(d: number): string {
  if (d < 0) return '完成しています'
  if (d === 0) return 'テンパイ（あと1枚で完成）'
  return `${d}シャンテン（あと${d}枚でテンパイ）`
}

// ---------- 乱数 ----------
function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- シミュレーション ----------
interface Start {
  counts: number[]
  melds: MeldInfo[]
  discarded: Uint8Array
  pool: Uint8Array
  draws: number
  drawnKind: Kind
  /** いまが局の何巡目か（他家の和了で局が終わる確率の計算に使う） */
  turnNow: number
  ctx: AimCtx
}

/** 狙っている役の形に絞ったシャンテン数（狙い方の候補のうち最小） */
type DistFn = (c: number[], melds: MeldInfo[]) => number

/**
 * 局がまだ続いている確率（他家の和了などで終わっていない）。
 * 平均して12巡目ごろに誰かが和了る、という実際の対局の傾向に合わせた近似。
 */
function survival(t: number): number {
  return 1 - 0.75 / (1 + Math.exp(-(t - 12) / 1.9))
}

function isoScore(k: Kind, c: number[]): number {
  let sc = 0
  if (c[k] === 1) sc += 10
  if (isHonor(k)) sc += 8
  else {
    const n = numOf(k)
    let near = 0
    for (const d of [-2, -1, 1, 2]) {
      const m = n + d
      if (m >= 1 && m <= 9) near += c[k + d]
    }
    if (near === 0) sc += 6
    if (n === 1 || n === 9) sc += 4
    else if (n === 2 || n === 8) sc += 2
  }
  return sc
}

/** 切る牌を選ぶ：その役の形に絞ったシャンテン数を保てる牌のうち、いちばん不要そうな牌 */
function pickDiscard(dist: DistFn, c: number[], melds: MeldInfo[]): { k: Kind; d: number } {
  const d14 = dist(c, melds)
  const order: Kind[] = []
  for (let k = 0; k < KIND_COUNT; k++) if (c[k] > 0) order.push(k)
  const sc = new Map<Kind, number>()
  for (const k of order) sc.set(k, isoScore(k, c))
  order.sort((a, b) => sc.get(b)! - sc.get(a)!)
  let bestK = order[0]
  let bestD = INF + 1
  for (const k of order) {
    c[k]--
    const d = dist(c, melds)
    c[k]++
    if (d < bestD) {
      bestD = d
      bestK = k
    }
    if (d <= d14) break
  }
  return { k: bestK, d: bestD }
}

function evalWin(def: AimDef, c: number[], melds: MeldInfo[], winKind: Kind, tsumo: boolean, ctx: AimCtx): boolean {
  const closed: Kind[] = []
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < c[k]; i++) closed.push(k)
  const r = evaluateWin({
    closed,
    melds,
    winKind,
    tsumo,
    seatWind: ctx.seatWind,
    roundWind: ctx.roundWind,
    doraKinds: [],
    uraKinds: [],
    akaCount: 0,
    rules: ctx.rules,
  })
  return !!r && def.goal(r)
}

/** 1回の試行。和了できたら、その重み（局が続いている確率）を、できなければ 0 を返す */
function runTrial(def: AimDef, dist: DistFn, st: Start, rng: () => number): number {
  const ctx = st.ctx
  const c = st.counts.slice()
  let melds = st.melds
  const disc = st.discarded.slice()
  const pool = st.pool.slice()
  let n = pool.length
  const pick = (): Kind => {
    const j = Math.floor(rng() * n)
    const v = pool[j]
    pool[j] = pool[--n]
    return v
  }
  const isRiichi = def.key === 'riichi'
  let locked = false
  let waits: Kind[] = []
  let furiten = false
  let curD = INF
  let drawsLeft = st.draws
  const s0 = survival(st.turnNow)
  const weight = () => survival(st.turnNow + (st.draws - drawsLeft)) / s0

  const afterDiscard = (d: number) => {
    curD = d
    if (isRiichi && !locked && d === 0 && closedMelds(melds)) {
      locked = true
      waits = waitingKinds(c, melds.length)
      furiten = waits.some((w) => disc[w] === 1)
    }
  }
  const discardNow = () => {
    const { k, d } = pickDiscard(dist, c, melds)
    c[k]--
    disc[k] = 1
    afterDiscard(d)
  }

  /** 他家の捨て牌3枚（ロン・ポン・チーの機会）。和了できたら true */
  const opponents = (): boolean => {
    for (let j = 0; j < 3 && n > 0; j++) {
      const k = pick()
      if (locked) {
        if (!furiten && waits.includes(k)) return true
        continue
      }
      if (curD === 0 && !isRiichi && disc[k] === 0) {
        c[k]++
        const ok = dist(c, melds) === -1 && evalWin(def, c, melds, k, false, ctx)
        c[k]--
        if (ok) return true
      }
      if (def.calls === 'none' || curD <= 0) continue
      // ポン
      if (c[k] >= 2) {
        c[k] -= 2
        const m2 = melds.concat({ type: 'pon', kind: k })
        if (dist(c, m2) < curD) {
          melds = m2
          discardNow()
          continue
        }
        c[k] += 2
      }
      // チー（上家の捨て牌 = 3枚のうち最初の1枚だけ）
      if (def.calls === 'both' && j === 0 && !isHonor(k)) {
        const nk = numOf(k)
        let bestSt = -1
        let bestD = curD
        for (const stt of [k - 2, k - 1, k]) {
          const sn = nk - (k - stt)
          if (sn < 1 || sn > 7) continue
          const others = [stt, stt + 1, stt + 2].filter((x) => x !== k)
          if (!others.every((x) => c[x] > 0)) continue
          for (const x of others) c[x]--
          const d = dist(c, melds.concat({ type: 'chi', kind: stt }))
          for (const x of others) c[x]++
          if (d < bestD) {
            bestD = d
            bestSt = stt
          }
        }
        if (bestSt >= 0) {
          for (const x of [bestSt, bestSt + 1, bestSt + 2]) if (x !== k) c[x]--
          melds = melds.concat({ type: 'chi', kind: bestSt })
          discardNow()
        }
      }
    }
    return false
  }

  let sum = 0
  for (let k = 0; k < KIND_COUNT; k++) sum += c[k]
  if (sum % 3 === 2) {
    // いま自分の番（14枚）。完成していればそのまま和了
    if (!isRiichi && st.drawnKind >= 0 && dist(c, melds) === -1 && evalWin(def, c, melds, st.drawnKind, true, ctx)) return 1
    discardNow()
    if (opponents()) return weight()
  } else {
    afterDiscard(dist(c, melds))
  }

  while (drawsLeft > 0 && n > 0) {
    drawsLeft--
    const k = pick()
    c[k]++
    if (locked) {
      if (waits.includes(k)) return weight()
      c[k]--
      disc[k] = 1
      if (opponents()) return weight()
      continue
    }
    if (!isRiichi && dist(c, melds) === -1 && evalWin(def, c, melds, k, true, ctx)) return weight()
    discardNow()
    if (opponents()) return weight()
  }
  return 0
}

// ---------- 一覧の作成 ----------
export interface AimJob {
  snapshot(): AimSnapshot
  /** budgetMs の間だけ計算を進める。すべて終わったら true */
  step(budgetMs: number): boolean
}

function hashCounts(c: number[], melds: MeldInfo[], draws: number): number {
  let h = 2166136261
  for (let k = 0; k < KIND_COUNT; k++) h = Math.imul(h ^ (c[k] + 1), 16777619)
  for (const m of melds) h = Math.imul(h ^ (m.kind * 7 + m.type.length), 16777619)
  return Math.imul(h ^ draws, 16777619)
}

/** 見込みを出す対象にする、形に絞ったシャンテン数の上限 */
const MAX_DIST = 4
/** シミュレーションで使う狙い方の候補数（いま最も近い順） */
const KEEP_VARIANTS = 2
/** 序盤の試行で、ほとんど和了できなければ早めに打ち切る */
const EARLY_STOP_AT = 40

export function createAimJob(s: GameState, seat = 0, trials = 100): AimJob {
  const p = s.players[seat]
  const counts = new Array(KIND_COUNT).fill(0)
  for (const t of p.hand) counts[kindOf(t)]++
  const melds: MeldInfo[] = p.melds.map(meldInfo)
  const visible = visibleCounts(s, seat)
  const unseen = counts.map((v, k) => Math.max(0, 4 - visible[k] - v))
  const pool = new Uint8Array(unseen.reduce((a, b) => a + b, 0))
  {
    let i = 0
    for (let k = 0; k < KIND_COUNT; k++) for (let j = 0; j < unseen[k]; j++) pool[i++] = k
  }
  const discarded = new Uint8Array(KIND_COUNT)
  for (const d of p.discards) discarded[kindOf(d.tile)] = 1
  const ctx: AimCtx = { unseen, seatWind: 27 + seatWindIndex(s, seat), roundWind: 27 + s.roundWind, rules: s.rules }
  const live = liveRemaining(s)
  const draws = Math.max(0, Math.ceil(live / 4))
  const turnNow = Math.max(0, Math.round((70 - live) / 4))
  const start: Start = { counts, melds, discarded, pool, draws, drawnKind: p.drawn !== null ? kindOf(p.drawn) : -1, turnNow, ctx }
  const seed = hashCounts(counts, melds, draws)
  const sum = counts.reduce((a, b) => a + b, 0)

  const rows: AimRow[] = []
  const defs: AimDef[] = []
  const dists: DistFn[] = []
  const closed = closedMelds(melds)
  for (const def of buildAims(ctx)) {
    if (def.openHan === 0 && !closed) continue
    // 狙い方の候補を、いま近い順に並べる
    const ranked = def.variants
      .map((v) => ({ v, d: v.dist(counts, melds, ctx) }))
      .filter((x) => x.d < INF)
      .sort((a, b) => a.d - b.d)
    if (ranked.length === 0) continue
    const d = ranked[0].d
    if (d > MAX_DIST) continue
    const active = ranked.slice(0, KEEP_VARIANTS).map((x) => x.v)
    const dist: DistFn =
      active.length === 1
        ? (c, m) => active[0].dist(c, m, ctx)
        : (c, m) => {
            let best = INF
            for (const v of active) {
              const x = v.dist(c, m, ctx)
              if (x < best) best = x
            }
            return best
          }
    // 完成済みなら、役がそろっているか確かめる
    if (d === -1 && def.key !== 'riichi' && start.drawnKind >= 0 && !evalWin(def, counts, melds, start.drawnKind, true, ctx)) continue
    if (d === -1 && def.key === 'riichi') continue

    // 切った後の13枚（自分の番なら、その役の形でいちばん良い切り方）
    const c13 = counts.slice()
    if (sum % 3 === 2) {
      const { k } = pickDiscard(dist, c13, melds)
      c13[k]--
    }
    const d13 = dist(c13, melds)
    const needed: { kind: Kind; remaining: number }[] = []
    if (d13 >= 0) {
      for (let k = 0; k < KIND_COUNT; k++) {
        if (c13[k] >= 4 || unseen[k] === 0) continue
        c13[k]++
        const d2 = dist(c13, melds)
        c13[k]--
        if (d2 < d13) needed.push({ kind: k, remaining: unseen[k] })
      }
    }
    needed.sort((a, b) => b.remaining - a.remaining)
    const keep: Kind[] = []
    const junk: Kind[] = []
    for (let k = 0; k < KIND_COUNT; k++) {
      if (counts[k] === 0) continue
      counts[k]--
      const d1 = dist(counts, melds)
      counts[k]++
      if (d1 > d) keep.push(k)
      else junk.push(k)
    }
    const lines: string[] = [distText(d)]
    if (ranked[0].v.name) lines.push(`いちばん近い形：${ranked[0].v.name}`)
    rows.push({
      key: def.key,
      id: def.id,
      label: def.label,
      han: def.han,
      openHan: def.openHan,
      hanNow: closed ? def.han : def.openHan,
      closedOnly: def.openHan === 0,
      dist: d,
      prob: d === -1 ? 1 : null,
      needed,
      neededTotal: needed.reduce((a, b) => a + b.remaining, 0),
      keep,
      junk,
      lines,
      tip: def.tip,
      yakuman: def.han >= 13,
    })
    defs.push(def)
    dists.push(dist)
  }
  // 近い役から計算する
  const order = rows.map((_, i) => i).sort((a, b) => rows[a].dist - rows[b].dist)
  let cursor = 0
  let doneTrials = 0
  let wsum = 0
  let rng = mulberry32(seed)

  const summary =
    draws === 0
      ? '山の残りが少ないので、他家の捨て牌でのロンだけが見込みです。'
      : `残りツモ約${draws}回で和了できる見込みの目安です。`

  return {
    snapshot: () => ({ rows: rows.slice(), done: cursor >= order.length, trials, draws, summary }),
    step(budgetMs: number) {
      const t0 = Date.now()
      while (cursor < order.length) {
        const ri = order[cursor]
        const row = rows[ri]
        if (row.prob !== null) {
          cursor++
          continue
        }
        if (doneTrials === 0) {
          rng = mulberry32(seed ^ Math.imul(ri + 1, 0x9e3779b1))
          wsum = 0
        }
        wsum += runTrial(defs[ri], dists[ri], start, rng)
        doneTrials++
        const stopEarly = doneTrials === EARLY_STOP_AT && wsum < 1
        if (doneTrials >= trials || stopEarly) {
          row.prob = wsum / doneTrials
          doneTrials = 0
          cursor++
        }
        if (Date.now() - t0 >= budgetMs) break
      }
      return cursor >= order.length
    },
  }
}

/** テスト用：最後まで計算して返す */
export function estimateAims(s: GameState, seat = 0, trials = 100): AimSnapshot {
  const job = createAimJob(s, seat, trials)
  while (!job.step(1000)) {
    /* 続ける */
  }
  return job.snapshot()
}
