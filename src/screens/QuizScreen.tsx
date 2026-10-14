// 定石クイズ100選（対戦とは別の機能）
// 型（パターン）ごとに覚えて、問題を解いて、苦手を復習する。

import { useEffect, useRef, useState } from 'react'
import {
  CATEGORIES,
  CATEGORY_BY_ID,
  PATTERN_BY_ID,
  QUESTIONS,
  QUESTION_BY_ID,
  patternsOfCategory,
  questionsOfCategory,
  questionsOfPattern,
} from '../quiz'
import { isMastered, markOf, recordAnswer, summarize, weakIds, type Mark, type QuizProgress } from '../quiz/progress'
import type { CategoryId, Pattern } from '../quiz/types'
import { GRADE_OK, type Grade } from '../quiz/util'
import { rd, rdTiles } from '../reading'
import { playSound } from '../sound'
import { QuestionView } from './quiz/QuestionView'
import { NamesContext, TileRow } from './quiz/TileRow'

interface Props {
  progress: QuizProgress
  /** 牌の下に読み方を出す（設定の「牌の名前を表示」） */
  showNames: boolean
  onProgress: (updater: (p: QuizProgress) => QuizProgress) => void
  onResetProgress: () => void
  onBack: () => void
}

type View =
  | { name: 'home' }
  | { name: 'category'; cat: CategoryId }
  | { name: 'pattern'; id: string }
  | { name: 'play' }
  | { name: 'result' }

interface Session {
  title: string
  ids: string[]
  idx: number
  /** 答えた結果（ids と同じ順。未回答は null） */
  grades: (Grade | null)[]
}

const ALL_IDS = QUESTIONS.map((q) => q.id)

function shuffle<T>(a: T[]): T[] {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

const MARK_LABEL: Record<Mark, string> = { new: '未回答', ng: '直近は不正解', ok: '直近は正解', mastered: '覚えた' }

/** 問題の状態を並べた小さな点 */
function Dots({ ids, progress }: { ids: string[]; progress: QuizProgress }) {
  return (
    <span className="q-dots">
      {ids.map((id) => {
        const m = markOf(progress, id)
        return <i key={id} className={`q-dot ${m}`} title={MARK_LABEL[m]} />
      })}
    </span>
  )
}

function Bar({ value, total }: { value: number; total: number }) {
  return (
    <div className="q-bar">
      <div className="q-bar-fill" style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
    </div>
  )
}

/** 型の解説（覚える内容） */
function PatternLesson({ p }: { p: Pattern }) {
  return (
    <div className="q-lesson">
      <div className="q-lesson-id">
        {CATEGORY_BY_ID[p.cat].icon} {p.id}
      </div>
      <h3>{rd(p.name)}</h3>
      <div className="q-rule">🔑 {rd(p.rule)}</div>
      <p>{rd(p.detail)}</p>
      {p.samples?.map((s, i) => (
        <div key={i} className="q-sample">
          {s.tiles ? <TileRow tiles={s.tiles} size="s" /> : null}
          <div className="q-sample-note">{rd(s.note)}</div>
        </div>
      ))}
    </div>
  )
}

export function QuizScreen({ progress, showNames, onProgress, onResetProgress, onBack }: Props) {
  const [stack, setStack] = useState<View[]>([{ name: 'home' }])
  const [session, setSession] = useState<Session | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const view = stack[stack.length - 1]

  // 画面を切り替えたら、先頭にもどす
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [stack.length, session?.idx, view.name])

  const push = (v: View) => setStack((s) => [...s, v])
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const replace = (v: View) => setStack((s) => [...s.slice(0, -1), v])
  const back = () => {
    if (stack.length <= 1) onBack()
    else pop()
  }

  const start = (title: string, ids: string[], idx = 0) => {
    if (ids.length === 0) return
    playSound('shuffle')
    setSession({ title, ids, idx, grades: ids.map(() => null) })
    push({ name: 'play' })
  }

  const sum = summarize(progress, ALL_IDS)
  const weak = weakIds(progress, ALL_IDS)

  // ------------------------------------------------------------------ ホーム
  const home = () => {
    const first = ALL_IDS.findIndex((id) => !progress.q[id])
    const startIdx = first >= 0 ? first : 0
    const accuracy = sum.attempts ? Math.round((sum.correct / sum.attempts) * 100) : 0
    const randomTen = () => {
      // まだ覚えていない問題を優先して、10問
      const pool = shuffle(ALL_IDS.filter((id) => !isMastered(progress.q[id])))
      const rest = shuffle(ALL_IDS.filter((id) => isMastered(progress.q[id])))
      return [...pool, ...rest].slice(0, 10)
    }
    return (
      <>
        <div className="q-hero">
          <div className="q-hero-title">定石クイズ 100選</div>
          <div className="q-hero-sub">型（パターン）で覚えて、実戦で使える力に。答えと数字は、麻雀エンジンが計算しています。</div>
          <div className="q-hero-stats">
            <div>
              <b>{sum.mastered}</b>
              <span>/ {sum.total} 覚えた</span>
            </div>
            <div>
              <b>{sum.answered}</b>
              <span>回答した問題</span>
            </div>
            <div>
              <b>{sum.attempts ? `${accuracy}%` : '-'}</b>
              <span>正解率</span>
            </div>
          </div>
          <Bar value={sum.mastered} total={sum.total} />
          <div className="q-hero-hint">同じ問題に2回続けて正解すると「覚えた」になります。</div>
        </div>

        <div className="q-menu">
          <button className="btn btn-main big" onClick={() => start('全100問', ALL_IDS, startIdx)}>
            ▶ {first >= 0 && sum.answered > 0 ? `続きから（Q${startIdx + 1}〜）` : '最初から順番に'}
          </button>
          <div className="q-menu-row">
            <button className="btn btn-sub" onClick={() => start('ランダム10問', randomTen())}>
              🎲 ランダム10問
            </button>
            <button className="btn btn-sub" disabled={weak.length === 0} onClick={() => start('苦手の復習', shuffle(weak))}>
              🔁 苦手を復習
              {weak.length ? <small>{weak.length}問</small> : null}
            </button>
          </div>
        </div>

        <h3 className="q-h">分野から選ぶ（型ごとに覚える）</h3>
        {CATEGORIES.map((c) => {
          const ids = questionsOfCategory(c.id).map((q) => q.id)
          const s = summarize(progress, ids)
          return (
            <button key={c.id} className="q-cat" onClick={() => push({ name: 'category', cat: c.id })}>
              <div className="q-cat-icon">{c.icon}</div>
              <div className="q-cat-body">
                <div className="q-cat-name">{c.name}</div>
                <div className="q-cat-blurb">{rd(c.blurb)}</div>
                <div className="q-cat-prog">
                  <Bar value={s.mastered} total={s.total} />
                  <span>
                    覚えた {s.mastered} / {s.total}問
                  </span>
                </div>
              </div>
              <div className="q-cat-go">›</div>
            </button>
          )
        })}

        {sum.answered > 0 ? (
          <div className="q-reset">
            {confirmReset ? (
              <>
                進み具合を消しますか？
                <button
                  className="link-btn"
                  onClick={() => {
                    onResetProgress()
                    setConfirmReset(false)
                  }}
                >
                  消す
                </button>
                <button className="link-btn" onClick={() => setConfirmReset(false)}>
                  やめる
                </button>
              </>
            ) : (
              <button className="link-btn" onClick={() => setConfirmReset(true)}>
                クイズの進み具合をリセット
              </button>
            )}
          </div>
        ) : null}
      </>
    )
  }

  // ------------------------------------------------------------------ 分野
  const category = (cat: CategoryId) => {
    const c = CATEGORIES.find((x) => x.id === cat)!
    const ids = questionsOfCategory(cat).map((q) => q.id)
    return (
      <>
        <div className="q-hero small">
          <div className="q-hero-title">
            {c.icon} {c.name}
          </div>
          <div className="q-hero-sub">{rd(c.blurb)}</div>
        </div>
        <button className="btn btn-main" onClick={() => start(c.name, ids)}>
          ▶ この分野を順番に解く（{ids.length}問）
        </button>
        <h3 className="q-h">型（覚えるパターン）</h3>
        {patternsOfCategory(cat).map((p) => {
          const pids = questionsOfPattern(p.id).map((q) => q.id)
          const s = summarize(progress, pids)
          return (
            <button key={p.id} className="q-pat" onClick={() => push({ name: 'pattern', id: p.id })}>
              <div className="q-pat-head">
                <span className="q-pat-id">{p.id}</span>
                <span className="q-pat-name">{rdTiles(p.name)}</span>
              </div>
              <div className="q-pat-rule">{rd(p.rule)}</div>
              <div className="q-pat-foot">
                <Dots ids={pids} progress={progress} />
                <span>
                  {s.mastered === s.total ? '✔ 覚えた' : `覚えた ${s.mastered} / ${s.total}`}
                </span>
              </div>
            </button>
          )
        })}
      </>
    )
  }

  // ------------------------------------------------------------------ 型
  const pattern = (id: string) => {
    const p = PATTERN_BY_ID[id]
    const qs = questionsOfPattern(id)
    const ids = qs.map((q) => q.id)
    const list = patternsOfCategory(p.cat)
    const i = list.findIndex((x) => x.id === id)
    return (
      <>
        <PatternLesson p={p} />
        <div className="q-pat-qs">
          <div className="q-h">この型の問題（{ids.length}問）</div>
          <Dots ids={ids} progress={progress} />
          <div className="q-legend">
            <i className="q-dot mastered" />覚えた <i className="q-dot ok" />正解 <i className="q-dot ng" />不正解 <i className="q-dot new" />未回答
          </div>
        </div>
        <button className="btn btn-main" onClick={() => start(`${p.id} ${p.name}`, ids)}>
          ▶ この型の問題を解く
        </button>
        <div className="q-prevnext">
          <button className="btn btn-sub" disabled={i <= 0} onClick={() => replace({ name: 'pattern', id: list[i - 1].id })}>
            ‹ 前の型
          </button>
          <button className="btn btn-sub" disabled={i >= list.length - 1} onClick={() => replace({ name: 'pattern', id: list[i + 1].id })}>
            次の型 ›
          </button>
        </div>
      </>
    )
  }

  // ------------------------------------------------------------------ 出題
  const play = () => {
    if (!session) return null
    const id = session.ids[session.idx]
    const q = QUESTION_BY_ID[id]
    const last = session.idx >= session.ids.length - 1
    return (
      <>
        <div className="q-progress">
          <div className="q-progress-title">{session.title}</div>
          <div className="q-progress-num">
            {session.idx + 1} / {session.ids.length}
          </div>
        </div>
        <Bar value={session.idx} total={session.ids.length} />
        <QuestionView
          key={`${id}-${session.idx}`}
          q={q}
          num={session.idx + 1}
          total={session.ids.length}
          last={last}
          onAnswer={(g) => {
            onProgress((p) => recordAnswer(p, id, GRADE_OK(g)))
            setSession((s) => (s ? { ...s, grades: s.grades.map((x, i) => (i === s.idx ? g : x)) } : s))
          }}
          onNext={() => {
            if (last) {
              replace({ name: 'result' })
            } else {
              setSession((s) => (s ? { ...s, idx: s.idx + 1 } : s))
            }
          }}
          onOpenPattern={(pid) => setSheet(pid)}
        />
      </>
    )
  }

  // ------------------------------------------------------------------ 結果
  const result = () => {
    if (!session) return null
    const answered = session.grades.filter((g): g is Grade => g !== null)
    const ok = answered.filter(GRADE_OK).length
    const pct = answered.length ? Math.round((ok / answered.length) * 100) : 0
    const missed = session.ids.filter((_, i) => session.grades[i] === 'ng')
    // 間違えた型を、間違えた数の多い順に（読み直す型）
    const missCount: Record<string, number> = {}
    for (const id of missed) missCount[QUESTION_BY_ID[id].pattern] = (missCount[QUESTION_BY_ID[id].pattern] ?? 0) + 1
    const missedPatterns = Object.keys(missCount).sort((a, b) => missCount[b] - missCount[a])
    const SHOW_MISSED = 8
    const SHOW_PATTERNS = 5
    return (
      <>
        <ResultSound pct={pct} />
        <div className="q-hero">
          <div className="q-hero-title">結果</div>
          <div className="q-result-big">
            <b>{ok}</b> / {answered.length} 問 正解（{pct}%）
          </div>
          <div className="q-hero-sub">
            {pct === 100
              ? '全問正解！ すばらしい！ 次は別の分野にも挑戦してみよう。'
              : pct >= 70
                ? 'よくできました。間違えた問題は、型の解説を読み直すと定着します。'
                : '間違えた問題は「覚える型」を読んでから、もう一度チャレンジしよう。'}
          </div>
        </div>
        {missed.length > 0 ? (
          <>
            <h3 className="q-h">間違えた問題（{missed.length}問）</h3>
            <div className="q-res-list">
              {missed.slice(0, SHOW_MISSED).map((id) => {
                const q = QUESTION_BY_ID[id]
                return (
                  <div key={id} className="q-res-row ng">
                    <span className="q-res-mark">❌</span>
                    <span className="q-res-name">
                      {q.pattern}｜{rdTiles(PATTERN_BY_ID[q.pattern].name)}
                    </span>
                  </div>
                )
              })}
              {missed.length > SHOW_MISSED ? <div className="q-res-row more">ほか {missed.length - SHOW_MISSED} 問</div> : null}
            </div>
            <h3 className="q-h">読み直す型{missedPatterns.length > SHOW_PATTERNS ? '（間違いの多い順）' : ''}</h3>
            {missedPatterns.slice(0, SHOW_PATTERNS).map((pid) => (
              <button key={pid} className="q-pat" onClick={() => push({ name: 'pattern', id: pid })}>
                <div className="q-pat-head">
                  <span className="q-pat-id">{pid}</span>
                  <span className="q-pat-name">{rdTiles(PATTERN_BY_ID[pid].name)}</span>
                  <span className="q-pat-miss">{missCount[pid]}問ミス</span>
                </div>
                <div className="q-pat-rule">{rd(PATTERN_BY_ID[pid].rule)}</div>
              </button>
            ))}
          </>
        ) : null}
        <div className="q-menu">
          {missed.length > 0 ? (
            <button className="btn btn-main" onClick={() => { setStack([{ name: 'home' }]); start('間違えた問題', missed) }}>
              🔁 間違えた問題をもう一度（{missed.length}問）
            </button>
          ) : null}
          <button className="btn btn-sub" onClick={() => { setStack([{ name: 'home' }]); start(session.title, session.ids) }}>
            もう一度、最初から
          </button>
          <button className="btn btn-sub" onClick={() => setStack([{ name: 'home' }])}>
            ホームへもどる
          </button>
        </div>
      </>
    )
  }

  const title =
    view.name === 'home'
      ? '定石クイズ'
      : view.name === 'category'
        ? CATEGORIES.find((c) => c.id === view.cat)!.name
        : view.name === 'pattern'
          ? '覚える型'
          : view.name === 'play'
            ? '出題'
            : '結果'

  return (
    <NamesContext.Provider value={showNames}>
    <div className="page quiz" ref={topRef}>
      <div className="page-head">
        <button className="icon-btn" onClick={back} aria-label="もどる">
          ←
        </button>
        <h2>{title}</h2>
      </div>
      {view.name === 'home' ? home() : null}
      {view.name === 'category' ? category(view.cat) : null}
      {view.name === 'pattern' ? pattern(view.id) : null}
      {view.name === 'play' ? play() : null}
      {view.name === 'result' ? result() : null}

      {sheet ? (
        <div className="q-sheet" onClick={() => setSheet(null)}>
          <div className="q-sheet-card" onClick={(e) => e.stopPropagation()}>
            <PatternLesson p={PATTERN_BY_ID[sheet]} />
            <button className="btn btn-main" onClick={() => setSheet(null)}>
              閉じる
            </button>
          </div>
        </div>
      ) : null}
    </div>
    </NamesContext.Provider>
  )
}

/** 結果画面に入ったときに、成績に合った音を1回鳴らす */
function ResultSound({ pct }: { pct: number }) {
  useEffect(() => {
    playSound(pct >= 80 ? 'win' : pct >= 50 ? 'resultOther' : 'drawGame')
  }, [pct])
  return null
}

// 画面の部品を、テストなどから使えるようにする
export { PatternLesson }
