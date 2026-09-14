import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { createElement } from 'react';
import { SearchPalette } from './SearchPalette.js';
import { SettingsCard } from './SettingsCard.js';
import { SEARCH_SETTINGS_NAMESPACE } from '../namespace.js';
import { revealMessage } from './reveal.js';
const CHANNEL = '/dsh-session-search';
export const inject = ['slots', 'connection', 'sessions', 'workspaces'];
/**
 * Optional companion: `dsh-kepler-graveyard` publishes this channel and can
 * un-archive a session. It is NOT a dependency — when the channel is absent
 * (the common case), archived hits are still shown as tombstones, just
 * without a Resurrect button. Probed once per palette open.
 */
const GRAVEYARD = '/kepler-dsh-graveyard';
/** Whether a keydown is our chord: physical K with Option/Alt alone. */
function isSearchChord(e) {
    return e.code === 'KeyK' && e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.repeat;
}
export function apply(ctx) {
    const connection = ctx.get('connection');
    const sessions = ctx.sessions;
    const workspaces = ctx.workspaces;
    const store = createSnapshotStore({
        open: false, query: '', hits: [], status: 'idle', error: null, documents: 0, sessionsIndexed: 0, archived: [], resurrecting: null, canResurrect: false,
    });
    let generation = 0;
    const run = async (query) => {
        const gen = ++generation;
        if (query.trim().length === 0) {
            store.update((d) => { d.hits = []; d.status = 'idle'; d.error = null; });
            return;
        }
        store.update((d) => { d.status = 'searching'; });
        const result = await connection.rpc.call(CHANNEL, 'search', { query, limit: 60 });
        if (gen !== generation)
            return;
        if (!result.ok) {
            store.update((d) => { d.status = 'error'; d.error = result.error.message; });
            return;
        }
        const value = result.value;
        const listed = new Set(sessions.list.getSnapshot().ids);
        const archivedSet = new Set(workspaces.list.getSnapshot().archivedSessionIds);
        store.update((d) => {
            // A hit is openable only when its session is on the list and not
            // archived; everything else is a tombstone the row must say so about.
            d.archived = [...new Set(value.hits.map(h => h.sessionId).filter(id => archivedSet.has(id) || !listed.has(id)))];
            d.hits = value.hits;
            d.documents = value.documents;
            d.sessionsIndexed = value.sessions;
            d.status = 'ready';
            d.error = null;
        });
    };
    let timer;
    const setQuery = (query) => {
        store.update((d) => { d.query = query; });
        if (timer !== undefined)
            clearTimeout(timer);
        timer = setTimeout(() => { void run(query); }, 120);
    };
    const open = () => {
        store.update((d) => { d.open = true; });
        // Probe the optional resurrect companion: `list` is its read-only
        // endpoint, so a success means the channel is really there.
        void connection.rpc.call(GRAVEYARD, 'list', {}).then((probe) => {
            store.update((d) => { d.canResurrect = probe.ok; });
        }, () => { store.update((d) => { d.canResurrect = false; }); });
        void connection.rpc.call(CHANNEL, 'status', {}).then((result) => {
            if (!result.ok)
                return;
            const value = result.value;
            store.update((d) => { d.documents = value.documents; d.sessionsIndexed = value.sessions; });
        });
    };
    const close = () => { store.update((d) => { d.open = false; }); };
    const toggle = () => { if (store.getSnapshot().open)
        close();
    else
        open(); };
    const pick = (hit) => {
        if (store.getSnapshot().archived.includes(hit.sessionId))
            return;
        close();
        const { current } = sessions.list.getSnapshot();
        if (current !== hit.sessionId)
            sessions.open(hit.sessionId);
        void revealMessage(document, hit, () => sessions.binding(hit.sessionId)?.session);
    };
    /** Archived hit: resurrect through the graveyard plugin (rewrites the archive set + restarts, ~15 s). */
    const resurrect = async (sessionId) => {
        store.update((d) => { d.resurrecting = sessionId; });
        const result = await connection.rpc.call(GRAVEYARD, 'resurrect', { sessionId });
        if (!result.ok)
            store.update((d) => { d.resurrecting = null; d.status = 'error'; d.error = result.error.message; });
    };
    ctx.effect(() => {
        const onKeyDown = (e) => {
            if (!isSearchChord(e))
                return;
            e.preventDefault();
            e.stopPropagation();
            toggle();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            if (timer !== undefined)
                clearTimeout(timer);
        };
    }, 'dsh-session-search: chord');
    // Public face for sibling plugins (the command palette lists "Search messages…").
    ctx.effect(() => {
        const w = window;
        w.__dshSessionSearch = {
            open, close,
            // `reveal` is the smoke-test seam (check-search-palette.mjs drives it directly).
            reveal: (hit) => revealMessage(document, hit, () => sessions.binding(hit.sessionId)?.session),
        };
        return () => { delete w.__dshSessionSearch; };
    }, 'dsh-session-search: window face');
    // Settings → Plugins card: where users manage everything else they installed.
    // The card must be registered inside an effect on the INJECTED context:
    // `slots.inject` returns a disposer that only binds when the owning fiber
    // owns it, so calling it bare in the inject callback registers nothing.
    ctx.inject(['slots'], (scoped) => {
        scoped.effect(() => scoped.slots.inject('settings.plugin.item', () => scoped.slots.register({
            name: 'settings.plugin.item',
            key: SEARCH_SETTINGS_NAMESPACE,
            inject: () => ({ hooks: { search: store } }),
        }, SettingsCard)), 'dsh-session-search: settings card');
    });
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-session-search',
        order: 910,
        inject: () => ({
            hooks: { search: store },
            setQuery, close, pick, resurrect,
        }),
    }, SearchEntry));
}
/** shell.overlay entry: renders the palette only while open. */
function SearchEntry(props) {
    const open = props.useSearch(s => s.open);
    if (!open)
        return null;
    return createElement(SearchPalette, { useSearch: props.useSearch, setQuery: props.setQuery, close: props.close, pick: props.pick, resurrect: props.resurrect });
}
