import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence';
/** One result row shipped to the browser (owned JSON, no live references). */
export interface SearchHit {
    sessionId: string;
    seq: number;
    role: 'user' | 'assistant';
    time: number;
    title: string;
    /** Query-neighbourhood excerpt with the matched terms kept verbatim. */
    snippet: string;
    /** Matched query terms (for client-side highlighting). */
    terms: string[];
    score: number;
}
/** Index health for the palette footer. */
export interface IndexStatus {
    documents: number;
    sessions: number;
    ready: boolean;
    /** Non-fatal boot-scan problems (unreadable logs), newest scan only. */
    diagnostics: string[];
}
export declare class SessionIndex {
    private readonly engine;
    /** Every session id this index has seen, for fork-parent presence checks. */
    private readonly knownSessions;
    private readonly titles;
    private readonly docsBySession;
    /** Highest seq observed per session — the firehose can replay a resumed session's constructor seed. */
    private readonly highSeq;
    /** Content fingerprints already indexed (role + text) — forks replay their parent's log verbatim. */
    private readonly seen;
    private ready;
    /** Boot-scan diagnostics surfaced through `status` (empty on a clean build). */
    private diagnostics;
    status(): IndexStatus;
    /** Cold build: every persisted log, skipping ids that are live (seedLive covers those). */
    buildFromPersistence(persistence: SessionPersistence, live: readonly Session[]): Promise<{
        documents: number;
        sessions: number;
        ms: number;
        skipped: string[];
    }>;
    /** Index what a live session already holds in memory (boot + `session/created`). */
    seedLive(session: Session): void;
    /** Follow one appended event. */
    observe(session: Session, event: SessionEvent): void;
    private indexEvents;
    /** A rename re-stamps every document of the session (title is a stored + indexed field). */
    private retitle;
    private stored;
    search(rawQuery: string, limit: number): SearchHit[];
}
/** ~160-char window around the first matched term (obsidian-omnisearch's excerpt rule). */
export declare function excerpt(text: string, terms: readonly string[]): string;
