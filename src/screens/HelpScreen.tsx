// 役・用語・点数の解説（初心者向け）

import { useState } from 'react'
import { parseKinds } from '../engine/tiles'
import { YAKU_LIST } from '../engine/yakuData'
import { TileView } from '../components/Tile'
import { SafetyGuide } from '../components/SafetyGuide'

const TERMS: { term: string; desc: string }[] = [
  { term: '和了（あがり）', desc: '4つの面子（3枚組）と1つの雀頭（2枚組）をそろえ、役が1つ以上あると和了れます。自分で引けば「ツモ」、他人の捨て牌なら「ロン」。' },
  { term: '面子（メンツ）', desc: '3枚組のこと。順子（同じ種類の連続した数 例:345萬）と刻子（同じ牌3枚 例:東東東）があります。' },
  { term: '雀頭（ジャントウ）', desc: '同じ牌2枚の組（対子）。和了の形には1つ必要です。' },
  { term: 'テンパイ', desc: 'あと1枚で和了れる状態。待っている牌を「待ち」と言います。' },
  { term: 'シャンテン', desc: 'テンパイまであと何枚必要か。1シャンテン＝あと1枚でテンパイ。このアプリのヒントはシャンテン数を減らす牌を基準にしています。' },
  { term: '受け入れ（有効牌）', desc: '引くとシャンテン数が進む牌のこと。その残り枚数が多いほど手が早く進みます。ヒントの数字はこの枚数です。' },
  { term: '役（ヤク）', desc: '和了るために必要な条件。リーチ・タンヤオ・役牌などがあります。役がないと和了れません（ドラは役ではありません）。' },
  { term: 'ドラ', desc: 'ドラ表示牌の「次」の牌。持っていると1枚につき1翻アップ。例：表示牌が3萬ならドラは4萬、北なら東、中なら白。' },
  { term: '翻（ハン）と符（フ）', desc: '点数を決める2つの数。翻は役やドラの合計、符は手の形（刻子・待ち方など）で決まります。5翻以上は符に関係なく満貫などになります。' },
  { term: '門前（メンゼン）', desc: 'ポン・チー・明槓をしていない状態。リーチは門前でないとできません。' },
  { term: 'ポン・チー・カン', desc: 'ポン＝他人の捨て牌で刻子を作る。チー＝左隣（上家）の捨て牌で順子を作る。カン＝同じ牌4枚で槓子を作る（嶺上牌を1枚引く）。' },
  { term: 'フリテン', desc: '自分の待ちの牌を自分で捨てていると、ロンできません（ツモなら和了れる）。見逃した直後やリーチ後の見逃しもフリテンになります。' },
  { term: '現物（げんぶつ）', desc: 'リーチした人がすでに捨てている牌。その人には絶対にロンされない、いちばん安全な牌です。（くわしくは「守り方」タブ）' },
  { term: 'スジ', desc: '1-4-7、2-5-8、3-6-9 の3つおきの関係。相手が4を捨てていると、1と7は「両面待ち」には当たりません。（図つきの解説は「守り方」タブ）' },
  { term: 'カベ', desc: '同じ牌が4枚とも見えていること。誰も持てないので、その牌を使った両面待ちが消え、近くの牌が安全になります。（図つきの解説は「守り方」タブ）' },
  { term: '押し引き', desc: 'リーチを受けたときに、勝負する（押す）か、安全な牌で守る（降りる・オリる）かの判断。' },
  { term: '親と子', desc: '東家（トンチャ）が親。親の和了は点数が1.5倍。親が和了るかテンパイで流局すると親が続きます（連荘）。' },
  { term: '本場（ほんば）', desc: '連荘や流局のたびに1つ増え、和了った人に1本場あたり300点が加算されます。' },
]

const SCORE_ROWS: [string, string, string][] = [
  ['1翻30符', '1000', '1500'],
  ['2翻30符', '2000', '2900'],
  ['3翻30符', '3900', '5800'],
  ['4翻30符', '7700', '11600'],
  ['満貫（5翻）', '8000', '12000'],
  ['跳満（6-7翻）', '12000', '18000'],
  ['倍満（8-10翻）', '16000', '24000'],
  ['三倍満（11-12翻）', '24000', '36000'],
  ['役満', '32000', '48000'],
]

function Example({ s }: { s: string }) {
  return (
    <div className="example">
      {parseKinds(s).map((k, i) => (
        <TileView key={i} kind={k} className="tile-xs" />
      ))}
    </div>
  )
}

export function HelpScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'yaku' | 'terms' | 'score' | 'app' | 'defense'>('app')
  return (
    <div className="page">
      <div className="page-head">
        <button className="icon-btn" onClick={onBack}>
          ←
        </button>
        <h2>解説</h2>
      </div>
      <div className="tabs">
        {(
          [
            ['app', 'このアプリ'],
            ['defense', '守り方'],
            ['yaku', '役一覧'],
            ['terms', '用語'],
            ['score', '点数'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'app' ? (
        <div className="help-body">
          <h3>遊び方</h3>
          <p>あなた（下）と CPU 3人で対局します。自分の番になったら、手牌の牌を1回タップで選択、もう1回タップで切ります。</p>
          <h3>打ち筋サポート</h3>
          <p>
            <b>打つ前のヒント</b>：手牌の上に記号と数字が出ます。<br />◎＝おすすめ ○＝良い △＝まあまあ ×＝シャンテン数が戻る（非推奨）
            <br />
            数字＝その牌を切ったときの<b>有効牌の残り枚数</b>（テンパイなら待ちの残り枚数）。
            <br />
            牌をタップすると「切るとどうなるか」（シャンテン数・受け入れ・待ちと点数・フリテンや役なしの注意）が表示されます。
          </p>
          <p>
            リーチを受けているときは、手牌の下に<b>危険度の色</b>が出ます（スジ・カベの意味は「守り方」タブ）：
            <span className="legend danger-safe">現物</span>
            <span className="legend danger-low">ほぼ安全</span>
            <span className="legend danger-mid">比較的安全</span>
            <span className="legend danger-high">やや危険</span>
            <span className="legend danger-max">危険</span>
          </p>
          <p>
            <b>打った直後の指摘</b>：切った後に「最善／良い／もう一歩／要注意」の評価と理由（受け入れが何枚減ったか、危険牌だったか など）が出ます。
          </p>
          <p>
            <b>↩ 待った</b>：一手戻して別の牌を切り直せます。山の並びは同じなので、「この牌を切っていたらどうなったか」をそのまま試せます。
          </p>
          <p>
            <b>🎯 狙える役</b>：卓の右下の「🎯 狙える役」ボタンで、卓の代わりに<b>いま狙える役の一覧</b>が出ます（手牌とヒントは見えたまま）。
            各役の<b>%</b>は、残りのツモで和了できる見込みの目安です。見えていない牌からランダムにツモる試し打ち（約100回）で見積もり、
            ポン・チー・ロンや、他家の和了で局が終わることも考えています。実際の勝率とは異なります。
            役名をタップすると、役の説明・<b>引くと進む牌</b>・<b>残したい牌／不要な牌</b>・狙い方のコツが出ます。「卓にもどる」で元の表示に戻ります。
          </p>
          <p>局の結果画面では、和了った役をタップすると役の説明が見られます。</p>
        </div>
      ) : null}
      {tab === 'defense' ? (
        <div className="help-body">
          <SafetyGuide />
        </div>
      ) : null}
      {tab === 'yaku' ? (
        <div className="help-body">
          {YAKU_LIST.map((y) => (
            <div key={y.id} className="yaku-card">
              <div className="yaku-card-head">
                <span className="yaku-card-name">{y.name}</span>
                <span className="yaku-card-read">{y.reading}</span>
                <span className="yaku-card-han">{y.yakuman ? '役満' : y.openHan === 0 ? `${y.han}翻（門前のみ）` : y.openHan === y.han ? `${y.han}翻` : `${y.han}翻（鳴くと${y.openHan}翻）`}</span>
              </div>
              <div className="yaku-card-desc">{y.desc}</div>
              {y.example ? <Example s={y.example.replace(/[^0-9mpsz]/g, '')} /> : null}
            </div>
          ))}
        </div>
      ) : null}
      {tab === 'terms' ? (
        <div className="help-body">
          {TERMS.map((t) => (
            <div key={t.term} className="term">
              <div className="term-name">{t.term}</div>
              <div className="term-desc">{t.desc}</div>
            </div>
          ))}
        </div>
      ) : null}
      {tab === 'score' ? (
        <div className="help-body">
          <p>ロン和了の点数の目安です（子 / 親）。ツモの場合は合計がほぼ同じになるように3人で分けて払います。</p>
          <table className="score-ref">
            <thead>
              <tr>
                <th></th>
                <th>子</th>
                <th>親</th>
              </tr>
            </thead>
            <tbody>
              {SCORE_ROWS.map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>符は「20符（副底）＋門前ロン10符＋刻子・待ち方などの符」を10符単位に切り上げたもの。平和ツモは20符、七対子は25符で固定です。</p>
        </div>
      ) : null}
    </div>
  )
}
