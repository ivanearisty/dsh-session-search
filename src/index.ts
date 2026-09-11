/**
 * dsh-plugin-omnisearch host half: the full-text index and its RPC channel.
 *
 * The index is a MiniSearch instance (the engine behind obsidian-omnisearch)
 * over one document per human/assistant message across every session the
 * deployment persists, plus every live session's in-memory tail. It is
 * built once at boot from the persistence store (~70 sessions / 1 MB of
 * message text on kepler: well under a second) and then kept current from
 * the `session/event` firehose — no rescans, no timers. The browser never
 * downloads the index; queries go over `/kepler-dsh-search` (`search`,
 * `status`) and return small snippet rows.
 */
import type { Context } from '@deepseek-ai/cordis'
import { SessionIndex } from './indexer.js'
import type { SearchHit } from './indexer.js'

const CHANNEL = '/dsh-omnisearch'

interface Envelope {
  ok: true
  value: unknown
}
interface Failure {
  ok: false
  error: { code: string; message: string }
}

export const name = 'dsh-plugin-omnisearch'
export const inject = ['connection', 'sessions']

export function apply(ctx: Context): void {
  const log = ctx.logger('omnisearch')
  const index = new SessionIndex()

  // Boot build from persistence (optional service: absent = live-only index).
  ctx.inject(['sessionPersistence'], (persistCtx) => {
    const persistence = persistCtx.get('sessionPersistence')
    if (persistence === undefined) return
    void index.buildFromPersistence(persistence, ctx.sessions.list()).then((stats) => {
      log.info(`indexed ${String(stats.documents)} messages from ${String(stats.sessions)} sessions in ${String(stats.ms)} ms`)
      if (stats.skipped.length > 0) {
        log.warn(`skipped ${String(stats.skipped.length)} unreadable session log(s): ${stats.skipped.slice(0, 5).join('; ')}`)
      }
    }, (error: unknown) => {
      log.warn(`boot index failed: ${error instanceof Error ? error.message : String(error)}`)
    })
  })

  // Live sessions: seed what is already in memory, then follow appends.
  for (const session of ctx.sessions.list()) index.seedLive(session)
  ctx.on('session/created', (session) => { index.seedLive(session) })
  ctx.on('session/event', (session, event) => { index.observe(session, event) })

  ctx.inject(['connection'], (connectionCtx) => {
    const connection = connectionCtx.get('connection')
    connectionCtx.effect(() => connection.rpc.handle(
      CHANNEL,
      async (endpoint: string, payload: unknown): Promise<Envelope | Failure> => {
        const args = (payload ?? {}) as { query?: string; limit?: number }
        try {
          if (endpoint === 'status') return { ok: true, value: index.status() }
          if (endpoint === 'search') {
            const query = typeof args.query === 'string' ? args.query : ''
            const limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.max(1, Math.min(200, Math.floor(args.limit))) : 60
            const hits: SearchHit[] = index.search(query, limit)
            return { ok: true, value: { hits, ...index.status() } }
          }
          throw new Error(`unknown endpoint "${endpoint}"`)
        } catch (error) {
          return { ok: false, error: { code: 'search-error', message: error instanceof Error ? error.message : String(error) } }
        }
      },
      { authority: 'trusted-host' } as never,
    ), 'dsh-plugin-omnisearch: channel')
  })
}
