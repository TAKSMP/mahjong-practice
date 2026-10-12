// 対局の進行（状態はすべて JSON にできるプレーンなオブジェクト）
// 席番号は 0=あなた 1=下家 2=対面 3=上家。手番は 0→1→2→3 の順。

import { DEFAULT_RULES, type Rules } from './rules'
import { shanten, waitingKinds } from './shanten'
import {
  KIND_COUNT,
  doraFromIndicator,
  isHonor,
  isYaochu,
  kindOf,
  numOf,
  redTileIds,
  sortTiles,
  toCounts,
  type Kind,
  type Tile,
} from './tiles'
import { calcPayment, evaluateWin, type MeldInfo, type MeldKind, type Payment, type WinInput, type WinResult } from './yaku'

export interface Meld {
  type: MeldKind
  tiles: Tile[]
  /** 鳴いた牌 */
  called?: Tile
  /** 鳴いた相手の席 */
  from?: number
}

export interface Discard {
  tile: Tile
  tsumogiri: boolean
  riichi: boolean
  /** 鳴かれた場合、鳴いた席 */
  calledBy: number | null
  /** 局内の通し番号（リーチ後に通った牌の判定用） */
  seq: number
}

export interface Player {
  name: string
  human: boolean
  hand: Tile[]
  drawn: Tile | null
  melds: Meld[]
  discards: Discard[]
  score: number
  riichi: boolean
  doubleRiichi: boolean
  riichiPending: boolean
  /** リーチ宣言牌が何巡目か（河のインデックス） */
  riichiIndex: number
  ippatsu: boolean
  furitenTemp: boolean
  furitenRiichi: boolean
  /** 喰い替えで切れない牌の種類 */
  kuikae: Kind[]
  nagashiOk: boolean
}

export interface CallOptions {
  ron: boolean
  ronResult: WinResult | null
  pon: Tile[][]
  chi: Tile[][]
  minkan: Tile[] | null
}

export type TurnAction =
  | { type: 'discard'; tile: Tile; riichi?: boolean }
  | { type: 'tsumo' }
  | { type: 'ankan'; kind: Kind }
  | { type: 'kakan'; kind: Kind }
  | { type: 'kyuushu' }

export type CallAction =
  | { type: 'pass' }
  | { type: 'ron' }
  | { type: 'pon'; tiles: Tile[] }
  | { type: 'chi'; tiles: Tile[] }
  | { type: 'minkan' }

export type Phase =
  | { type: 'draw' }
  | { type: 'action'; afterCall: boolean }
  | {
      type: 'response'
      tile: Tile
      from: number
      kakan: boolean
      options: (CallOptions | null)[]
      responses: (CallAction | null)[]
    }
  | { type: 'roundEnd' }
  | { type: 'gameEnd' }

export interface WinRecord {
  winner: number
  from: number | null
  tile: Tile
  hand: Tile[]
  melds: Meld[]
  result: WinResult
  payment: Payment
}

export interface RoundResult {
  type: 'win' | 'draw' | 'abort'
  title: string
  wins: WinRecord[]
  tenpai: boolean[]
  nagashi: number[]
  scoreDelta: number[]
  scoresBefore: number[]
  scoresAfter: number[]
  doraIndicators: Tile[]
  uraIndicators: Tile[]
  /** 結果画面で手牌を公開する席 */
  reveal: boolean[]
  hands: Tile[][]
  renchan: boolean
}

export interface FinalResult {
  /** 順位順の席番号 */
  order: number[]
  scores: number[]
  points: number[]
}

export interface GameEvent {
  seq: number
  seat: number
  kind: 'pon' | 'chi' | 'kan' | 'riichi' | 'ron' | 'tsumo' | 'kyuushu'
  text: string
}

export interface GameState {
  version: 1
  rules: Rules
  rng: number
  players: Player[]
  startDealer: number
  dealer: number
  roundWind: number
  honba: number
  riichiSticks: number
  wall: Tile[]
  drawIndex: number
  rinshanUsed: number
  kanCount: number
  kanOwners: number[]
  doraRevealed: number
  doraPending: number
  redTiles: number[]
  turn: number
  phase: Phase
  /** この局で鳴き（暗槓含む）があったか */
  callsMade: boolean
  lastDrawRinshan: boolean
  roundResult: RoundResult | null
  /** 次の局の情報（局の終わりに決まる） */
  next: { dealer: number; roundWind: number; honba: number; over: boolean } | null
  final: FinalResult | null
  event: GameEvent | null
  eventSeq: number
  /** 通算の局数（表示用） */
  roundNo: number
  discardSeq: number
}

export const SEAT_NAMES = ['あなた', '下家', '対面', '上家']
export const WIND_JP = ['東', '南', '西', '北']
const DEAD_WALL_START = 122

// ---------- 乱数 ----------
function nextRand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ---------- 基本情報 ----------
export const liveRemaining = (s: GameState) => DEAD_WALL_START - s.kanCount - s.drawIndex
export const seatWindIndex = (s: GameState, seat: number) => (seat - s.dealer + 4) % 4
export const kyokuIndex = (s: GameState) => (s.dealer - s.startDealer + 4) % 4

export function doraIndicators(s: GameState): Tile[] {
  const n = s.rules.kandora ? s.doraRevealed : 1
  return Array.from({ length: n }, (_, i) => s.wall[126 + 2 * i])
}

export function uraIndicators(s: GameState): Tile[] {
  const n = s.rules.kandora ? s.doraRevealed : 1
  return Array.from({ length: n }, (_, i) => s.wall[127 + 2 * i])
}

export function roundLabel(s: GameState): string {
  return `${WIND_JP[s.roundWind]}${kyokuIndex(s) + 1}局`
}

export const isOpen = (p: Player) => p.melds.some((m) => m.type !== 'ankan')

export function meldInfo(m: Meld): MeldInfo {
  const kinds = m.tiles.map(kindOf)
  return { type: m.type, kind: Math.min(...kinds) }
}

/** seat から見える牌の枚数（自分の手牌以外：河・全員の副露・ドラ表示牌） */
export function visibleCounts(s: GameState, _seat: number): number[] {
  const c = new Array(KIND_COUNT).fill(0)
  for (const p of s.players) {
    for (const d of p.discards) if (d.calledBy === null) c[kindOf(d.tile)]++
    for (const m of p.melds) for (const t of m.tiles) c[kindOf(t)]++
  }
  for (const t of doraIndicators(s)) c[kindOf(t)]++
  return c
}

function emit(s: GameState, seat: number, kind: GameEvent['kind'], text: string) {
  s.eventSeq++
  s.event = { seq: s.eventSeq, seat, kind, text }
}

// ---------- 対局の作成 ----------
export function createGame(rules: Rules = DEFAULT_RULES, seed = (Date.now() ^ (Math.random() * 1e9)) | 0): GameState {
  const s: GameState = {
    version: 1,
    rules,
    rng: seed,
    players: [0, 1, 2, 3].map((i) => ({
      name: SEAT_NAMES[i],
      human: i === 0,
      hand: [],
      drawn: null,
      melds: [],
      discards: [],
      score: rules.startPoints,
      riichi: false,
      doubleRiichi: false,
      riichiPending: false,
      riichiIndex: -1,
      ippatsu: false,
      furitenTemp: false,
      furitenRiichi: false,
      kuikae: [],
      nagashiOk: true,
    })),
    startDealer: 0,
    dealer: 0,
    roundWind: 0,
    honba: 0,
    riichiSticks: 0,
    wall: [],
    drawIndex: 0,
    rinshanUsed: 0,
    kanCount: 0,
    kanOwners: [],
    doraRevealed: 1,
    doraPending: 0,
    redTiles: redTileIds(rules.aka),
    turn: 0,
    phase: { type: 'draw' },
    callsMade: false,
    lastDrawRinshan: false,
    roundResult: null,
    next: null,
    final: null,
    event: null,
    eventSeq: 0,
    roundNo: 0,
    discardSeq: 0,
  }
  s.startDealer = Math.floor(nextRand(s) * 4)
  s.dealer = s.startDealer
  startRound(s)
  return s
}

export function startRound(s: GameState) {
  const wall = Array.from({ length: 136 }, (_, i) => i)
  for (let i = wall.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand(s) * (i + 1))
    ;[wall[i], wall[j]] = [wall[j], wall[i]]
  }
  s.wall = wall
  s.drawIndex = 0
  s.rinshanUsed = 0
  s.kanCount = 0
  s.kanOwners = []
  s.doraRevealed = 1
  s.doraPending = 0
  s.callsMade = false
  s.lastDrawRinshan = false
  s.roundResult = null
  s.next = null
  s.event = null
  s.roundNo++
  s.discardSeq = 0
  for (const p of s.players) {
    p.hand = []
    p.drawn = null
    p.melds = []
    p.discards = []
    p.riichi = false
    p.doubleRiichi = false
    p.riichiPending = false
    p.riichiIndex = -1
    p.ippatsu = false
    p.furitenTemp = false
    p.furitenRiichi = false
    p.kuikae = []
    p.nagashiOk = true
  }
  for (let r = 0; r < 13; r++) {
    for (let i = 0; i < 4; i++) {
      const seat = (s.dealer + i) % 4
      s.players[seat].hand.push(s.wall[s.drawIndex++])
    }
  }
  for (const p of s.players) p.hand = sortTiles(p.hand, new Set(s.redTiles))
  s.turn = s.dealer
  s.phase = { type: 'draw' }
}

// ---------- 和了判定 ----------
function akaCount(s: GameState, tiles: Tile[]): number {
  return tiles.filter((t) => s.redTiles.includes(t)).length
}

export function buildWinInput(
  s: GameState,
  seat: number,
  winTile: Tile,
  tsumo: boolean,
  opts: { chankan?: boolean; ignoreSituational?: boolean; riichiOverride?: boolean; noUra?: boolean } = {},
): WinInput {
  const p = s.players[seat]
  const closedTiles = tsumo ? p.hand : [...p.hand, winTile]
  const meldTiles = p.melds.flatMap((m) => m.tiles)
  const situ = !opts.ignoreSituational
  const first = !s.callsMade && p.discards.length === 0 && !s.lastDrawRinshan
  const riichi = opts.riichiOverride ?? p.riichi
  return {
    closed: closedTiles.map(kindOf),
    melds: p.melds.map(meldInfo),
    winKind: kindOf(winTile),
    tsumo,
    seatWind: 27 + seatWindIndex(s, seat),
    roundWind: 27 + s.roundWind,
    riichi: riichi && !p.doubleRiichi,
    doubleRiichi: riichi && p.doubleRiichi,
    ippatsu: situ && s.rules.ippatsu && p.ippatsu,
    haitei: situ && tsumo && liveRemaining(s) === 0 && !s.lastDrawRinshan,
    houtei: situ && !tsumo && liveRemaining(s) === 0 && !opts.chankan,
    rinshan: situ && tsumo && s.lastDrawRinshan,
    chankan: situ && !!opts.chankan,
    tenhou: situ && tsumo && first && seat === s.dealer,
    chiihou: situ && tsumo && first && seat !== s.dealer,
    doraKinds: doraIndicators(s).map((t) => doraFromIndicator(kindOf(t))),
    // 裏ドラは和了が決まるまで見えない（見込みの計算では含めない）
    uraKinds: s.rules.uradora && !opts.noUra ? uraIndicators(s).map((t) => doraFromIndicator(kindOf(t))) : [],
    akaCount: akaCount(s, [...closedTiles, ...meldTiles]),
    rules: s.rules,
  }
}

/** 後付けなしルール：鳴いた手は、すべての待ちで役がないと和了れない */
function atozukeOk(s: GameState, seat: number, handBefore: Tile[]): boolean {
  const p = s.players[seat]
  if (s.rules.atozuke || !isOpen(p)) return true
  const counts = toCounts(handBefore)
  const waits = waitingKinds(counts, p.melds.length)
  for (const w of waits) {
    const tile = w * 4
    const saved = p.hand
    p.hand = handBefore
    const r = evaluateWin(buildWinInput(s, seat, tile, false, { ignoreSituational: true }))
    p.hand = saved
    if (!r) return false
  }
  return true
}

export function tsumoResult(s: GameState, seat: number): WinResult | null {
  const p = s.players[seat]
  if (p.drawn === null) return null
  if (shanten(toCounts(p.hand), p.melds.length) !== -1) return null
  const r = evaluateWin(buildWinInput(s, seat, p.drawn, true))
  if (!r) return null
  const before = p.hand.slice()
  before.splice(before.indexOf(p.drawn), 1)
  if (!atozukeOk(s, seat, before)) return null
  return r
}

/** 待ちに自分の捨て牌が含まれるか（捨て牌フリテン） */
export function isDiscardFuriten(s: GameState, seat: number, hand13: Tile[] = s.players[seat].hand): boolean {
  const p = s.players[seat]
  const waits = waitingKinds(toCounts(hand13), p.melds.length)
  const discarded = new Set(p.discards.map((d) => kindOf(d.tile)))
  return waits.some((w) => discarded.has(w))
}

export function isFuriten(s: GameState, seat: number): boolean {
  const p = s.players[seat]
  return p.furitenTemp || p.furitenRiichi || isDiscardFuriten(s, seat)
}

function ronResult(s: GameState, seat: number, tile: Tile, chankan: boolean): WinResult | null {
  const p = s.players[seat]
  const counts = toCounts(p.hand)
  counts[kindOf(tile)]++
  if (shanten(counts, p.melds.length) !== -1) return null
  if (isFuriten(s, seat)) return null
  const r = evaluateWin(buildWinInput(s, seat, tile, false, { chankan }))
  if (!r) return null
  if (!atozukeOk(s, seat, p.hand)) return null
  return r
}

// ---------- 手番の選択肢 ----------
export interface TurnOptions {
  tsumo: WinResult | null
  /** リーチ宣言しながら切れる牌 */
  riichiTiles: Tile[]
  ankan: Kind[]
  kakan: Kind[]
  kyuushu: boolean
  /** 喰い替えで切れない種類 */
  forbidden: Kind[]
  /** リーチ中はツモ切りのみ */
  tsumogiriOnly: boolean
}

function waitsKey(hand: Tile[], meldCount: number): string {
  return waitingKinds(toCounts(hand), meldCount).join(',')
}

export function getTurnOptions(s: GameState, seat: number): TurnOptions {
  const p = s.players[seat]
  const ph = s.phase
  const afterCall = ph.type === 'action' && ph.afterCall
  const counts = toCounts(p.hand)
  const opt: TurnOptions = {
    tsumo: null,
    riichiTiles: [],
    ankan: [],
    kakan: [],
    kyuushu: false,
    forbidden: p.kuikae.slice(),
    tsumogiriOnly: p.riichi,
  }
  if (!afterCall) opt.tsumo = tsumoResult(s, seat)
  const canKan = !afterCall && s.kanCount < 4 && liveRemaining(s) > 0
  if (canKan) {
    for (let k = 0; k < KIND_COUNT; k++) {
      if (counts[k] !== 4) continue
      if (p.riichi) {
        // リーチ後の暗槓：ツモった牌で、待ちが変わらないときだけ
        if (p.drawn === null || kindOf(p.drawn) !== k) continue
        const before = p.hand.filter((t) => t !== p.drawn)
        const after = p.hand.filter((t) => kindOf(t) !== k)
        if (waitsKey(before, p.melds.length) !== waitsKey(after, p.melds.length + 1)) continue
        if (waitingKinds(toCounts(before), p.melds.length).length === 0) continue
      }
      opt.ankan.push(k)
    }
    if (!p.riichi) {
      for (const m of p.melds) {
        if (m.type !== 'pon') continue
        const k = kindOf(m.tiles[0])
        if (counts[k] >= 1) opt.kakan.push(k)
      }
    }
  }
  if (!p.riichi && !isOpen(p) && p.score >= 1000 && liveRemaining(s) >= 4 && !afterCall) {
    const seen = new Set<string>()
    for (const t of p.hand) {
      const key = `${kindOf(t)}:${s.redTiles.includes(t)}`
      if (seen.has(key)) continue
      seen.add(key)
      const c = counts.slice()
      c[kindOf(t)]--
      if (shanten(c, p.melds.length) === 0) opt.riichiTiles.push(t)
    }
  }
  if (s.rules.tochuRyuukyoku && !s.callsMade && p.discards.length === 0 && !afterCall) {
    const kinds = new Set(p.hand.map(kindOf).filter(isYaochu))
    if (kinds.size >= 9) opt.kyuushu = true
  }
  return opt
}

/** 切れる牌か */
export function canDiscard(s: GameState, seat: number, tile: Tile): boolean {
  const p = s.players[seat]
  if (!p.hand.includes(tile)) return false
  if (p.riichi && tile !== p.drawn) return false
  if (p.kuikae.includes(kindOf(tile))) return false
  return true
}

// ---------- 鳴きの選択肢 ----------
function pickVariants(s: GameState, hand: Tile[], kinds: Kind[]): Tile[][] {
  // kinds の各牌を手から選ぶ組み合わせ（赤の有無で区別）
  const res: Tile[][] = []
  const seen = new Set<string>()
  const rec = (i: number, used: Tile[]) => {
    if (i === kinds.length) {
      const key = used.map((t) => `${kindOf(t)}${s.redTiles.includes(t) ? 'r' : ''}`).sort().join()
      if (!seen.has(key)) {
        seen.add(key)
        res.push(used.slice())
      }
      return
    }
    for (const t of hand) {
      if (kindOf(t) !== kinds[i] || used.includes(t)) continue
      used.push(t)
      rec(i + 1, used)
      used.pop()
    }
  }
  rec(0, [])
  return res
}

function kuikaeKinds(called: Kind, own: Kind[], type: 'pon' | 'chi'): Kind[] {
  if (type === 'pon') return [called]
  const [a, b] = own.slice().sort((x, y) => x - y)
  const res = [called]
  if (called < a) {
    // 例: 45 に 3 → 6 も禁止
    if (b + 1 < 27 && numOf(b) < 9) res.push(b + 1)
  } else if (called > b) {
    if (numOf(a) > 1) res.push(a - 1)
  }
  return res
}

function hasLegalDiscardAfter(hand: Tile[], used: Tile[], forbidden: Kind[]): boolean {
  return hand.some((t) => !used.includes(t) && !forbidden.includes(kindOf(t)))
}

export function getCallOptions(s: GameState, seat: number, tile: Tile, from: number, kakan: boolean): CallOptions | null {
  const p = s.players[seat]
  const k = kindOf(tile)
  const ronRes = ronResult(s, seat, tile, kakan)
  const opt: CallOptions = { ron: !!ronRes, ronResult: ronRes, pon: [], chi: [], minkan: null }
  if (!kakan && !p.riichi && liveRemaining(s) > 0) {
    const same = p.hand.filter((t) => kindOf(t) === k)
    if (same.length >= 2) {
      for (const v of pickVariants(s, p.hand, [k, k])) {
        if (hasLegalDiscardAfter(p.hand, v, [k])) opt.pon.push(v)
      }
    }
    if (same.length === 3 && s.kanCount < 4) opt.minkan = same
    if (seat === (from + 1) % 4 && !isHonor(k)) {
      const n = numOf(k)
      const pats: Kind[][] = []
      if (n >= 3) pats.push([k - 2, k - 1])
      if (n >= 2 && n <= 8) pats.push([k - 1, k + 1])
      if (n <= 7) pats.push([k + 1, k + 2])
      for (const pat of pats) {
        for (const v of pickVariants(s, p.hand, pat)) {
          const forb = kuikaeKinds(k, pat, 'chi')
          if (hasLegalDiscardAfter(p.hand, v, forb)) opt.chi.push(v)
        }
      }
    }
  }
  if (!opt.ron && opt.pon.length === 0 && opt.chi.length === 0 && !opt.minkan) return null
  return opt
}

// ---------- 進行 ----------
export function drawTile(s: GameState) {
  if (s.phase.type !== 'draw') throw new Error('draw: phase')
  if (liveRemaining(s) <= 0) {
    exhaustiveDraw(s)
    return
  }
  const p = s.players[s.turn]
  const t = s.wall[s.drawIndex++]
  p.hand.push(t)
  p.drawn = t
  s.lastDrawRinshan = false
  s.phase = { type: 'action', afterCall: false }
}

function drawRinshan(s: GameState, seat: number) {
  const p = s.players[seat]
  const t = s.wall[DEAD_WALL_START + s.rinshanUsed++]
  p.hand.push(t)
  p.drawn = t
  s.lastDrawRinshan = true
  s.turn = seat
  s.phase = { type: 'action', afterCall: false }
}

function revealPendingDora(s: GameState) {
  while (s.doraPending > 0) {
    s.doraPending--
    s.doraRevealed = Math.min(5, s.doraRevealed + 1)
  }
}

function sortHand(s: GameState, p: Player) {
  p.hand = sortTiles(p.hand, new Set(s.redTiles))
}

export function applyTurnAction(s: GameState, a: TurnAction) {
  if (s.phase.type !== 'action') throw new Error('action: phase')
  const seat = s.turn
  const p = s.players[seat]
  switch (a.type) {
    case 'tsumo': {
      const r = tsumoResult(s, seat)
      if (!r) throw new Error('tsumo: not winning')
      emit(s, seat, 'tsumo', 'ツモ')
      revealPendingDora(s)
      const r2 = tsumoResult(s, seat)!
      finishWins(s, [{ seat, from: null, tile: p.drawn!, result: r2 }])
      return
    }
    case 'kyuushu': {
      emit(s, seat, 'kyuushu', '九種九牌')
      abortRound(s, '九種九牌')
      return
    }
    case 'ankan': {
      const tiles = p.hand.filter((t) => kindOf(t) === a.kind)
      if (tiles.length !== 4) throw new Error('ankan: tiles')
      p.hand = p.hand.filter((t) => kindOf(t) !== a.kind)
      p.melds.push({ type: 'ankan', tiles })
      p.drawn = null
      s.callsMade = true
      s.kanCount++
      s.kanOwners.push(seat)
      for (const q of s.players) q.ippatsu = false
      emit(s, seat, 'kan', 'カン')
      revealPendingDora(s)
      if (s.rules.kandora) s.doraRevealed = Math.min(5, s.doraRevealed + 1)
      sortHand(s, p)
      drawRinshan(s, seat)
      return
    }
    case 'kakan': {
      const m = p.melds.find((x) => x.type === 'pon' && kindOf(x.tiles[0]) === a.kind)
      const t = p.hand.find((x) => kindOf(x) === a.kind)
      if (!m || t === undefined) throw new Error('kakan')
      p.hand.splice(p.hand.indexOf(t), 1)
      m.type = 'kakan'
      m.tiles = [...m.tiles, t]
      p.drawn = null
      sortHand(s, p)
      emit(s, seat, 'kan', 'カン')
      // 槍槓の確認
      openResponse(s, t, seat, true)
      return
    }
    case 'discard': {
      if (!canDiscard(s, seat, a.tile)) throw new Error('discard: illegal')
      if (a.riichi) {
        const opts = getTurnOptions(s, seat)
        if (!opts.riichiTiles.some((t) => kindOf(t) === kindOf(a.tile))) throw new Error('riichi: illegal')
      }
      const tsumogiri = a.tile === p.drawn
      p.hand.splice(p.hand.indexOf(a.tile), 1)
      p.drawn = null
      sortHand(s, p)
      if (p.riichi) p.ippatsu = false
      if (a.riichi) {
        p.riichiPending = true
        p.doubleRiichi = !s.callsMade && p.discards.length === 0
        p.riichiIndex = p.discards.length
        emit(s, seat, 'riichi', p.doubleRiichi ? 'ダブルリーチ' : 'リーチ')
      }
      p.discards.push({ tile: a.tile, tsumogiri, riichi: !!a.riichi, calledBy: null, seq: ++s.discardSeq })
      if (!isYaochu(kindOf(a.tile))) p.nagashiOk = false
      p.furitenTemp = false
      p.kuikae = []
      revealPendingDora(s)
      openResponse(s, a.tile, seat, false)
      return
    }
  }
}

function openResponse(s: GameState, tile: Tile, from: number, kakan: boolean) {
  const options: (CallOptions | null)[] = [null, null, null, null]
  const responses: (CallAction | null)[] = [null, null, null, null]
  for (let i = 1; i < 4; i++) {
    const seat = (from + i) % 4
    const o = getCallOptions(s, seat, tile, from, kakan)
    // 槍槓はロンのみ
    if (o && kakan && !o.ron) {
      options[seat] = null
    } else {
      options[seat] = o
    }
    if (!options[seat]) responses[seat] = { type: 'pass' }
  }
  responses[from] = { type: 'pass' }
  s.phase = { type: 'response', tile, from, kakan, options, responses }
  if (responses.every((r) => r !== null)) resolveResponses(s)
}

/** 鳴き・ロンの応答を記録する。全員そろったら処理する */
export function respond(s: GameState, seat: number, a: CallAction) {
  const ph = s.phase
  if (ph.type !== 'response') throw new Error('respond: phase')
  if (ph.responses[seat] !== null) return
  ph.responses[seat] = a
  if (ph.responses.every((r) => r !== null)) resolveResponses(s)
}

/** 見逃しフリテンの設定 */
function applyMissedRon(s: GameState, tile: Tile, from: number, ronSeats: number[]) {
  for (let seat = 0; seat < 4; seat++) {
    if (seat === from || ronSeats.includes(seat)) continue
    const p = s.players[seat]
    const waits = waitingKinds(toCounts(p.hand), p.melds.length)
    if (waits.includes(kindOf(tile))) {
      p.furitenTemp = true
      if (p.riichi) p.furitenRiichi = true
    }
  }
}

function resolveResponses(s: GameState) {
  const ph = s.phase
  if (ph.type !== 'response') return
  const { tile, from, kakan, responses } = ph
  const order = [1, 2, 3].map((i) => (from + i) % 4)
  let rons = order.filter((seat) => responses[seat]?.type === 'ron')
  if (rons.length > 0) {
    if (rons.length === 3 && s.rules.tochuRyuukyoku) {
      abortRound(s, '三家和')
      return
    }
    if (s.rules.multiRon === 'atamahane') rons = [rons[0]]
    revealPendingDora(s)
    const wins = rons.map((seat) => ({
      seat,
      from,
      tile,
      result: ronResult(s, seat, tile, kakan)!,
    }))
    emit(s, rons[0], 'ron', 'ロン')
    finishWins(s, wins)
    return
  }
  applyMissedRon(s, tile, from, [])

  if (kakan) {
    s.callsMade = true
    s.kanCount++
    s.kanOwners.push(from)
    for (const q of s.players) q.ippatsu = false
    if (s.rules.kandora) s.doraPending++
    drawRinshan(s, from)
    return
  }

  // リーチ成立
  const dp = s.players[from]
  if (dp.riichiPending) {
    dp.riichiPending = false
    dp.riichi = true
    dp.ippatsu = true
    dp.score -= 1000
    s.riichiSticks++
  }

  // 途中流局
  if (s.rules.tochuRyuukyoku) {
    if (s.players.every((p) => p.riichi)) {
      abortRound(s, '四家立直')
      return
    }
    if (!s.callsMade && s.players.every((p) => p.discards.length === 1)) {
      const k = kindOf(s.players[0].discards[0].tile)
      if (k >= 27 && k <= 30 && s.players.every((p) => kindOf(p.discards[0].tile) === k)) {
        abortRound(s, '四風連打')
        return
      }
    }
    if (s.kanCount === 4 && new Set(s.kanOwners).size > 1) {
      abortRound(s, '四槓散了')
      return
    }
  }

  // ポン・カン（チーより優先）
  for (const seat of order) {
    const r = responses[seat]
    if (r?.type === 'pon' || r?.type === 'minkan') {
      doCall(s, seat, r, tile, from)
      return
    }
  }
  for (const seat of order) {
    const r = responses[seat]
    if (r?.type === 'chi') {
      doCall(s, seat, r, tile, from)
      return
    }
  }
  s.turn = (from + 1) % 4
  s.phase = { type: 'draw' }
}

function doCall(s: GameState, seat: number, a: CallAction, tile: Tile, from: number) {
  const p = s.players[seat]
  const dp = s.players[from]
  const d = dp.discards[dp.discards.length - 1]
  d.calledBy = seat
  dp.nagashiOk = false
  s.callsMade = true
  for (const q of s.players) q.ippatsu = false
  const k = kindOf(tile)
  if (a.type === 'pon' || a.type === 'chi') {
    for (const t of a.tiles) p.hand.splice(p.hand.indexOf(t), 1)
    const tiles = a.type === 'chi' ? sortTiles([...a.tiles, tile]) : [...a.tiles, tile]
    p.melds.push({ type: a.type, tiles, called: tile, from })
    p.kuikae = kuikaeKinds(k, a.tiles.map(kindOf), a.type)
    p.drawn = null
    emit(s, seat, a.type, a.type === 'pon' ? 'ポン' : 'チー')
    s.turn = seat
    s.phase = { type: 'action', afterCall: true }
    return
  }
  if (a.type === 'minkan') {
    const own = p.hand.filter((t) => kindOf(t) === k)
    p.hand = p.hand.filter((t) => kindOf(t) !== k)
    p.melds.push({ type: 'minkan', tiles: [...own, tile], called: tile, from })
    p.drawn = null
    s.kanCount++
    s.kanOwners.push(seat)
    if (s.rules.kandora) s.doraPending++
    emit(s, seat, 'kan', 'カン')
    drawRinshan(s, seat)
  }
}

// ---------- 局の終了 ----------
function scoresSnapshot(s: GameState) {
  return s.players.map((p) => p.score)
}

function finishWins(s: GameState, wins: { seat: number; from: number | null; tile: Tile; result: WinResult }[]) {
  const before = scoresSnapshot(s)
  // リーチ宣言牌でロンされた場合、そのリーチは不成立
  for (const p of s.players) p.riichiPending = false
  const delta = [0, 0, 0, 0]
  const records: WinRecord[] = []
  wins.forEach((w, idx) => {
    const isDealer = w.seat === s.dealer
    const honba = idx === 0 ? s.honba : 0
    const pay = calcPayment(w.result.base, isDealer, w.from === null, honba)
    if (w.from === null) {
      for (let i = 0; i < 4; i++) {
        if (i === w.seat) continue
        const amt = isDealer ? pay.tsumoChild! : i === s.dealer ? pay.tsumoDealer! : pay.tsumoChild!
        delta[i] -= amt
        delta[w.seat] += amt
      }
    } else {
      delta[w.from] -= pay.ron!
      delta[w.seat] += pay.ron!
    }
    if (idx === 0) {
      delta[w.seat] += s.riichiSticks * 1000
      s.riichiSticks = 0
    }
    const p = s.players[w.seat]
    records.push({
      winner: w.seat,
      from: w.from,
      tile: w.tile,
      hand: w.from === null ? p.hand.slice() : [...p.hand, w.tile],
      melds: p.melds.map((m) => ({ ...m, tiles: m.tiles.slice() })),
      result: w.result,
      payment: pay,
    })
  })
  for (let i = 0; i < 4; i++) s.players[i].score += delta[i]
  const dealerWon = wins.some((w) => w.seat === s.dealer)
  const reveal = [0, 1, 2, 3].map((i) => wins.some((w) => w.seat === i))
  const first = wins[0]
  const title =
    first.from === null
      ? `${s.players[first.seat].name} ツモ和了`
      : wins.length > 1
        ? `ダブロン（${s.players[first.from].name}の放銃）`
        : `${s.players[first.seat].name} ロン和了（${s.players[first.from].name}の放銃）`
  endRound(s, {
    type: 'win',
    title,
    wins: records,
    tenpai: [false, false, false, false],
    nagashi: [],
    scoreDelta: delta,
    scoresBefore: before,
    scoresAfter: scoresSnapshot(s),
    doraIndicators: doraIndicators(s),
    uraIndicators: s.rules.uradora ? uraIndicators(s) : [],
    reveal,
    hands: s.players.map((p) => p.hand.slice()),
    renchan: dealerWon,
  })
}

export function isTenpai(s: GameState, seat: number): boolean {
  const p = s.players[seat]
  return waitingKinds(toCounts(p.hand), p.melds.length).length > 0
}

function exhaustiveDraw(s: GameState) {
  const before = scoresSnapshot(s)
  const tenpai = [0, 1, 2, 3].map((i) => isTenpai(s, i))
  const delta = [0, 0, 0, 0]
  const nagashi = s.rules.nagashiMangan
    ? [0, 1, 2, 3].filter((i) => s.players[i].nagashiOk && s.players[i].discards.length > 0)
    : []
  if (nagashi.length > 0) {
    for (const seat of nagashi) {
      const isDealer = seat === s.dealer
      const pay = calcPayment(2000, isDealer, true, 0)
      for (let i = 0; i < 4; i++) {
        if (i === seat) continue
        const amt = isDealer ? pay.tsumoChild! : i === s.dealer ? pay.tsumoDealer! : pay.tsumoChild!
        delta[i] -= amt
        delta[seat] += amt
      }
    }
  } else {
    const n = tenpai.filter(Boolean).length
    if (n > 0 && n < 4) {
      for (let i = 0; i < 4; i++) delta[i] = tenpai[i] ? 3000 / n : -3000 / (4 - n)
    }
  }
  for (let i = 0; i < 4; i++) s.players[i].score += delta[i]
  const renchan = s.rules.renchan === 'tenpai' && tenpai[s.dealer]
  endRound(s, {
    type: 'draw',
    title: nagashi.length > 0 ? '流し満貫' : '流局',
    wins: [],
    tenpai,
    nagashi,
    scoreDelta: delta,
    scoresBefore: before,
    scoresAfter: scoresSnapshot(s),
    doraIndicators: doraIndicators(s),
    uraIndicators: [],
    reveal: tenpai,
    hands: s.players.map((p) => p.hand.slice()),
    renchan,
  })
}

function abortRound(s: GameState, reason: string) {
  const before = scoresSnapshot(s)
  // 宣言中のリーチは不成立
  for (const p of s.players) p.riichiPending = false
  endRound(s, {
    type: 'abort',
    title: `途中流局（${reason}）`,
    wins: [],
    tenpai: [false, false, false, false],
    nagashi: [],
    scoreDelta: [0, 0, 0, 0],
    scoresBefore: before,
    scoresAfter: scoresSnapshot(s),
    doraIndicators: doraIndicators(s),
    uraIndicators: [],
    reveal: [false, false, false, false],
    hands: s.players.map((p) => p.hand.slice()),
    renchan: true,
  })
}

/** 順位（同点は起家に近い順） */
export function ranking(s: GameState, scores = s.players.map((p) => p.score)): number[] {
  return [0, 1, 2, 3].sort((a, b) => {
    if (scores[b] !== scores[a]) return scores[b] - scores[a]
    return ((a - s.startDealer + 4) % 4) - ((b - s.startDealer + 4) % 4)
  })
}

function endRound(s: GameState, result: RoundResult) {
  s.roundResult = result
  s.phase = { type: 'roundEnd' }
  const r = s.rules
  const lastWind = r.length === 'tonpuu' ? 0 : 1
  const isAllLast = s.roundWind >= lastWind && kyokuIndex(s) === 3
  const inExtension = s.roundWind > lastWind
  const renchan = result.renchan
  const honba = result.type === 'win' && !renchan ? 0 : s.honba + 1
  let dealer = s.dealer
  let wind = s.roundWind
  if (!renchan) {
    dealer = (s.dealer + 1) % 4
    if (dealer === s.startDealer) wind++
  }
  const scores = result.scoresAfter
  const top = Math.max(...scores)
  const rank = ranking(s, scores)
  let over = false
  if (r.tobi && scores.some((x) => x < 0)) over = true
  // オーラス（延長戦含む）で親が和了ってトップ（返し以上）ならアガリやめ
  if (r.agariYame && result.type === 'win' && renchan && (isAllLast || inExtension) && rank[0] === s.dealer && top >= r.returnPoints) over = true
  // 予定の局が終わった：西入なし・西場も終わった・誰かが返しに届いた → 終局
  if (wind > lastWind && (!r.westRound || wind > lastWind + 1 || top >= r.returnPoints)) over = true
  s.next = { dealer, roundWind: wind, honba, over }
}

/** 結果画面のあと、次の局へ（または終局） */
export function nextRound(s: GameState) {
  if (!s.next) return
  if (s.next.over) {
    finishGame(s)
    return
  }
  s.dealer = s.next.dealer
  s.roundWind = s.next.roundWind
  s.honba = s.next.honba
  startRound(s)
}

function finishGame(s: GameState) {
  const r = s.rules
  const order = ranking(s)
  // 供託はトップ取り
  s.players[order[0]].score += s.riichiSticks * 1000
  s.riichiSticks = 0
  const scores = s.players.map((p) => p.score)
  const uma = [r.uma[1], r.uma[0], -r.uma[0], -r.uma[1]]
  const base = r.oka ? r.returnPoints : r.startPoints
  const oka = r.oka ? ((r.returnPoints - r.startPoints) * 4) / 1000 : 0
  const points = [0, 0, 0, 0]
  order.forEach((seat, i) => {
    points[seat] = Math.round(((scores[seat] - base) / 1000 + uma[i] + (i === 0 ? oka : 0)) * 10) / 10
  })
  s.final = { order, scores, points }
  s.phase = { type: 'gameEnd' }
}

// ---------- その他の補助 ----------
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s))
}

/** 牌の総数が 136 枚であることの確認（テスト用） */
export function checkTileConservation(s: GameState): boolean {
  const seen = new Set<number>()
  const add = (t: Tile) => {
    if (seen.has(t)) throw new Error(`duplicate tile ${t}`)
    seen.add(t)
  }
  for (const p of s.players) {
    p.hand.forEach(add)
    p.melds.forEach((m) => m.tiles.forEach(add))
    p.discards.forEach((d) => {
      if (d.calledBy === null) add(d.tile)
    })
  }
  for (let i = s.drawIndex; i < DEAD_WALL_START - s.kanCount; i++) add(s.wall[i])
  for (let i = DEAD_WALL_START - s.kanCount; i < DEAD_WALL_START; i++) add(s.wall[i])
  for (let i = DEAD_WALL_START + s.rinshanUsed; i < 136; i++) add(s.wall[i])
  return seen.size === 136
}
