// 1問ぶんの出題・解答・解説

import { useMemo, useState } from 'react'
import { TileView } from '../../components/Tile'
import { kindLabel, parseKinds, type Kind } from '../../engine/tiles'
import { playSound } from '../../sound'
import { CATEGORY_BY_ID, PATTERN_BY_ID } from '../../quiz/patterns'
import type { QuestionData, Situation } from '../../quiz/types'
import { GRADE_OK, WIND_JP, arrangeHand, gradeChoice, gradePick, gradeWait, parseTiles, type Grade } from '../../quiz/util'
import {
  DangerExplain,
  DiscardExplain,
  FactsExplain,
  FuritenExplain,
  RemainingExplain,
  SafeExplain,
  ScoreExplain,
  WaitExplain,
} from './Explain'
import { HandRow, TileRow, type HandMark } from './TileRow'

interface Props {
  q: QuestionData
  num: number
  total: number
  last: boolean
  onAnswer: (grade: Grade) => void
  onNext: () => void
  onOpenPattern: (id: string) => void
}

/** 局面の表示（場風・自風・巡目・ドラ表示牌・補足） */
function SituationBar({ sit }: { sit: Situation }) {
  const has = sit.rw !== undefined || sit.sw !== undefined || sit.turn !== undefined || sit.dora || sit.note
  if (!has) return null
  return (
    <div className="q-sit">
      <div className="q-sit-chips">
        {sit.rw !== undefined ? <span className="q-pill">{WIND_JP[sit.rw]}場</span> : null}
        {sit.sw !== undefined ? <span className="q-pill">{WIND_JP[sit.sw]}家{sit.sw === 0 ? '（親）' : ''}</span> : null}
        {sit.turn !== undefined ? <span className="q-pill">{sit.turn}巡目</span> : null}
        {sit.dora ? (
          <span className="q-pill dora">
            ドラ表示牌
            <TileRow tiles={sit.dora} size="xs" />
          </span>
        ) : null}
      </div>
      {sit.note ? <div className="q-sit-note">{sit.note}</div> : null}
    </div>
  )
}

/** 点数の問題では、和了の状況を局面として見せる */
function sitOf(q: QuestionData): Situation {
  if (q.type === 'score') {
    const w = q.win
    const flags = [w.riichi ? 'リーチ' : '', w.tsumo ? 'ツモ' : 'ロン'].filter(Boolean).join('・')
    return { rw: w.rw, sw: w.sw, dora: w.dora, note: flags }
  }
  return q.sit ?? {}
}

export function QuestionView({ q, num, total, last, onAnswer, onNext, onOpenPattern }: Props) {
  const pattern = PATTERN_BY_ID[q.pattern]
  const cat = CATEGORY_BY_ID[pattern.cat]
  const [handSel, setHandSel] = useState<number | null>(null)
  const [waitSel, setWaitSel] = useState<Kind[]>([])
  const [choiceSel, setChoiceSel] = useState<number | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [gaveUp, setGaveUp] = useState(false)
  const done = grade !== null

  const waitOptions = useMemo(() => (q.type === 'wait' ? Array.from(new Set(parseKinds(q.options))).sort((a, b) => a - b) : []), [q])

  const canSubmit =
    q.type === 'discard' || q.type === 'safe' ? handSel !== null : q.type === 'wait' ? waitSel.length > 0 : choiceSel !== null

  const finish = (g: Grade, giveUp = false) => {
    setGrade(g)
    setGaveUp(giveUp)
    playSound(GRADE_OK(g) ? 'correct' : 'wrong')
    onAnswer(g)
  }

  const submit = () => {
    if (!canSubmit) return
    if (q.type === 'discard' || q.type === 'safe') finish(gradePick(q, handSel!))
    else if (q.type === 'wait') finish(gradeWait(q, waitSel))
    else finish(gradeChoice(q, choiceSel!))
  }

  const toggleWait = (k: Kind) => {
    if (done) return
    playSound('select')
    setWaitSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  }

  // 手牌の印（答え合わせのあと）
  const marks: Record<number, HandMark> = {}
  if (done && (q.type === 'discard' || q.type === 'safe')) {
    const hand = arrangeHand(q.hand)
    const ans = new Set(parseKinds(`${q.answers}${q.accept ?? ''}`))
    hand.forEach((t, i) => {
      if (ans.has(t.kind)) marks[i] = 'ans'
    })
    if (handSel !== null && grade === 'ng') marks[handSel] = 'ng'
  }
  const pickKind = handSel !== null && (q.type === 'discard' || q.type === 'safe') ? arrangeHand(q.hand)[handSel].kind : null

  // 答えの文字（結果の表示用）
  let yourAnswer = ''
  let rightAnswer = ''
  if (q.type === 'discard' || q.type === 'safe') {
    yourAnswer = pickKind !== null ? kindLabel(pickKind) : ''
    rightAnswer = parseKinds(q.answers).map(kindLabel).join('・')
  } else if (q.type === 'wait') {
    yourAnswer = waitSel.length ? [...waitSel].sort((a, b) => a - b).map(kindLabel).join('・') : ''
    rightAnswer = parseKinds(q.answers).map(kindLabel).join('・')
  } else {
    yourAnswer = choiceSel !== null ? q.options[choiceSel] : ''
    rightAnswer = q.options[q.answer]
  }

  const showHandBoard = q.type === 'score'
  // 和了した手：和了牌を右端に離して見せる
  const winTiles = useMemo(() => {
    if (q.type !== 'score') return []
    const list = parseTiles(q.win.closed)
    const w = parseTiles(q.win.winTile)[0]
    const i = list.findIndex((t) => t.kind === w.kind && t.red === w.red)
    const j = i >= 0 ? i : list.findIndex((t) => t.kind === w.kind)
    if (j < 0) return list
    const win = list[j]
    const rest = list.filter((_, k) => k !== j).sort((a, b) => a.kind - b.kind || Number(b.red) - Number(a.red))
    return [...rest, win]
  }, [q])

  return (
    <div className="q-wrap">
      <div className="q-tag">
        <span>{cat.icon}</span> {pattern.id}｜{pattern.name}
      </div>
      <SituationBar sit={sitOf(q)} />
      <div className="q-prompt">{q.prompt}</div>

      {q.show?.map((r, i) => (
        <div key={i} className="q-show">
          <div className="q-row-label">{r.label}</div>
          <TileRow tiles={r.tiles} size={parseTiles(r.tiles).length >= 10 ? 'm' : 's'} arrange={r.label.includes('手牌')} />
        </div>
      ))}

      {/* ---- 答える場所 ---- */}
      {q.type === 'safe' ? (
        <div className="q-show">
          <div className="q-row-label">リーチした人の河（左から捨てた順）</div>
          <TileRow tiles={q.river} size="s" />
        </div>
      ) : null}

      {q.type === 'safe' && q.seen ? (
        <div className="q-show">
          <div className="q-row-label">ほかに見えている牌</div>
          <TileRow tiles={q.seen} size="s" />
        </div>
      ) : null}

      {(q.type === 'discard' || q.type === 'wait') && q.melds?.length ? (
        <div className="q-show">
          <div className="q-row-label">副露（鳴いた牌）</div>
          <div className="q-meld-row">
            {q.melds.map((m, i) => (
              <TileRow key={i} tiles={m.k} size="s" />
            ))}
          </div>
        </div>
      ) : null}

      {q.type === 'discard' || q.type === 'safe' ? (
        <div className="q-show">
          <div className="q-row-label">あなたの手牌{done ? '' : '（切る牌をタップ）'}</div>
          <HandRow
            tiles={q.hand}
            selected={handSel}
            onPick={(i) => {
              playSound('select')
              setHandSel(i)
            }}
            marks={marks}
            disabled={done}
            draw={!(q.type === 'discard' && q.melds?.length)}
          />
        </div>
      ) : null}

      {q.type === 'wait' ? (
        <>
          <div className="q-show">
            <div className="q-row-label">あなたの手牌（テンパイ）</div>
            <TileRow tiles={q.hand} size="m" arrange />
          </div>
          <div className="q-show">
            <div className="q-row-label">待ちだと思う牌をすべて選ぶ{done ? '' : '（タップで選択・解除）'}</div>
            <div className="q-opt-tiles">
              {waitOptions.map((k) => {
                const on = waitSel.includes(k)
                const right = parseKinds(q.answers).includes(k)
                return (
                  <button
                    key={k}
                    className={`q-opt-tile ${on ? 'on' : ''} ${done && right ? 'right' : ''} ${done && on && !right ? 'wrong' : ''}`}
                    onClick={() => toggleWait(k)}
                    disabled={done}
                    aria-pressed={on}
                  >
                    <span className="q-t-m">
                      <TileView kind={k} />
                    </span>
                    <small>{on ? '✓' : ' '}</small>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : null}

      {showHandBoard && q.type === 'score' ? (
        <div className="q-show">
          <div className="q-row-label">和了した手（右端が和了牌）</div>
          <div className="q-board">
            {q.win.melds?.length ? (
              <div className="q-meld-row">
                {q.win.melds.map((m, i) => (
                  <TileRow key={i} tiles={m.k} size="s" />
                ))}
              </div>
            ) : null}
            <div className="q-tiles q-t-m q-hand with-draw">
              {winTiles.map((t, i) => (
                <div key={i} className="q-hand-tile">
                  <TileView kind={t.kind} red={t.red} />
                </div>
              ))}
            </div>
            <div className="q-sit-note">和了牌：<b>{parseTiles(q.win.winTile).map((t) => kindLabel(t.kind)).join('')}</b></div>
          </div>
        </div>
      ) : null}

      {q.type === 'choice' || q.type === 'score' ? (
        <div className="q-opts">
          {q.options.map((o, i) => {
            const on = choiceSel === i
            const right = i === q.answer
            return (
              <button
                key={i}
                className={`q-opt ${on ? 'on' : ''} ${done && right ? 'right' : ''} ${done && on && !right ? 'wrong' : ''}`}
                disabled={done}
                onClick={() => {
                  playSound('select')
                  setChoiceSel(i)
                }}
              >
                <b>{String.fromCharCode(65 + i)}</b>
                <span>{o}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {/* ---- ボタン ---- */}
      {!done ? (
        <div className="q-actions">
          <button className="btn btn-main" disabled={!canSubmit} onClick={submit}>
            {q.type === 'discard' || q.type === 'safe' ? 'この牌を切る' : q.type === 'wait' ? 'この待ちで答える' : 'これで答える'}
          </button>
          <button className="link-btn q-giveup" onClick={() => finish('ng', true)}>
            わからない（答えを見る）
          </button>
        </div>
      ) : (
        <>
          <div className={`q-result ${grade}`}>
            <div className="q-result-mark">
              {gaveUp ? '📖 答えを確認しよう' : grade === 'ok' ? '⭕ 正解！' : grade === 'accept' ? '🔶 別解でも正解' : '❌ 残念…'}
            </div>
            <div className="q-result-line">
              {!gaveUp && yourAnswer ? (
                <>
                  あなたの答え：<b>{yourAnswer}</b>
                  <br />
                </>
              ) : null}
              正解：<b>{rightAnswer}</b>
              {q.type === 'discard' || q.type === 'safe' ? (q.accept ? <>（別解：{parseKinds(q.accept).map(kindLabel).join('・')}）</> : null) : null}
            </div>
          </div>

          <div className="q-why">
            <h4>解説</h4>
            <p>{q.why}</p>
            {q.note ? <p className="q-note">💡 {q.note}</p> : null}
          </div>

          {q.type === 'discard' ? <DiscardExplain q={q} pickKind={pickKind} /> : null}
          {q.type === 'safe' ? <SafeExplain q={q} pickKind={pickKind} /> : null}
          {q.type === 'wait' ? <WaitExplain q={q} picked={waitSel} /> : null}
          {q.type === 'score' ? <ScoreExplain q={q} /> : null}
          {q.type === 'choice' ? (
            <>
              <FactsExplain q={q} />
              <RemainingExplain q={q} />
              <FuritenExplain q={q} />
              <DangerExplain q={q} pickIndex={choiceSel} />
            </>
          ) : null}

          <div className="q-memo">
            <div className="q-memo-head">🔑 覚える型</div>
            <div className="q-memo-rule">{q.memo ?? pattern.rule}</div>
            <button className="link-btn" onClick={() => onOpenPattern(pattern.id)}>
              この型の解説を読む ›
            </button>
          </div>

          <div className="q-actions sticky">
            <button className="btn btn-main" onClick={onNext}>
              {last ? '結果を見る' : '次の問題へ'}
              <small>　{num} / {total}</small>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
