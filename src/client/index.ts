/**
 * dsh-plugin-omnisearch, browser half: the Cmd+K search palette.
 *
 * One `shell.overlay` entry whose visibility rides a snapshot store; one
 * capturing keydown on `window` for the chord. Queries debounce 120 ms and
 * go host-side over `/kepler-dsh-search` (the index never reaches the tab).
 * Picking a row opens the session and, once the conversation has rendered,
 * scrolls to the message and flashes it.
 *
 * Chord: Option+K (Alt+K) — kepler's own convention, matching the sibling
 * hotkeys plugin's Option chords (⌥C/T/F/U/G, ⌥1-9, ⌥N/R/B). Cmd+K belongs
 * to the command palette. Matched on `event.code` so Option+K never types
 * its macOS dead-key glyph ("˚") into the composer. Escape closes.
 */
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConnectionHandle, RpcResult, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createElement } from 'react'
import { SearchPalette } from './SearchPalette.js'
import type { SearchHit, SearchState } from './types.js'
import { revealMessage, type PagerLike } from './reveal.js'

const CHANNEL = '/dsh-omnisearch'

export const inject = ['slots', 'connection', 'sessions', 'workspaces']

/** Structural slice of the client sessions service. */
interface SessionsLike {
  readonly list: { getSnapshot(): { ids: readonly string[]; current: string | undefined } }
  open(id: SessionId): void
  binding(id: SessionId): { session: PagerLike } | undefined
}
/** Structural slice of the client workspaces service (archive set). */
interface WorkspacesLike {
  readonly list: { getSnapshot(): { archivedSessionIds: readonly string[] } }
}
/**
 * Optional companion: `dsh-kepler-graveyard` publishes this channel and can
 * un-archive a session. It is NOT a dependency — when the channel is absent
 * (the common case), archived hits are still shown as tombstones, just
 * without a Resurrect button. Probed once per palette open.
 */
const GRAVEYARD = '/kepler-dsh-graveyard'

/** Whether a keydown is our chord: physical K with Option/Alt alone. */
function isSearchChord(e: KeyboardEvent): boolean {
  return e.code === 'KeyK' && e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.repeat
}

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as unknown as ConnectionHandle
  const sessions = ctx.sessions as unknown as SessionsLike
  const workspaces = ctx.workspaces as unknown as WorkspacesLike
  const store: SnapshotStore<SearchState> = createSnapshotStore<SearchState>({
    open: false, query: '', hits: [], status: 'idle', error: null, documents: 0, sessionsIndexed: 0, archived: [], resurrecting: null, canResurrect: false,
  })

  let generation = 0
  const run = async (query: string): Promise<void> => {
    const gen = ++generation
    if (query.trim().length === 0) {
      store.update((d) => { d.hits = []; d.status = 'idle'; d.error = null })
      return
    }
    store.update((d) => { d.status = 'searching' })
    const result: RpcResult<unknown> = await connection.rpc.call(CHANNEL, 'search', { query, limit: 60 })
    if (gen !== generation) return
    if (!result.ok) {
      store.update((d) => { d.status = 'error'; d.error = result.error.message })
      return
    }
    const value = result.value as { hits: SearchHit[]; documents: number; sessions: number }
    const listed = new Set(sessions.list.getSnapshot().ids)
    const archivedSet = new Set(workspaces.list.getSnapshot().archivedSessionIds)
    store.update((d) => {
      // A hit is openable only when its session is on the list and not
      // archived; everything else is a tombstone the row must say so about.
      d.archived = [...new Set(value.hits.map(h => h.sessionId).filter(id => archivedSet.has(id) || !listed.has(id)))]
      d.hits = value.hits
      d.documents = value.documents
      d.sessionsIndexed = value.sessions
      d.status = 'ready'
      d.error = null
    })
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const setQuery = (query: string): void => {
    store.update((d) => { d.query = query })
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => { void run(query) }, 120)
  }
  const open = (): void => {
    store.update((d) => { d.open = true })
    // Probe the optional resurrect companion: `list` is its read-only
    // endpoint, so a success means the channel is really there.
    void connection.rpc.call(GRAVEYARD, 'list', {}).then((probe: RpcResult<unknown>) => {
      store.update((d) => { d.canResurrect = probe.ok })
    }, () => { store.update((d) => { d.canResurrect = false }) })
    void connection.rpc.call(CHANNEL, 'status', {}).then((result: RpcResult<unknown>) => {
      if (!result.ok) return
      const value = result.value as { documents: number; sessions: number }
      store.update((d) => { d.documents = value.documents; d.sessionsIndexed = value.sessions })
    })
  }
  const close = (): void => { store.update((d) => { d.open = false }) }
  const toggle = (): void => { if (store.getSnapshot().open) close(); else open() }
  const pick = (hit: SearchHit): void => {
    if (store.getSnapshot().archived.includes(hit.sessionId)) return
    close()
    const { current } = sessions.list.getSnapshot()
    if (current !== hit.sessionId) sessions.open(hit.sessionId as SessionId)
    void revealMessage(document, hit, () => sessions.binding(hit.sessionId as SessionId)?.session)
  }
  /** Archived hit: resurrect through the graveyard plugin (rewrites the archive set + restarts, ~15 s). */
  const resurrect = async (sessionId: string): Promise<void> => {
    store.update((d) => { d.resurrecting = sessionId })
    const result: RpcResult<unknown> = await connection.rpc.call(GRAVEYARD, 'resurrect', { sessionId })
    if (!result.ok) store.update((d) => { d.resurrecting = null; d.status = 'error'; d.error = result.error.message })
  }

  ctx.effect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!isSearchChord(e)) return
      e.preventDefault()
      e.stopPropagation()
      toggle()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, 'kepler-dsh: search chord')

  // Public face for sibling plugins (the command palette lists "Search messages…").
  ctx.effect(() => {
    const w = window as unknown as { __dshOmnisearch?: { open: () => void; close: () => void; reveal: (hit: SearchHit) => Promise<boolean> } }
    w.__dshOmnisearch = {
      open, close,
      // `reveal` is the smoke-test seam (check-search-palette.mjs drives it directly).
      reveal: (hit) => revealMessage(document, hit, () => sessions.binding(hit.sessionId as SessionId)?.session),
    }
    return () => { delete w.__dshOmnisearch }
  }, 'kepler-dsh: search window face')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-omnisearch',
    order: 910,
    inject: () => ({
      hooks: { search: store },
      setQuery, close, pick, resurrect,
    }),
  }, SearchEntry))
}

interface EntryProps {
  useSearch: <S>(select: (s: SearchState) => S) => S
  setQuery: (q: string) => void
  close: () => void
  pick: (hit: SearchHit) => void
  resurrect: (sessionId: string) => Promise<void>
}

/** shell.overlay entry: renders the palette only while open. */
function SearchEntry(props: EntryProps) {
  const open = props.useSearch(s => s.open)
  if (!open) return null
  return createElement(SearchPalette, { useSearch: props.useSearch, setQuery: props.setQuery, close: props.close, pick: props.pick, resurrect: props.resurrect })
}
