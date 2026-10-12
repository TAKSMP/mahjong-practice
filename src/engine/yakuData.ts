// 役の一覧（ヘルプ画面・和了画面の解説用）

export interface YakuInfo {
  id: string
  name: string
  reading: string
  /** 門前の翻数（役満は 13） */
  han: number
  /** 鳴いたときの翻数。0 = 鳴くと不成立 */
  openHan: number
  yakuman?: boolean
  desc: string
  example?: string
}

export const YAKU_LIST: YakuInfo[] = [
  { id: 'riichi', name: '立直', reading: 'リーチ', han: 1, openHan: 0, desc: '鳴かずにテンパイしたときに宣言（1000点を供託）。以後は手を変えられない代わりに、役がなくても和了れる。' },
  { id: 'ippatsu', name: '一発', reading: 'イッパツ', han: 1, openHan: 0, desc: 'リーチ後、鳴きが入らずに1巡以内に和了る。' },
  { id: 'tsumo', name: '門前清自摸和', reading: 'メンゼンツモ', han: 1, openHan: 0, desc: '鳴かずに、自分で引いて和了る（ツモ）。' },
  { id: 'pinfu', name: '平和', reading: 'ピンフ', han: 1, openHan: 0, desc: '鳴かずに、順子4つ＋役牌でない雀頭で、両面待ちで和了る。符がつかない手。', example: '23m456m678p345s99s' },
  { id: 'tanyao', name: '断么九', reading: 'タンヤオ', han: 1, openHan: 1, desc: '2〜8の数牌だけで作る（1・9・字牌を使わない）。喰いタンありなら鳴いても可。' },
  { id: 'iipeiko', name: '一盃口', reading: 'イーペーコー', han: 1, openHan: 0, desc: '鳴かずに、同じ順子を2つ作る。', example: '223344m' },
  { id: 'yakuhai', name: '役牌', reading: 'ヤクハイ', han: 1, openHan: 1, desc: '白・發・中、場風（東場なら東）、自風の刻子（3枚組）。1つにつき1翻。' },
  { id: 'haitei', name: '海底摸月', reading: 'ハイテイ', han: 1, openHan: 1, desc: '最後の1枚をツモって和了る。' },
  { id: 'houtei', name: '河底撈魚', reading: 'ホウテイ', han: 1, openHan: 1, desc: '最後の捨て牌でロン和了する。' },
  { id: 'rinshan', name: '嶺上開花', reading: 'リンシャンカイホウ', han: 1, openHan: 1, desc: 'カンをして引いた嶺上牌で和了る。' },
  { id: 'chankan', name: '槍槓', reading: 'チャンカン', han: 1, openHan: 1, desc: '他人が加槓した牌でロン和了する。' },
  { id: 'doubleRiichi', name: 'ダブル立直', reading: 'ダブルリーチ', han: 2, openHan: 0, desc: '最初の捨て牌でリーチ（その前に鳴きがないこと）。' },
  { id: 'chiitoitsu', name: '七対子', reading: 'チートイツ', han: 2, openHan: 0, desc: '対子（2枚組）を7つ作る特殊な形。25符固定。' },
  { id: 'sanshoku', name: '三色同順', reading: 'サンショクドウジュン', han: 2, openHan: 1, desc: '萬子・筒子・索子で同じ数字の順子を作る。', example: '123m 123p 123s' },
  { id: 'ittsu', name: '一気通貫', reading: 'イッキツウカン', han: 2, openHan: 1, desc: '同じ種類で 123・456・789 をそろえる。', example: '123456789p' },
  { id: 'chanta', name: '混全帯么九', reading: 'チャンタ', han: 2, openHan: 1, desc: 'すべての面子と雀頭に、1・9か字牌が入っている。' },
  { id: 'toitoi', name: '対々和', reading: 'トイトイ', han: 2, openHan: 2, desc: '面子をすべて刻子（3枚組）で作る。' },
  { id: 'sanankou', name: '三暗刻', reading: 'サンアンコウ', han: 2, openHan: 2, desc: '鳴かずに作った刻子が3つ。' },
  { id: 'sanshokuDoukou', name: '三色同刻', reading: 'サンショクドウコウ', han: 2, openHan: 2, desc: '3種類で同じ数字の刻子を作る。' },
  { id: 'sankantsu', name: '三槓子', reading: 'サンカンツ', han: 2, openHan: 2, desc: 'カンを3回する。' },
  { id: 'shousangen', name: '小三元', reading: 'ショウサンゲン', han: 2, openHan: 2, desc: '白發中のうち2つが刻子、1つが雀頭。（役牌2つも別につく）' },
  { id: 'honroutou', name: '混老頭', reading: 'ホンロウトウ', han: 2, openHan: 2, desc: '1・9と字牌だけで作る。' },
  { id: 'ryanpeikou', name: '二盃口', reading: 'リャンペーコー', han: 3, openHan: 0, desc: '一盃口を2つ作る。' },
  { id: 'honitsu', name: '混一色', reading: 'ホンイツ', han: 3, openHan: 2, desc: '1種類の数牌＋字牌だけで作る。' },
  { id: 'junchan', name: '純全帯么九', reading: 'ジュンチャン', han: 3, openHan: 2, desc: 'すべての面子と雀頭に1か9が入っている（字牌なし）。' },
  { id: 'chinitsu', name: '清一色', reading: 'チンイツ', han: 6, openHan: 5, desc: '1種類の数牌だけで作る。' },
  { id: 'kokushi', name: '国士無双', reading: 'コクシムソウ', han: 13, openHan: 0, yakuman: true, desc: '1・9・字牌の13種類を1枚ずつ＋どれか1つをもう1枚。' },
  { id: 'suuankou', name: '四暗刻', reading: 'スーアンコウ', han: 13, openHan: 0, yakuman: true, desc: '鳴かずに刻子を4つ作る。' },
  { id: 'daisangen', name: '大三元', reading: 'ダイサンゲン', han: 13, openHan: 13, yakuman: true, desc: '白・發・中をすべて刻子にする。' },
  { id: 'tsuuiisou', name: '字一色', reading: 'ツーイーソー', han: 13, openHan: 13, yakuman: true, desc: '字牌だけで作る。' },
  { id: 'ryuuiisou', name: '緑一色', reading: 'リューイーソー', han: 13, openHan: 13, yakuman: true, desc: '2・3・4・6・8索と發だけで作る。' },
  { id: 'chinroutou', name: '清老頭', reading: 'チンロウトウ', han: 13, openHan: 13, yakuman: true, desc: '1と9の数牌だけで作る。' },
  { id: 'shousuushii', name: '小四喜', reading: 'ショウスーシー', han: 13, openHan: 13, yakuman: true, desc: '東南西北のうち3つが刻子、1つが雀頭。' },
  { id: 'daisuushii', name: '大四喜', reading: 'ダイスーシー', han: 13, openHan: 13, yakuman: true, desc: '東南西北をすべて刻子にする。' },
  { id: 'chuuren', name: '九蓮宝燈', reading: 'チューレンポウトウ', han: 13, openHan: 0, yakuman: true, desc: '1種類で 1112345678999＋どれか1枚。' },
  { id: 'suukantsu', name: '四槓子', reading: 'スーカンツ', han: 13, openHan: 13, yakuman: true, desc: 'カンを4回する。' },
  { id: 'tenhou', name: '天和', reading: 'テンホー', han: 13, openHan: 0, yakuman: true, desc: '親が配牌で和了っている。' },
  { id: 'chiihou', name: '地和', reading: 'チーホー', han: 13, openHan: 0, yakuman: true, desc: '子が最初のツモで和了る（それまでに鳴きがないこと）。' },
]

export const YAKU_BY_ID: Record<string, YakuInfo> = Object.fromEntries(YAKU_LIST.map((y) => [y.id, y]))
