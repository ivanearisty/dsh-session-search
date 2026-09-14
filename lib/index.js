import { SessionIndex } from './indexer.js';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { SearchSettingsSchema } from './settings.js';
import { SEARCH_SETTINGS_NAMESPACE } from './namespace.js';
const CHANNEL = '/dsh-session-search';
export const name = 'dsh-session-search';
export const inject = ['connection', 'sessions'];
export function apply(ctx) {
    const log = ctx.logger('session-search');
    // Registering the namespace also earns the plugin its Settings → Plugins
    // card: that tab dispatches one card per Host-served namespace.
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.register(settingsNamespace(SEARCH_SETTINGS_NAMESPACE), SearchSettingsSchema);
    });
    const index = new SessionIndex();
    // Boot build from persistence (optional service: absent = live-only index).
    ctx.inject(['sessionPersistence'], (persistCtx) => {
        const persistence = persistCtx.get('sessionPersistence');
        if (persistence === undefined)
            return;
        void index.buildFromPersistence(persistence, ctx.sessions.list()).then((stats) => {
            log.info(`indexed ${String(stats.documents)} messages from ${String(stats.sessions)} sessions in ${String(stats.ms)} ms`);
            if (stats.skipped.length > 0) {
                log.warn(`skipped ${String(stats.skipped.length)} unreadable session log(s): ${stats.skipped.slice(0, 5).join('; ')}`);
            }
        }, (error) => {
            log.warn(`boot index failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    });
    // Live sessions: seed what is already in memory, then follow appends.
    for (const session of ctx.sessions.list())
        index.seedLive(session);
    ctx.on('session/created', (session) => { index.seedLive(session); });
    ctx.on('session/event', (session, event) => { index.observe(session, event); });
    ctx.inject(['connection'], (connectionCtx) => {
        const connection = connectionCtx.get('connection');
        connectionCtx.effect(() => connection.rpc.handle(CHANNEL, async (endpoint, payload) => {
            const args = (payload ?? {});
            try {
                if (endpoint === 'status')
                    return { ok: true, value: index.status() };
                if (endpoint === 'search') {
                    const query = typeof args.query === 'string' ? args.query : '';
                    const limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.max(1, Math.min(200, Math.floor(args.limit))) : 60;
                    const hits = index.search(query, limit);
                    return { ok: true, value: { hits, ...index.status() } };
                }
                throw new Error(`unknown endpoint "${endpoint}"`);
            }
            catch (error) {
                return { ok: false, error: { code: 'search-error', message: error instanceof Error ? error.message : String(error) } };
            }
        }, { authority: 'trusted-host' }), 'dsh-session-search: channel');
    });
}
