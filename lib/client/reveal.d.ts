/**
 * Scroll-to-hit. The conversation view does not stamp seqs on message DOM,
 * so the hit is located by text: after the session renders, find the
 * smallest block whose text contains a probe from the snippet, scroll it
 * into view, and flash it. The chat window opens on the newest 50 messages
 * (PAGE_MESSAGES); an older hit is reached by paging the session's history
 * back through `loadOlder()` until the probe appears or the log is
 * exhausted (bounded). A miss is a silent no-op — the session still opened.
 */
import type { SearchHit } from './types.js';
/** The session-side pager the reveal drives (structural slice of the client session face). */
export interface PagerLike {
    loadOlder(): Promise<void>;
    getSnapshot(): {
        hasMore: boolean;
        loadingOlder: boolean;
        openState: string;
    };
}
/**
 * Reveal one hit. Resolves true when the node was flashed, false when the
 * probe was never found (session never rendered, or the text is not on the
 * folded surface — e.g. compacted away).
 */
export declare function revealMessage(doc: Document, hit: SearchHit, pager: () => PagerLike | undefined): Promise<boolean>;
