import { describe, expect, it } from 'vitest'
import { evaluateWin, calcPayment, type WinInput, type MeldInfo } from '../yaku'
import { parseKinds } from '../tiles'
import { DEFAULT_RULES } from '../rules'

function win(hand: string, winTile: string, opt: Partial<WinInput> = {}, melds: MeldInfo[] = []) {
  const w = parseKinds(winTile)[0]
  return evaluateWin({
    closed: [...parseKinds(hand), w],
    melds,
    winKind: w,
    tsumo: false,
    seatWind: 28, // 南家
    roundWind: 27,
    doraKinds: [],
    uraKinds: [],
    akaCount: 0,
    rules: DEFAULT_RULES,
    ...opt,
  })
}
const names = (r: ReturnType<typeof win>) => r?.yaku.map((y) => y.name).sort()

describe('役', () => {
  it('平和ロン 30符', () => {
    const r = win('23m456p678p345s99s', '1m', { riichi: true })
    expect(names(r)).toEqual(['平和', '立直'].sort())
    expect(r!.fu).toBe(30)
    expect(r!.han).toBe(2)
    expect(r!.base).toBe(480)
  })
  it('平和ツモ 20符', () => {
    const r = win('23m456p678p345s99s', '4m', { tsumo: true })
    expect(names(r)).toEqual(['平和', '門前清自摸和'].sort())
    expect(r!.fu).toBe(20)
  })
  it('役なしは null', () => {
    expect(win('23m456p678p345s99z', '1m')).toBeNull() // 雀頭が北でも南家なので役牌ではない → 役なし
  })
  it('三色同順', () => {
    const r = win('234m234p23s678s55p', '4s')
    expect(names(r)).toContain('三色同順')
    expect(names(r)).toContain('断么九')
  })
  it('一気通貫', () => {
    const r = win('123456789p11z23s', '1s')
    expect(names(r)).toContain('一気通貫')
  })
  it('七対子', () => {
    const r = win('1133m5577p22s667z', '7z')
    expect(names(r)).toEqual(['七対子'])
    expect(r!.fu).toBe(25)
  })
  it('二盃口は七対子より優先', () => {
    const r = win('112233m556677p8s', '8s')
    expect(names(r)).toContain('二盃口')
  })
  it('役牌＋符', () => {
    const r = win('555z123m456p78s99m', '9s')
    expect(names(r)).toEqual(['役牌 白'])
    expect(r!.fu).toBe(40) // 20+10(門前ロン)+8(暗刻白) = 38→40
  })
  it('国士無双', () => {
    const r = win('19m19p19s1234567z', '1m')
    expect(r!.yakuman).toBe(2) // 十三面
    const r2 = win('19m19p19s1234566z', '7z')
    expect(r2!.yakuman).toBe(1)
  })
  it('四暗刻（ツモ）', () => {
    const r = win('111m222p333s444z5z', '5z', { tsumo: true })
    expect(r!.yakuman).toBe(2) // 単騎
    const r2 = win('111m222p333s44z55z', '5z', { tsumo: true })
    expect(r2!.yakuman).toBe(1)
    const r3 = win('111m222p333s44z55z', '5z', { tsumo: false })
    expect(r3!.yakuman).toBe(0) // ロンだと三暗刻
    expect(names(r3)).toContain('三暗刻')
  })
  it('大三元', () => {
    const r = win('555666777z11m23p', '1p')
    expect(r!.yaku[0].name).toBe('大三元')
  })
  it('九蓮宝燈', () => {
    const r = win('1112345678999m', '5m', { tsumo: true })
    expect(r!.yaku[0].name).toBe('純正九蓮宝燈')
  })
  it('清一色', () => {
    const r = win('1122334455667s', '7s')
    expect(names(r)).toContain('清一色')
  })
  it('喰いタン', () => {
    const melds: MeldInfo[] = [{ type: 'pon', kind: 4 }]
    const r = win('234p678s56s88m', '7s', {}, melds)
    expect(names(r)).toEqual(['断么九'])
    expect(r!.fu).toBe(30)
    const r2 = win('234p678s56s88m', '7s', { rules: { ...DEFAULT_RULES, kuitan: false } }, melds)
    expect(r2).toBeNull()
  })
  it('ドラ', () => {
    const r = win('23m456p678p345s99s', '1m', { riichi: true, doraKinds: [26], uraKinds: [13], akaCount: 1 })
    expect(r!.dora).toBe(2)
    expect(r!.ura).toBe(1)
    expect(r!.han).toBe(6) // 立直1 平和1 ドラ2 裏1 赤1
    expect(r!.limit).toBe('跳満')
  })
  it('支払い', () => {
    expect(calcPayment(960, false, false, 0).ron).toBe(3900)
    expect(calcPayment(960, true, false, 1).ron).toBe(5800 + 300)
    const t = calcPayment(2000, false, true, 0)
    expect([t.tsumoChild, t.tsumoDealer]).toEqual([2000, 4000])
    expect(calcPayment(320, false, true, 0)).toMatchObject({ tsumoChild: 400, tsumoDealer: 700 })
  })
})
