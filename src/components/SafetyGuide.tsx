// 守りの解説：現物・スジ・カベ（初心者向け）
// ヘルプ画面と、対局中の「スジ・カベとは？」ボタンの両方で使う。

import { useEffect, useRef } from 'react'
import { parseKinds } from '../engine/tiles'
import { TileView } from './Tile'

export type GuideTerm = '現物' | 'スジ' | 'カベ'

type Mark = 'safe' | 'danger' | 'wait' | 'none'

/** 牌の並び（例: '23m'）に、見出しと印をつけて表示する */
function Group({ tiles, caption, mark = 'none', dim }: { tiles: string; caption?: string; mark?: Mark; dim?: boolean }) {
  return (
    <div className={`g-group g-${mark}`}>
      <div className="g-tiles">
        {parseKinds(tiles).map((k, i) => (
          <TileView key={i} kind={k} dim={dim} className="tile-xs" />
        ))}
      </div>
      {caption ? <div className="g-cap">{caption}</div> : null}
    </div>
  )
}

function Example({ children }: { children: React.ReactNode }) {
  return <div className="g-example">{children}</div>
}

function Point({ children }: { children: React.ReactNode }) {
  return <div className="g-point">{children}</div>
}

export function SafetyGuide({ focus }: { focus?: GuideTerm | null }) {
  const refs = useRef<Record<string, HTMLElement | null>>({})
  useEffect(() => {
    if (!focus) return
    const el = refs.current[focus]
    if (el) el.scrollIntoView({ block: 'start' })
  }, [focus])
  const reg = (key: string) => (el: HTMLElement | null) => {
    refs.current[key] = el
  }

  return (
    <div className="guide">
      <p className="g-lead">
        相手が<b>リーチ</b>したら、「その人が待っていない牌」を切ればロンされません。待ちを絞り込む手がかりが、
        <b>現物・スジ・カベ</b>の3つです。安全な順に、<b>現物 → スジ・カベ → それ以外</b>と探します。
      </p>

      <section ref={reg('現物')} className="g-sec">
        <h3>① 現物（げんぶつ）＝いちばん安全</h3>
        <p>
          そのリーチした人が<b>すでに河に捨てている牌</b>のことです。人は自分が捨てた牌では和了れない（フリテン）ので、
          <b>100%ロンされません</b>。リーチのあとに、他の人が捨てて<b>通った牌</b>も、その人にとっては現物と同じです。
        </p>
        <Example>
          <Group tiles="5p" caption="相手の河に5筒がある" mark="safe" />
          <span className="g-arrow">→</span>
          <Group tiles="5p" caption="5筒は絶対に安全" mark="safe" />
        </Example>
        <Point>手牌の下の色バーが<span className="g-chip g-c-safe">緑</span>なら現物です。</Point>
      </section>

      <section ref={reg('スジ')} className="g-sec">
        <h3>② スジ＝比較的安全（両面待ちには当たらない）</h3>
        <p>
          数字には、3つおきの仲間があります。<b>1-4-7 ／ 2-5-8 ／ 3-6-9</b>。この並びを「スジ」と呼びます。
          相手が<b>4を捨てている</b>と、<b>1と7</b>が安全寄りになります。
        </p>
        <Example>
          <Group tiles="147m" caption="1・4・7のスジ" />
          <span className="g-arrow">／</span>
          <Group tiles="258p" caption="2・5・8のスジ" />
          <span className="g-arrow">／</span>
          <Group tiles="369s" caption="3・6・9のスジ" />
        </Example>
        <h4>なぜ安全なの？</h4>
        <p>
          両面待ちで<b>1萬</b>を待つ形は「2-3萬」だけで、そのとき当たり牌は<b>1萬と4萬</b>です。
          相手は4萬を捨てているので、4萬が当たり牌の形では<b>フリテンでロンできません</b>。だから、1萬を待つ両面は成立しないのです。
        </p>
        <Example>
          <Group tiles="23m" caption="持っている形" />
          <span className="g-arrow">→</span>
          <Group tiles="1m" caption="待ち" mark="wait" />
          <Group tiles="4m" caption="待ち（捨て済み）" mark="wait" />
          <span className="g-arrow">→</span>
          <span className="g-note">4萬を捨てているのでロンできない。1萬は両面待ちでは安全</span>
        </Example>
        <h4>「片スジ」と「両スジ」</h4>
        <p>
          4・5・6は、スジが<b>両側</b>にあります（4なら1と7）。<b>片方だけ</b>通っているのは「片スジ」で、まだ反対側の両面待ちが残るので危険です。
          <b>両方</b>通っていれば、かなり安全です。1・2・3・7・8・9は、スジが1つなので、それが通っていれば両面待ちには当たりません。
        </p>
        <Example>
          <Group tiles="5p" caption="5筒を切りたい…" />
          <span className="g-arrow">→</span>
          <Group tiles="2p" caption="2筒が通っている" mark="safe" />
          <Group tiles="8p" caption="8筒は通っていない" mark="danger" />
          <span className="g-arrow">→</span>
          <span className="g-note">5筒は片スジ。まだ当たる可能性あり</span>
        </Example>
        <Point>
          スジは「両面待ち」にしか効きません。<b>辺張（1-2で3待ち、8-9で7待ち）・嵌張（4-6で5待ち）・シャンポン・単騎</b>
          には当たることがあります。「絶対」ではなく「当たりにくい」と覚えてください。
        </Point>
      </section>

      <section ref={reg('カベ')} className="g-sec">
        <h3>③ カベ＝4枚そろって見えている牌（その牌を使う待ちが消える）</h3>
        <p>
          同じ牌は4枚しかありません。ある牌が<b>4枚とも見えている</b>（自分の手牌・みんなの河・副露・ドラ表示牌）と、
          もう誰もその牌を持てません。するとその牌を使った形（順子の両面待ち）が作れなくなります。これが「カベ」です。
        </p>
        <Example>
          <Group tiles="3m3m3m3m" caption="3萬が4枚とも見えている" mark="safe" />
        </Example>
        <p>誰も3萬を持てないので、3萬を使う待ちが消えます。</p>
        <Example>
          <Group tiles="23m" caption="2-3の形" dim />
          <span className="g-arrow">→</span>
          <Group tiles="1m4m" caption="1・4萬待ちが消える" mark="safe" />
        </Example>
        <Example>
          <Group tiles="34m" caption="3-4の形" dim />
          <span className="g-arrow">→</span>
          <Group tiles="2m5m" caption="2・5萬待ちが消える" mark="safe" />
        </Example>
        <p>
          その結果、<b>1萬と2萬</b>は両面待ちでは当たらなくなり、<b>4萬と5萬</b>も片側の両面待ちが消えて安全寄りになります。
        </p>
        <Point>
          あと<b>1枚だけ見えていない</b>（3枚見え）ときは「ワンチャンス」と言い、やや安全です。このアプリの危険度では、
          <b>4枚見えているカベ</b>だけを数えています。
        </Point>
      </section>

      <section ref={reg('字牌')} className="g-sec">
        <h3>④ 字牌</h3>
        <p>
          字牌には順子（連続した数）がないので、スジもカベもありません。当たるのは<b>シャンポン待ち</b>や<b>単騎待ち</b>だけです。
          すでに<b>2〜3枚見えている字牌</b>は、残りが少なく、当たりにくくなります。まだ1枚も見えていない字牌（特に役牌）は意外と危険です。
        </p>
        <Example>
          <Group tiles="東東東" caption="3枚見えている東" mark="safe" />
          <span className="g-arrow">→</span>
          <span className="g-note">残り1枚。当たるのは単騎待ちくらい</span>
        </Example>
      </section>

      <section className="g-sec">
        <h3>危険度の色の見方（リーチを受けたとき）</h3>
        <div className="g-legend">
          <div>
            <span className="legend danger-safe">現物</span>
            100%安全。
          </div>
          <div>
            <span className="legend danger-low">ほぼ安全</span>
            1・2・8・9で両面待ちが消えている牌（スジ・カベ）、2〜3枚見えている字牌。
          </div>
          <div>
            <span className="legend danger-mid">比較的安全</span>
            3〜7で両面待ちが消えている牌（両スジなど）、まだ見えていない字牌。
          </div>
          <div>
            <span className="legend danger-high">やや危険</span>
            片スジの牌、スジのない端寄りの牌、役牌。
          </div>
          <div>
            <span className="legend danger-max">危険</span>
            スジもカベもない真ん中の牌（3〜7あたり）。ドラは少し危険寄りに見積もります。
          </div>
        </div>
        <Point>
          牌をタップすると、その牌が安全（または危険）な理由が、具体的な牌の名前つきで表示されます。
          どちらを切るか迷ったら、まず「緑（現物）」を探しましょう。
        </Point>
      </section>
    </div>
  )
}
