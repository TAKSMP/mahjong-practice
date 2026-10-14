// 解説の文章に「麻雀で使う読み方」を足す
//  - 牌の名前：5萬 → ウーワン、13筒 → イーサンピン（数牌はカタカナの読みに）
//  - スジ：1-4-7 → 1-4-7（イースーチー）
//  - 順子の並び：123 → 123（イーリャンサン）
//  - 用語：両面 → 両面（リャンメン）（その文章の最初の1回だけ）
// 問題文・解説文のデータは、牌の名前を「5萬」のように書いたままにして、表示するときにこの関数を通す。

import { NUM_READING, SUIT_READING } from './engine/tiles'

const SUIT_CHARS = '萬筒索'
const SUIT_PLURAL = ['ワンズ', 'ピンズ', 'ソーズ']
const KATAKANA = /[ァ-ヶー]/
const SUIT_WORD_TO_READING: Record<string, string> = { 萬子: 'マンズ', 筒子: 'ピンズ', 索子: 'ソーズ' }

/** 数字（1〜9）の並びの読み方。例: '34' → 'サンスー' */
export function numsReading(digits: string): string {
  return Array.from(digits)
    .map((d) => NUM_READING[Number(d) - 1] ?? d)
    .join('')
}

const SUJI_READING: Record<string, string> = {
  '147': 'イースーチー',
  '258': 'リャンウーパー',
  '369': 'サンローキュー',
}

/** 牌の名前・スジ・順子の並びに読みをつける（用語の読みは足さない） */
export function readTiles(text: string): string {
  let t = text
  // 「萬・筒・索」「萬子」などの種類の名前
  t = t.replace(/萬・筒・索/g, 'マンズ・ピンズ・ソーズ')
  t = t.replace(/萬子|筒子|索子/g, (m) => SUIT_WORD_TO_READING[m])
  // 5萬 / 34萬 / 2-3萬 / 1・4萬 など（数字のあとに 萬筒索）。
  // 3つまでの並びは「サンスーワン」のようにカタカナにする。4つ以上は長くて読みにくいので「ワンズの3445（サンスースーウー）」にする
  t = t.replace(
    new RegExp(`((?:[1-9][・\\-－]?)*[1-9])([${SUIT_CHARS}])`, 'g'),
    (m: string, nums: string, suit: string, offset: number, whole: string) => {
      const count = nums.replace(/[^1-9]/g, '').length
      const reading = nums.replace(/[1-9]/g, (d) => NUM_READING[Number(d) - 1])
      let out: string
      if (count >= 4) {
        // 「123・456・789」のように、まとまりごとに読みをつける。1つずつ離れた数字なら、最後にまとめて読みをつける
        const parts = nums.split(/([・\-－])/)
        const groups = parts.filter((g) => /^[1-9]+$/.test(g))
        const body = groups.every((g) => g.length === 1)
          ? `${nums}（${reading}）`
          : parts.map((g) => (/^[1-9]+$/.test(g) ? `${g}（${numsReading(g)}）` : g)).join('')
        out = `${SUIT_PLURAL[SUIT_CHARS.indexOf(suit)]}の${body}`
      } else out = `${reading}${SUIT_READING[SUIT_CHARS.indexOf(suit)]}`
      // カタカナどうしがくっついて読みにくくならないように、すき間をあける
      const before = whole[offset - 1]
      const after = whole[offset + m.length]
      if (before && KATAKANA.test(before)) out = ` ${out}`
      if (after && KATAKANA.test(after)) out = `${out} `
      return out
    },
  )
  // 1-4-7 / 2-5-8 / 3-6-9（スジ）
  t = t.replace(/(?<![0-9])([1-3])-([4-6])-([7-9])(?![0-9])/g, (m, a: string, b: string, c: string) => {
    const r = SUJI_READING[`${a}${b}${c}`]
    return r ? `${m}（${r}）` : m
  })
  // 123・345 のような、数字が3つ連続した順子の並び（まだ読みがついていないもの）
  t = t.replace(/(?<![0-9])([1-7])([2-8])([3-9])(?![0-9]|（)/g, (m, a: string, b: string, c: string) => {
    return Number(b) === Number(a) + 1 && Number(c) === Number(b) + 1 ? `${m}（${numsReading(m)}）` : m
  })
  return t
}

/** 麻雀用語の読み。長い用語を先に調べる。*/
export const TERM_READINGS: [string, string][] = [
  ['三色同順', 'サンショクドウジュン'],
  ['一気通貫', 'イッツー'],
  ['断么九', 'タンヤオ'],
  ['七対子', 'チートイツ'],
  ['対々和', 'トイトイ'],
  ['中張牌', 'チュンチャンパイ'],
  ['么九牌', 'ヤオチューハイ'],
  ['孤立牌', 'コリツハイ'],
  ['有効牌', 'ユウコウハイ'],
  ['宣言牌', 'センゲンハイ'],
  ['押し引き', 'オシヒキ'],
  ['手変わり', 'テガワリ'],
  ['食い替え', 'クイカエ'],
  ['受け入れ', 'ウケイレ'],
  ['東家', 'トンチャ'],
  ['南家', 'ナンチャ'],
  ['西家', 'シャーチャ'],
  ['北家', 'ペーチャ'],
  ['東場', 'トンバ'],
  ['南場', 'ナンバ'],
  ['現物', 'ゲンブツ'],
  ['片スジ', 'カタスジ'],
  ['両スジ', 'リャンスジ'],
  ['無スジ', 'ムスジ'],
  ['雀頭', 'ジャントウ'],
  ['面子', 'メンツ'],
  ['順子', 'シュンツ'],
  ['刻子', 'コーツ'],
  ['対子', 'トイツ'],
  ['暗刻', 'アンコ'],
  ['門前', 'メンゼン'],
  ['放銃', 'ホウジュウ'],
  ['役牌', 'ヤクハイ'],
  ['場風', 'バカゼ'],
  ['自風', 'ジカゼ'],
  ['平和', 'ピンフ'],
  ['立直', 'リーチ'],
  ['満貫', 'マンガン'],
  ['跳満', 'ハネマン'],
  ['倍満', 'バイマン'],
  ['役満', 'ヤクマン'],
  ['副底', 'フーテイ'],
  ['副露', 'フーロ'],
  ['両面', 'リャンメン'],
  ['字牌', 'ジハイ'],
  ['数牌', 'スーパイ'],
  ['端牌', 'ハシパイ'],
  ['打点', 'ダテン'],
  ['好形', 'コウケイ'],
  ['愚形', 'グケイ'],
  ['連荘', 'レンチャン'],
  ['流局', 'リュウキョク'],
  ['手牌', 'テハイ'],
  ['捨て牌', 'ステハイ'],
  ['巡目', 'ジュンメ'],
  ['親番', 'オヤバン'],
]

/** 用語の読みを、その文章の「最初の1回だけ」（）で足す。すでに（）が続いているものは足さない。 */
export function readTerms(text: string): string {
  let t = text
  for (const [term, reading] of TERM_READINGS) {
    const i = t.indexOf(term)
    if (i < 0) continue
    const after = t.slice(i + term.length)
    // すでに（）が続いているときは、足さない
    if (after.startsWith('（')) continue
    t = `${t.slice(0, i + term.length)}（${reading}）${after}`
  }
  return t
}

/** 文章に、牌の名前・スジ・用語の読みをつける */
export function rd(text: string): string {
  return readTerms(readTiles(text))
}

/** 牌の名前・スジだけに読みをつける（見出しなど、短い文字用） */
export function rdTiles(text: string): string {
  return readTiles(text)
}
