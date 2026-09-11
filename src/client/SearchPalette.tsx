/**
 * The search palette: a centered input over a result list, omnisearch-style
 * (query at the top, excerpts with highlighted terms, session title + role +
 * time per row, arrow/Enter/Escape keyboard model). Pure React on the
 * --dsw-* tokens; no dependencies beyond React so the boot bundle stays
 * small (the index and ranking live host-side).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SearchHit, SearchState } from './types.js'

const CSS = `
.ks-scrim { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh; background: var(--dsw-alias-bg-mask-2, rgba(0,0,0,.45)); }
.ks-card { width: min(720px, 92vw); max-height: 72vh; display: flex; flex-direction: column; overflow: hidden;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; box-shadow: var(--dsw-shadow-lv3); font: var(--dsw-font-s-14); }
.ks-inputRow { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ks-inputRow svg { flex: none; color: var(--dsw-alias-label-tertiary); }
.ks-input { flex: 1; min-width: 0; appearance: none; border: 0; outline: 0; background: transparent; color: inherit;
  font: var(--dsw-font-base-16, 16px/1.4 inherit); }
.ks-input::placeholder { color: var(--dsw-alias-label-tertiary); }
.ks-kbd { flex: none; font: var(--dsw-font-xs-13); font-family: var(--ds-font-family-code, var(--dsw-font-family)); color: var(--dsw-alias-label-tertiary);
  padding: 1px 6px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 5px; background: var(--dsw-alias-bg-layer-2); }
.ks-list { flex: 1; min-height: 0; overflow-y: auto; padding: 6px; }
.ks-group { padding: 8px 8px 2px; font: var(--dsw-font-xs-strong-13); color: var(--dsw-alias-label-secondary); text-transform: uppercase; letter-spacing: .04em;
  display: flex; align-items: baseline; gap: 8px; }
.ks-group small { text-transform: none; letter-spacing: 0; font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); }
.ks-group .ks-tomb { margin-left: auto; text-transform: none; letter-spacing: 0; font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); }
.ks-group .ks-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xs-13); padding: 1px 8px; border-radius: 5px; cursor: pointer; text-transform: none; letter-spacing: 0; }
.ks-group .ks-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ks-row[data-archived="true"] { cursor: default; opacity: .6; }
.ks-row { display: block; width: 100%; appearance: none; border: 0; background: none; text-align: left; cursor: pointer;
  padding: 7px 10px; border-radius: 8px; color: inherit; }
.ks-row[aria-selected="true"] { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.ks-meta { display: flex; gap: 8px; align-items: baseline; margin-bottom: 2px; font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); }
.ks-role { font: var(--dsw-font-xs-strong-13); color: var(--dsw-alias-label-secondary); }
.ks-role[data-role="user"] { color: var(--dsw-alias-brand-text, var(--dsw-alias-brand-primary)); }
.ks-snip { font: var(--dsw-font-s-14); line-height: 1.4; color: var(--dsw-alias-label-primary); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ks-snip mark { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
.ks-empty { padding: 28px 14px; text-align: center; color: var(--dsw-alias-label-tertiary); }
.ks-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 7px 14px; border-top: 1px solid var(--dsw-alias-border-l1);
  font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); }
.ks-foot span { display: inline-flex; gap: 6px; align-items: center; }
`
let cssInjected = false
function ensureCss(): void {
  if (cssInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.setAttribute('data-plugin', 'dsh-plugin-omnisearch')
  style.textContent = CSS
  document.head.appendChild(style)
  cssInjected = true
}

const when = (ms: number): string => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Wrap every matched term occurrence in <mark>. */
function highlight(text: string, terms: readonly string[]): ReactNode {
  const clean = terms.map(t => t.trim()).filter(t => t.length > 1)
  if (clean.length === 0) return text
  const re = new RegExp(`(${clean.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu')
  const parts = text.split(re)
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))
}

interface Group { sessionId: string; title: string; hits: SearchHit[] }

/** Group consecutive-by-session while keeping best-first order of first appearance. */
function groupHits(hits: readonly SearchHit[]): Group[] {
  const order: Group[] = []
  const byId = new Map<string, Group>()
  for (const hit of hits) {
    let g = byId.get(hit.sessionId)
    if (g === undefined) {
      g = { sessionId: hit.sessionId, title: hit.title, hits: [] }
      byId.set(hit.sessionId, g)
      order.push(g)
    }
    g.hits.push(hit)
  }
  for (const g of order) g.hits.sort((a, b) => a.seq - b.seq)
  return order
}

export interface SearchPaletteProps {
  useSearch: <S>(select: (s: SearchState) => S) => S
  setQuery: (q: string) => void
  close: () => void
  pick: (hit: SearchHit) => void
  resurrect: (sessionId: string) => Promise<void>
}

export function SearchPalette({ useSearch, setQuery, close, pick, resurrect }: SearchPaletteProps) {
  ensureCss()
  const query = useSearch(s => s.query)
  const hits = useSearch(s => s.hits)
  const status = useSearch(s => s.status)
  const error = useSearch(s => s.error)
  const documents = useSearch(s => s.documents)
  const sessionsIndexed = useSearch(s => s.sessionsIndexed)
  const archived = useSearch(s => s.archived)
  const resurrecting = useSearch(s => s.resurrecting)
  const canResurrect = useSearch(s => s.canResurrect)
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement | null>(null)
  const list = useRef<HTMLDivElement | null>(null)

  const groups = useMemo(() => groupHits(hits), [hits])
  const flat = useMemo(() => groups.flatMap(g => g.hits), [groups])

  useEffect(() => { input.current?.focus(); input.current?.select() }, [])
  useEffect(() => { setCursor(0) }, [hits])
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-index="${String(cursor)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setCursor(c => Math.min(flat.length - 1, c + 1)); return }
    if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const hit = flat[cursor]
      if (hit !== undefined) pick(hit)
    }
  }

  let index = -1
  return (
    <div className="ks-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="ks-card" role="dialog" aria-modal="true" aria-label="Search messages" onKeyDown={onKeyDown}>
        <div className="ks-inputRow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            className="ks-input"
            type="text"
            value={query}
            placeholder="Search every conversation…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Search query"
            aria-controls="dsh-omnisearch-results"
            onChange={(e) => { setQuery(e.currentTarget.value) }}
          />
          <span className="ks-kbd">esc</span>
        </div>
        <div className="ks-list" id="dsh-omnisearch-results" role="listbox" ref={list}>
          {query.trim().length === 0 && <div className="ks-empty">Type to search across {sessionsIndexed} sessions · {documents} messages</div>}
          {query.trim().length > 0 && status === 'ready' && flat.length === 0 && <div className="ks-empty">No matches for “{query}”</div>}
          {status === 'error' && <div className="ks-empty" role="alert">{error}</div>}
          {resurrecting !== null && <div className="ks-empty" role="status">Resurrecting — the server restarts (~15 s); the session returns to your sidebar when the GUI is back.</div>}
          {groups.map(group => {
            const tomb = archived.includes(group.sessionId)
            return (
            <div key={group.sessionId}>
              <div className="ks-group">
                {tomb && <span aria-hidden="true">🪦</span>} {group.title} <small>{group.hits.length} hit{group.hits.length === 1 ? '' : 's'}</small>
                {tomb && <span className="ks-tomb">archived</span>}
                {tomb && canResurrect && <button type="button" className="ks-btn" disabled={resurrecting !== null} onClick={() => { void resurrect(group.sessionId) }}>
                  {resurrecting === group.sessionId ? 'Rising…' : 'Resurrect'}
                </button>}
              </div>
              {group.hits.map((hit) => {
                index += 1
                const i = index
                return (
                  <button
                    key={`${hit.sessionId}#${String(hit.seq)}`}
                    type="button"
                    role="option"
                    className="ks-row"
                    data-index={i}
                    data-archived={tomb}
                    aria-selected={i === cursor}
                    aria-disabled={tomb}
                    title={tomb ? 'Archived — resurrect the session to open it' : undefined}
                    onMouseEnter={() => { setCursor(i) }}
                    onClick={() => { pick(hit) }}
                  >
                    <div className="ks-meta">
                      <span className="ks-role" data-role={hit.role}>{hit.role === 'user' ? 'You' : 'Assistant'}</span>
                      <span>{when(hit.time)}</span>
                    </div>
                    <div className="ks-snip">{highlight(hit.snippet, hit.terms)}</div>
                  </button>
                )
              })}
            </div>
            )
          })}
        </div>
        <div className="ks-foot">
          <span><kbd className="ks-kbd">↑↓</kbd> navigate <kbd className="ks-kbd">↵</kbd> open</span>
          <span>{status === 'searching' ? 'searching…' : `${flat.length} result${flat.length === 1 ? '' : 's'}`}</span>
        </div>
      </div>
    </div>
  )
}
