const FLASH_CSS = `
@keyframes dsh-session-search-flash { 0% { box-shadow: 0 0 0 3px var(--dsw-alias-brand-primary); } 100% { box-shadow: 0 0 0 0 transparent; } }
.dsh-session-search-flash { animation: dsh-session-search-flash 1.6s ease-out 1; border-radius: 8px; }
`;
let cssInjected = false;
function ensureCss(doc) {
    if (cssInjected)
        return;
    const style = doc.createElement('style');
    style.setAttribute('data-plugin', 'dsh-session-search-reveal');
    style.textContent = FLASH_CSS;
    doc.head.appendChild(style);
    cssInjected = true;
}
/** A ~40-char probe from the middle of the snippet, ellipses stripped. */
function probe(hit) {
    const flat = hit.snippet.replace(/[…]/g, ' ').replace(/\s+/g, ' ').trim();
    if (flat.length <= 48)
        return flat;
    const mid = Math.floor(flat.length / 2);
    return flat.slice(Math.max(0, mid - 24), mid + 24).trim();
}
function findNode(doc, needle) {
    const scroller = doc.querySelector('[data-conversation-scroll]') ?? doc.body;
    const candidates = scroller.querySelectorAll('p, li, pre, td, h1, h2, h3, h4, blockquote, div');
    const norm = (s) => (s ?? '').replace(/\s+/g, ' ');
    let best;
    for (const el of candidates) {
        if (!norm(el.textContent).includes(needle))
            continue;
        if (best === undefined || el.textContent.length < best.textContent.length)
            best = el;
    }
    return best;
}
const sleep = (ms) => new Promise(resolve => { setTimeout(resolve, ms); });
/**
 * Reveal one hit. Resolves true when the node was flashed, false when the
 * probe was never found (session never rendered, or the text is not on the
 * folded surface — e.g. compacted away).
 */
export async function revealMessage(doc, hit, pager) {
    ensureCss(doc);
    const needle = probe(hit);
    if (needle.length < 8)
        return false;
    const flash = (node) => {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        node.classList.add('dsh-session-search-flash');
        setTimeout(() => { node.classList.remove('dsh-session-search-flash'); }, 1800);
        return true;
    };
    // Phase 1: wait for the (possibly just-switched) session to be OPEN — its
    // binding resolves and its first history page has landed. A fresh
    // switch briefly resolves no binding, then one in `opening` state.
    const started = Date.now();
    let p;
    while (Date.now() - started < 6000) {
        const node = findNode(doc, needle);
        if (node !== undefined)
            return flash(node);
        p = pager();
        if (p !== undefined && p.getSnapshot().openState === 'open' && !p.getSnapshot().loadingOlder)
            break;
        await sleep(150);
    }
    if (p === undefined)
        return false;
    // Phase 2: page history back until the probe lands (bounded: 40 pages ≈ 2000 messages).
    for (let pages = 0; pages < 40; pages++) {
        const node = findNode(doc, needle);
        if (node !== undefined)
            return flash(node);
        const snap = p.getSnapshot();
        if (!snap.hasMore)
            break;
        if (snap.loadingOlder) {
            await sleep(100);
            continue;
        }
        try {
            await p.loadOlder();
        }
        catch (error) {
            console.warn('[session-search] loadOlder failed', error);
            break;
        }
        // The prepend lands on the next React commit; give it a frame or two.
        await sleep(160);
    }
    const node = findNode(doc, needle);
    return node === undefined ? false : flash(node);
}
