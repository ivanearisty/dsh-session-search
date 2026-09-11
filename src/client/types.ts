/** Wire + view types shared by the palette pieces (browser-safe, no host imports). */

/** One result row as the host returns it (see ../indexer.ts SearchHit). */
export interface SearchHit {
  sessionId: string
  seq: number
  role: 'user' | 'assistant'
  time: number
  title: string
  snippet: string
  terms: string[]
  score: number
}

/** Palette store state. */
export interface SearchState {
  open: boolean
  query: string
  hits: SearchHit[]
  status: 'idle' | 'searching' | 'ready' | 'error'
  error: string | null
  documents: number
  sessionsIndexed: number
  /** Session ids among the hits that are archived or otherwise not openable from the sidebar. */
  archived: string[]
  /** Session id whose resurrection (graveyard restart) is in flight. */
  resurrecting: string | null
  /** Whether the optional resurrect companion plugin answered its probe. */
  canResurrect: boolean
}
