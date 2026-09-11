/**
 * The session message index: MiniSearch over one document per human or
 * assistant message. Modelled on obsidian-omnisearch's engine setup
 * (prefix + fuzzy matching, field boosts, BM25 combineWith AND falling back
 * to OR) but with the harness's session log as the corpus instead of vault
 * notes.
 *
 * Document identity is `${sessionId}#${seq}`; the id is stable across
 * restarts because it is the durable log position. Session titles are folded
 * from `session/title` events and stored on every document of that session
 * so title matches rank above body matches and the palette can group rows
 * by session without a second RPC.
 */
import MiniSearch from 'minisearch'
import type { SearchOptions } from 'minisearch'
import type { Session, SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'

/** One indexed message. */
interface Doc {
  id: string
  sessionId: string
  seq: number
  role: 'user' | 'assistant'
  time: number
  title: string
  text: string
}

/** One result row shipped to the browser (owned JSON, no live references). */
export interface SearchHit {
  sessionId: string
  seq: number
  role: 'user' | 'assistant'
  time: number
  title: string
  /** Query-neighbourhood excerpt with the matched terms kept verbatim. */
  snippet: string
  /** Matched query terms (for client-side highlighting). */
  terms: string[]
  score: number
}

/** Index health for the palette footer. */
export interface IndexStatus {
  documents: number
  sessions: number
  ready: boolean
  /** Non-fatal boot-scan problems (unreadable logs), newest scan only. */
  diagnostics: string[]
}

/** Search text of one event, or undefined when the event is not a message. */
function messageText(event: SessionEvent): { role: 'user' | 'assistant'; text: string } | undefined {
  if (event.type === 'user/message') {
    // Only human-typed prompts: plugin snapshots (system prompt sections,
    // steering, runtime context) are noise for a "what did we talk about"
    // search — the same rule obsidian-omnisearch applies to front-matter.
    const source = (event.data as { source?: { kind?: string } }).source
    if (source?.kind !== 'user') return undefined
    return { role: 'user', text: blocksText(event.data.content) }
  }
  if (event.type === 'assistant/message') {
    return { role: 'assistant', text: blocksText(event.data.message.content) }
  }
  return undefined
}

function blocksText(blocks: readonly unknown[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    const b = block as { type?: string; text?: string }
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
  }
  return parts.join('\n').trim()
}

const TITLE_FALLBACK = (header: SessionHeader): string => {
  const cwd = header.cwd
  if (cwd === undefined) return '(untitled)'
  const base = cwd.split('/').filter(Boolean).at(-1)
  return base === undefined ? '(untitled)' : base
}

/** MiniSearch options mirroring obsidian-omnisearch: prefix, fuzzy 0.2, title boost. */
const SEARCH_OPTIONS: SearchOptions = {
  prefix: true,
  fuzzy: 0.2,
  boost: { title: 3 },
  combineWith: 'AND',
}

export class SessionIndex {
  private readonly engine = new MiniSearch<Doc>({
    fields: ['title', 'text'],
    storeFields: ['sessionId', 'seq', 'role', 'time', 'title', 'text'],
    idField: 'id',
    // Omnisearch's tokenizer: split on anything that is not a letter, digit,
    // or an apostrophe/underscore/hyphen inside a word, keeping CJK runs.
    tokenize: (text) => text.toLowerCase().split(/[^\p{L}\p{N}_'-]+/u).filter(t => t.length > 0),
    processTerm: (term) => (term.length > 1 ? term : null),
  })

  /** Every session id this index has seen, for fork-parent presence checks. */
  private readonly knownSessions = new Set<string>()
  private readonly titles = new Map<string, string>()
  private readonly docsBySession = new Map<string, Set<string>>()
  /** Highest seq observed per session — the firehose can replay a resumed session's constructor seed. */
  private readonly highSeq = new Map<string, number>()
  /** Content fingerprints already indexed (role + text) — forks replay their parent's log verbatim. */
  private readonly seen = new Set<string>()
  private ready = false
  /** Boot-scan diagnostics surfaced through `status` (empty on a clean build). */
  private diagnostics: string[] = []

  status(): IndexStatus {
    return {
      documents: this.engine.documentCount,
      sessions: this.docsBySession.size,
      ready: this.ready,
      diagnostics: [...this.diagnostics],
    }
  }

  /** Cold build: every persisted log, skipping ids that are live (seedLive covers those). */
  async buildFromPersistence(persistence: SessionPersistence, live: readonly Session[]): Promise<{ documents: number; sessions: number; ms: number; skipped: string[] }> {
    const started = Date.now()
    const liveIds = new Set(live.map(s => s.id as string))
    // Oldest first so a parent claims shared history before its forks.
    const headers = [...await persistence.list()].sort((a, b) => a.createdAt - b.createdAt)
    // Register every id up front so a fork can tell whether its parent is in
    // this corpus regardless of scan order.
    for (const header of headers) this.knownSessions.add(header.id as string)
    for (const session of live) this.knownSessions.add(session.id as string)
    let sessions = 0
    const skipped: string[] = []
    for (const header of headers) {
      if (liveIds.has(header.id as string)) continue
      // Subagent children are indexed too (their transcripts are real work),
      // but the palette groups them under their own title.
      try {
        const inspection = await persistence.inspect(header.id)
        this.indexEvents(header, inspection.events)
        sessions++
      } catch (error) {
        // A torn or foreign-version log is skipped; the rest still index.
        // Reported (not swallowed) so an install-wide read failure is visible
        // rather than presenting as a silently empty index.
        skipped.push(`${String(header.id)}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    this.ready = true
    this.diagnostics = [`scan: ${String(headers.length)} persisted header(s), ${String(sessions)} indexed`, ...skipped]
    return { documents: this.engine.documentCount, sessions, ms: Date.now() - started, skipped }
  }

  /** Index what a live session already holds in memory (boot + `session/created`). */
  seedLive(session: Session): void {
    this.indexEvents(session.header, session.events)
    this.ready = true
  }

  /** Follow one appended event. */
  observe(session: Session, event: SessionEvent): void {
    this.indexEvents(session.header, [event])
  }

  private indexEvents(header: SessionHeader, events: readonly SessionEvent[]): void {
    const sessionId = header.id as string
    this.knownSessions.add(sessionId)
    let title = this.titles.get(sessionId) ?? TITLE_FALLBACK(header)
    let high = this.highSeq.get(sessionId) ?? -1
    // A fork inherits `seedLength` leading events verbatim from its parent.
    // Skip that prefix ONLY when the parent is actually in this corpus —
    // otherwise (parent archived, deleted, or never installed on this
    // machine) those messages exist nowhere else and must stay searchable.
    // The content fingerprint below still prevents a double index if the
    // parent is scanned later.
    const parent = header.parentSession
    const inherited = parent !== undefined && this.knownSessions.has(parent as string)
      ? header.seedLength ?? 0
      : 0
    const pending: Doc[] = []
    let titleChanged = false
    for (const event of events) {
      if (event.seq <= high) continue
      high = event.seq
      // `session/title` is a declaration-merged event owned by
      // dsh-session-title; read it structurally so this package does not
      // depend on that merge being in the program.
      const generic = event as { type: string; data?: unknown }
      if (generic.type === 'session/title') {
        // The session's CURRENT name is what every document carries
        // (obsidian-omnisearch shows a note's present title, not the one it had when
        // a paragraph was written); a later title event restamps the lot.
        const next = (generic.data as { title?: string } | undefined)?.title
        if (typeof next === 'string' && next.length > 0 && next !== title) {
          title = next
          titleChanged = true
        }
        continue
      }
      if (event.seq < inherited) continue
      const message = messageText(event)
      if (message === undefined || message.text.length === 0) continue
      // Second line of defence for forks whose parent log is gone, and for
      // resumed sessions whose constructor seed re-emits: identical
      // role+text is one document.
      const fingerprint = `${message.role}\u0000${message.text}`
      if (this.seen.has(fingerprint)) continue
      this.seen.add(fingerprint)
      pending.push({
        id: `${sessionId}#${String(event.seq)}`,
        sessionId,
        seq: event.seq,
        role: message.role,
        time: event.time,
        title,
        text: message.text,
      })
    }
    this.highSeq.set(sessionId, high)
    if (titleChanged) {
      this.titles.set(sessionId, title)
      this.retitle(sessionId, title)
      for (const doc of pending) doc.title = title
    } else if (!this.titles.has(sessionId)) {
      this.titles.set(sessionId, title)
    }
    if (pending.length === 0) return
    let ids = this.docsBySession.get(sessionId)
    if (ids === undefined) {
      ids = new Set()
      this.docsBySession.set(sessionId, ids)
    }
    for (const doc of pending) ids.add(doc.id)
    this.engine.addAll(pending)
  }

  /** A rename re-stamps every document of the session (title is a stored + indexed field). */
  private retitle(sessionId: string, title: string): void {
    const ids = this.docsBySession.get(sessionId)
    if (ids === undefined || ids.size === 0) return
    const docs: Doc[] = []
    for (const id of ids) {
      const stored = this.stored(id)
      if (stored === undefined) continue
      docs.push({ ...stored, title })
    }
    for (const doc of docs) this.engine.discard(doc.id)
    this.engine.addAll(docs)
  }

  private stored(id: string): Doc | undefined {
    // MiniSearch exposes stored fields only through search results; a
    // targeted lookup by id goes through the internal store map.
    const internal = this.engine as unknown as { _documentIds: Map<number, string>; _storedFields: Map<number, Omit<Doc, 'id'>> }
    for (const [shortId, docId] of internal._documentIds) {
      if (docId !== id) continue
      const fields = internal._storedFields.get(shortId)
      return fields === undefined ? undefined : { id, ...fields }
    }
    return undefined
  }

  search(rawQuery: string, limit: number): SearchHit[] {
    const query = rawQuery.trim()
    if (query.length === 0) return []
    let results = this.engine.search(query, SEARCH_OPTIONS)
    // Omnisearch's fallback: strict AND first, OR when nothing lines up.
    if (results.length === 0) results = this.engine.search(query, { ...SEARCH_OPTIONS, combineWith: 'OR' })
    const hits: SearchHit[] = []
    for (const result of results.slice(0, limit)) {
      const doc = result as unknown as Doc & { score: number; terms: string[] }
      hits.push({
        sessionId: doc.sessionId,
        seq: doc.seq,
        role: doc.role,
        time: doc.time,
        title: doc.title,
        snippet: excerpt(doc.text, doc.terms),
        terms: doc.terms,
        score: doc.score,
      })
    }
    return hits
  }
}

/** ~160-char window around the first matched term (obsidian-omnisearch's excerpt rule). */
export function excerpt(text: string, terms: readonly string[]): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const lower = flat.toLowerCase()
  let at = -1
  for (const term of terms) {
    const i = lower.indexOf(term.toLowerCase())
    if (i !== -1 && (at === -1 || i < at)) at = i
  }
  const WINDOW = 160
  if (at === -1) return flat.length > WINDOW ? `${flat.slice(0, WINDOW)}…` : flat
  const start = Math.max(0, at - 50)
  const end = Math.min(flat.length, start + WINDOW)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}
