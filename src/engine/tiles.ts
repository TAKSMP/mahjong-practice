// 牌の表現
// - 牌の「種類」(kind) は 0..33
//     0..8   萬子 1〜9
//     9..17  筒子 1〜9
//     18..26 索子 1〜9
//     27..30 東南西北
//     31..33 白發中
// - 実際の牌 (Tile) は 0..135 の通し番号。種類 = id >> 2（各種類4枚）
// - 赤ドラはルールで決まる特定の id（state.redTiles）で表す

export type Tile = number
export type Kind = number

export const KIND_COUNT = 34
export const TILE_COUNT = 136

export const kindOf = (t: Tile): Kind => t >> 2

export const suitOf = (k: Kind): number => (k < 27 ? Math.floor(k / 9) : 3) // 0萬 1筒 2索 3字
export const numOf = (k: Kind): number => (k < 27 ? (k % 9) + 1 : 0)
export const isHonor = (k: Kind) => k >= 27
export const isWind = (k: Kind) => k >= 27 && k <= 30
export const isDragon = (k: Kind) => k >= 31
export const isTerminal = (k: Kind) => k < 27 && (k % 9 === 0 || k % 9 === 8)
export const isYaochu = (k: Kind) => isHonor(k) || isTerminal(k)
export const isSimple = (k: Kind) => !isYaochu(k)

export const YAOCHU_KINDS: Kind[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
export const GREEN_KINDS = new Set<Kind>([19, 20, 21, 23, 25, 32]) // 2348 6索 + 發

/** 赤ドラに使う牌 id。5萬・5筒・5索の1枚目（4枚ルールでは5筒をもう1枚） */
export function redTileIds(akaCount: number): number[] {
  if (akaCount <= 0) return []
  const ids = [4 * 4, 13 * 4, 22 * 4]
  if (akaCount >= 4) ids.push(13 * 4 + 1)
  return ids
}

/** ドラ表示牌 → ドラ */
export function doraFromIndicator(k: Kind): Kind {
  if (k < 27) {
    const s = Math.floor(k / 9) * 9
    return s + (((k % 9) + 1) % 9)
  }
  if (k <= 30) return 27 + ((k - 27 + 1) % 4)
  return 31 + ((k - 31 + 1) % 3)
}

const SUIT_CHAR = ['m', 'p', 's']
const HONOR_SHORT = ['東', '南', '西', '北', '白', '發', '中']
const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const SUIT_JP = ['萬', '筒', '索']
export const NUM_READING = ['イー', 'リャン', 'サン', 'スー', 'ウー', 'ロー', 'チー', 'パー', 'キュー']
export const SUIT_READING = ['ワン', 'ピン', 'ソー']
export const HONOR_READING = ['トン', 'ナン', 'シャー', 'ペー', 'ハク', 'ハツ', 'チュン']

/** 例: 5m / 東 */
export function kindShort(k: Kind): string {
  if (k >= 27) return HONOR_SHORT[k - 27]
  return `${numOf(k)}${SUIT_CHAR[suitOf(k)]}`
}

/** 例: ウーワン / ペー （牌の読み方。カタカナだけ） */
export function kindReading(k: Kind): string {
  if (k >= 27) return HONOR_READING[k - 27]
  return NUM_READING[numOf(k) - 1] + SUIT_READING[suitOf(k)]
}

/** 牌の下に2段で出す読み方。例: ['ウー', 'ワン'] / ['ペー'] */
export function kindParts(k: Kind): string[] {
  if (k >= 27) return [HONOR_READING[k - 27]]
  return [NUM_READING[numOf(k) - 1], SUIT_READING[suitOf(k)]]
}

/**
 * 画面の文章に出す牌の名前。数牌は麻雀で使う読み方（イーピン・ウーワン…）、字牌は 北（ペー）。
 * 例: 5萬 → ウーワン / 東 → 東（トン）
 */
export function kindLabel(k: Kind): string {
  if (k >= 27) return `${HONOR_SHORT[k - 27]}（${HONOR_READING[k - 27]}）`
  return kindReading(k)
}

/** 例: 五萬 */
export function kindKanji(k: Kind): string {
  if (k >= 27) return HONOR_SHORT[k - 27]
  return `${KANJI_NUM[numOf(k) - 1]}${SUIT_JP[suitOf(k)]}`
}

export const WIND_NAMES = ['東', '南', '西', '北']

/** 種類ごとの枚数配列にする */
export function toCounts(tiles: Tile[]): number[] {
  const c = new Array(KIND_COUNT).fill(0)
  for (const t of tiles) c[kindOf(t)]++
  return c
}

export function kindsToCounts(kinds: Kind[]): number[] {
  const c = new Array(KIND_COUNT).fill(0)
  for (const k of kinds) c[k]++
  return c
}

/** 理牌（並べ替え）。同じ種類なら赤を先に */
export function sortTiles(tiles: Tile[], redSet?: Set<number>): Tile[] {
  return [...tiles].sort((a, b) => {
    const d = kindOf(a) - kindOf(b)
    if (d !== 0) return d
    if (redSet) {
      const ra = redSet.has(a) ? 0 : 1
      const rb = redSet.has(b) ? 0 : 1
      if (ra !== rb) return ra - rb
    }
    return a - b
  })
}

/** "123m456p東東" のような文字列から種類の配列を作る（テスト用） */
export function parseKinds(s: string): Kind[] {
  const out: Kind[] = []
  let nums: number[] = []
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      nums.push(Number(ch))
      continue
    }
    const si = 'mps'.indexOf(ch)
    if (si >= 0) {
      for (const n of nums) out.push(si * 9 + (n === 0 ? 5 : n) - 1)
      nums = []
      continue
    }
    if (ch === 'z') {
      for (const n of nums) out.push(27 + n - 1)
      nums = []
      continue
    }
    const hi = HONOR_SHORT.indexOf(ch)
    if (hi >= 0) out.push(27 + hi)
  }
  return out
}
