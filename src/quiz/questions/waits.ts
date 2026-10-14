// 分野B：待ちの形
// 待ち牌は、エンジンの計算（waitingKinds）と照合する。

import type { Question } from '../types'

const ASK_WAIT = 'テンパイしています。待ちの牌をすべて選ぼう'

export const WAITS: Question[] = [
  // ---------------------------------------------------------------- B1 両面
  {
    type: 'wait',
    pattern: 'B1',
    prompt: ASK_WAIT,
    hand: '4m5m9m9m2p3p4p5p6p7p7s8s9s',
    options: '2m3m5m6m7m9m',
    answers: '3m6m',
    why: '45萬が両面ターツ。3萬が来れば345、6萬が来れば456で順子ができ、和了です。99萬は雀頭、ほかは面子です。',
  },
  {
    type: 'wait',
    pattern: 'B1',
    prompt: ASK_WAIT,
    hand: '1m2m3m5m5m2s3s4s5s6s7s7p8p',
    options: '4p5p6p7p8p9p',
    answers: '6p9p',
    why: '78筒が両面。6筒が来れば678、9筒が来れば789で順子ができます。55萬は雀頭です。',
    note: '7筒・8筒は、手牌にすでにあるので待ちではありません。',
  },

  // ---------------------------------------------------------------- B2 カンチャン・ペンチャン
  {
    type: 'wait',
    pattern: 'B2',
    prompt: ASK_WAIT,
    hand: '5s7s9m9m2m3m4m5p6p7p7p8p9p',
    options: '4s5s6s7s8s',
    answers: '6s',
    why: '57索は、間が1つ空いたカンチャン。間の6索だけが待ちです（4枚まで）。',
  },
  {
    type: 'wait',
    pattern: 'B2',
    prompt: ASK_WAIT,
    hand: '1p2p9m9m2m3m4m5s6s7s7s8s9s',
    options: '1p2p3p4p5p',
    answers: '3p',
    why: '12筒は、端によったペンチャン。3筒だけが待ちです。両面（45など）と違い、1筒を引いても完成しません。',
  },
  {
    type: 'wait',
    pattern: 'B2',
    prompt: ASK_WAIT,
    hand: '8s9s1m1m2m3m4m5p6p7p7p8p9p',
    options: '5s6s7s8s9s',
    answers: '7s',
    why: '89索も、端によったペンチャン。7索だけが待ちです。（12は3待ち、89は7待ちと覚えます）',
  },

  // ---------------------------------------------------------------- B3 単騎・シャンポン
  {
    type: 'wait',
    pattern: 'B3',
    prompt: ASK_WAIT,
    hand: '5m5m8p8p2m3m4m5s6s7s7s8s9s',
    options: '5m6m8m5p8p',
    answers: '5m8p',
    why: '55萬と88筒の2つの対子が待ち。どちらか1枚が来れば、その対子が刻子（555 か 888）になって和了です。もう片方が雀頭になります。',
    note: 'シャンポン待ちは、2種類の牌が待ち。それぞれ残りは2枚ずつです。',
  },
  {
    type: 'wait',
    pattern: 'B3',
    prompt: ASK_WAIT,
    hand: '5m1m2m3m2p3p4p5p6p7p7s8s9s',
    options: '3m4m5m6m7m',
    answers: '5m',
    why: '面子が4つ完成していて、5萬が1枚だけ余っています。もう1枚の5萬が来れば雀頭ができて和了。これが単騎待ちです。',
  },

  // ---------------------------------------------------------------- B4 連続形
  {
    type: 'wait',
    pattern: 'B4',
    prompt: ASK_WAIT,
    hand: '3m4m5m6m2p3p4p5p6p7p7s8s9s',
    options: '2m3m4m5m6m7m',
    answers: '3m6m',
    why: '3456萬は、「3＋456」と見れば3萬単騎、「345＋6」と見れば6萬単騎。つまり3萬と6萬のどちらでも和了れます（ノベタン）。2萬や7萬は待ちではありません。',
  },
  {
    type: 'wait',
    pattern: 'B4',
    prompt: ASK_WAIT,
    hand: '2m3m4m5m6m2p3p4p5p6p7p1s1s',
    options: '1m2m3m4m5m6m7m',
    answers: '1m4m7m',
    why: '23456萬は、「23＋456」なら1・4萬、「234＋56」なら4・7萬が待ち。合わせて1・4・7萬の三面張です。',
  },
  {
    type: 'wait',
    pattern: 'B4',
    prompt: ASK_WAIT,
    hand: '3m4m5m6m7m2p3p4p5p6p7p1s1s',
    options: '1m2m5m8m9m',
    answers: '2m5m8m',
    why: '34567萬は、「34＋567」なら2・5萬、「345＋67」なら5・8萬が待ち。合わせて2・5・8萬の三面張。5連続の形は、1つ空けた3種類が待ちになります。',
  },

  // ---------------------------------------------------------------- B5 多面張
  {
    type: 'wait',
    pattern: 'B5',
    prompt: ASK_WAIT,
    hand: '1m1m1m2m2p3p4p5p6p7p7s8s9s',
    options: '1m2m3m4m',
    answers: '2m3m',
    why: '1112萬は、「111＋2」なら2萬の単騎、「11＋12」なら3萬のペンチャン。2萬と3萬のどちらでも和了です。',
  },
  {
    type: 'wait',
    pattern: 'B5',
    prompt: ASK_WAIT,
    hand: '4m4m4m5m2p3p4p5p6p7p7s8s9s',
    options: '2m3m4m5m6m7m',
    answers: '3m5m6m',
    why: '4445萬は、「444＋5」なら5萬の単騎、「44＋45」なら3・6萬の両面。3・5・6萬の三面張です。',
    note: '4萬は、すでに手牌に3枚あるので、4枚目を引いても和了れません。',
  },

  // ---------------------------------------------------------------- B6 フリテン
  {
    type: 'choice',
    pattern: 'B6',
    prompt: 'この手は45萬待ち。あなたの河には3萬があります。他家が6萬を捨てました。ロンできる？',
    show: [
      { label: 'あなたの手牌', tiles: '4m5m9m9m2p3p4p5p6p7p7s8s9s' },
      { label: 'あなたの河', tiles: '3m北東2s' },
    ],
    options: ['6萬ならロンできる', '3萬ならロンできる', '3萬でも6萬でもロンできる', 'どちらもロンできない（ツモ和了りだけ）'],
    answer: 3,
    verify: { kind: 'furiten', hand: '4m5m9m9m2p3p4p5p6p7p7s8s9s', river: '3m北東2s', expect: true },
    why: '待ちの牌（3萬か6萬）を1枚でも自分で捨てていると、待ちが全部ロンできなくなります（フリテン）。3萬を捨てているので、6萬でもロンできません。ツモなら和了れます。',
  },
  {
    type: 'choice',
    pattern: 'B6',
    prompt: 'リーチをかけたあと、和了牌が出たのに見逃してしまいました。その後はどうなる？',
    options: ['次の順目から、普通にロンできる', 'その局が終わるまで、ずっとフリテン（ツモ和了りだけ）', '一周だけフリテン', 'リーチが取り消される'],
    answer: 1,
    why: 'リーチ後に和了牌を見逃すと、その局が終わるまでずっとフリテンです（ツモ和了りは可能）。ロンできるときは見逃さず、必ずロンしましょう。',
  },

  // ---------------------------------------------------------------- B7 待ちの残り枚数
  {
    type: 'choice',
    pattern: 'B7',
    prompt: '待ちは4萬だけです。4萬は河に1枚出ています。あと何枚残っている？',
    show: [
      { label: 'あなたの手牌', tiles: '3m4m4m5m2p3p4p5p6p7p7s8s9s' },
      { label: '河に出ている4萬', tiles: '4m' },
    ],
    options: ['0枚', '1枚', '2枚', '3枚'],
    answer: 1,
    verify: { kind: 'remaining', hand: '3m4m4m5m2p3p4p5p6p7p7s8s9s', visible: '4m', expect: 1 },
    why: '4萬は全部で4枚。自分の手牌に2枚、河に1枚で、残りは1枚だけです。3445の形は両面に見えますが、実際の待ちは4萬だけ（345＋4、または44＋35のカンチャン）。',
  },
  {
    type: 'choice',
    pattern: 'B7',
    prompt: '45萬の両面待ちです。河に3萬が2枚、6萬が1枚出ています。待ちは合計で何枚残っている？',
    show: [
      { label: 'あなたの手牌', tiles: '4m5m9m9m2p3p4p5p6p7p7s8s9s' },
      { label: '河に出ている牌', tiles: '3m3m6m' },
    ],
    options: ['3枚', '5枚', '7枚', '8枚'],
    answer: 1,
    verify: { kind: 'remaining', hand: '4m5m9m9m2p3p4p5p6p7p7s8s9s', visible: '3m3m6m', expect: 5 },
    why: '3萬は4枚中2枚が見えていて残り2枚、6萬は4枚中1枚が見えていて残り3枚。合計5枚です。両面は最大8枚ですが、見えている牌が多いと、実際はそれより少なくなります。',
  },
]
