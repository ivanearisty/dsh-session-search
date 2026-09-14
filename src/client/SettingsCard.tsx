/**
 * The plugin's card in Settings → Plugins.
 *
 * Every well-behaved DSH plugin claims a `settings.plugin.item` seat so an
 * installed plugin is discoverable where users manage plugins, instead of
 * only through its keyboard chord. The card also reports live index size,
 * which is the one piece of state a user may want to confirm.
 */
import type { ReactNode } from 'react'
import type { SearchState } from './types.js'

const CSS = `
.dss-card { display: flex; flex-direction: column; gap: 6px; }
.dss-card p { margin: 0; font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-secondary); }
.dss-card dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 4px 0 0; align-items: baseline; }
.dss-card dt, .dss-card dd { margin: 0; }
.dss-card dd { font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-secondary); }
.dss-key { font: var(--dsw-font-xs-strong-13); font-family: var(--ds-font-family-code, var(--dsw-font-family));
  white-space: nowrap; padding: 1px 7px; border-radius: 5px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
`
let cssInjected = false
function ensureCss(): void {
  if (cssInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.setAttribute('data-plugin', 'dsh-session-search-card')
  style.textContent = CSS
  document.head.appendChild(style)
  cssInjected = true
}

export interface SettingsCardProps {
  useSearch: <S>(select: (s: SearchState) => S) => S
}

export function SettingsCard({ useSearch }: SettingsCardProps): ReactNode {
  ensureCss()
  const documents = useSearch(s => s.documents)
  const sessions = useSearch(s => s.sessionsIndexed)
  return (
    <div className="dss-card">
      <p>
        Full-text search across every conversation. The index is built on the host from your
        session logs and kept current as you chat; nothing leaves this machine.
      </p>
      <dl>
        <dt><span className="dss-key">⌥K</span></dt>
        <dd>Open search</dd>
        <dt><span className="dss-key">↵</span></dt>
        <dd>Open the session and scroll to the matching message</dd>
      </dl>
      <p>
        {documents > 0
          ? `Indexed: ${String(documents)} messages across ${String(sessions)} sessions.`
          : 'Index size is reported here once the palette has been opened.'}
      </p>
    </div>
  )
}
