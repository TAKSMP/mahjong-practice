import { describe, expect, it } from 'vitest'
import { kindLabel, kindParts, kindReading } from '../engine/tiles'
import { numsReading, rd, readTerms, readTiles } from '../reading'

describe('牌の名前（カタカナ）', () => {
  it('数牌は イーワン…キューワン、イーピン…、イーソー…', () => {
    const wan = Array.from({ length: 9 }, (_, i) => kindReading(i))
    expect(wan).toEqual(['イーワン', 'リャンワン', 'サンワン', 'スーワン', 'ウーワン', 'ローワン', 'チーワン', 'パーワン', 'キューワン'])
    expect(kindReading(9)).toBe('イーピン')
    expect(kindReading(17)).toBe('キューピン')
    expect(kindReading(18)).toBe('イーソー')
    expect(kindReading(26)).toBe('キューソー')
  })

  it('字牌は トン・ナン・シャー・ペー・ハク・ハツ・チュン', () => {
    expect([27, 28, 29, 30, 31, 32, 33].map(kindReading)).toEqual(['トン', 'ナン', 'シャー', 'ペー', 'ハク', 'ハツ', 'チュン'])
  })

  it('文章に出す名前：数牌はカタカナ、字牌は 北（ペー）', () => {
    expect(kindLabel(13)).toBe('ウーピン')
    expect(kindLabel(30)).toBe('北（ペー）')
    expect(kindParts(13)).toEqual(['ウー', 'ピン'])
    expect(kindParts(33)).toEqual(['チュン'])
  })
})

describe('解説の読み仮名', () => {
  it('5萬・34萬・13筒 など、数牌の名前をカタカナにする', () => {
    expect(readTiles('5萬を切る')).toBe('ウーワンを切る')
    expect(readTiles('34萬と13筒')).toBe('サンスーワンとイーサンピン')
    expect(readTiles('9索が出た')).toBe('キューソーが出た')
    expect(readTiles('赤5筒')).toBe('赤ウーピン')
    // カタカナの前後にくっつくときは、すき間をあける
    expect(readTiles('12萬ペンチャン')).toBe('イーリャンワン ペンチャン')
    expect(readTiles('ドラ4萬')).toBe('ドラ スーワン')
  })

  it('「1・4萬」「2-3萬」「2・3・4・6・8索」のように数字をつなげた書き方も読む', () => {
    expect(readTiles('1・4萬待ち')).toBe('イー・スーワン待ち')
    expect(readTiles('2-3萬の形')).toBe('リャン-サンワンの形')
    // 4つ以上の並びは、読みにくいので「ソーズの…（読み）」の形にする
    expect(readTiles('2・3・4・6・8索と發')).toBe('ソーズの2・3・4・6・8（リャン・サン・スー・ロー・パー）と發')
    expect(readTiles('3445萬は')).toBe('ワンズの3445（サンスースーウー）は')
    expect(readTiles('123・456・789萬')).toBe('ワンズの123（イーリャンサン）・456（スーウーロー）・789（チーパーキュー）')
  })

  it('萬・筒・索 の種類の名前は マンズ・ピンズ・ソーズ', () => {
    expect(readTiles('萬・筒・索の3色')).toBe('マンズ・ピンズ・ソーズの3色')
    expect(readTiles('萬子と字牌')).toBe('マンズと字牌')
  })

  it('スジ：1-4-7（イースーチー）・2-5-8（リャンウーパー）・3-6-9（サンローキュー）', () => {
    expect(readTiles('1-4-7のスジ')).toBe('1-4-7（イースーチー）のスジ')
    expect(readTiles('2-5-8、3-6-9')).toBe('2-5-8（リャンウーパー）、3-6-9（サンローキュー）')
  })

  it('順子の並び 123・456・789 にも読みをつける（点数の 3900 などは変えない）', () => {
    expect(readTiles('123・456・789')).toBe('123（イーリャンサン）・456（スーウーロー）・789（チーパーキュー）')
    expect(readTiles('3900点と12000点、1234')).toBe('3900点と12000点、1234')
    expect(numsReading('34')).toBe('サンスー')
  })

  it('用語の読みは、最初の1回だけ足す', () => {
    expect(readTerms('両面待ちは、両面が基本')).toBe('両面（リャンメン）待ちは、両面が基本')
    expect(readTerms('現物（ゲンブツ）と現物')).toBe('現物（ゲンブツ）と現物')
    expect(rd('4萬は現物です')).toBe('スーワンは現物（ゲンブツ）です')
  })
})
