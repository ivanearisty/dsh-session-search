# dsh-plugin-omnisearch

Full-text search across **every** DeepSeek Harness conversation. Press `⌥K`
(`Alt+K`), type, and jump straight to the message — not just the session.

Inspired by [obsidian-omnisearch](https://github.com/scambier/obsidian-omnisearch)
and built on the same engine, [MiniSearch](https://github.com/lucaong/minisearch).

## Why

The Harness sidebar search matches session **titles and metadata**. This plugin
indexes the **message bodies** — every prompt you typed and every reply you got —
so you can find that command you ran three weeks ago in a session you never named.

## Install

```sh
dsh plugin --profile web add dsh-plugin-omnisearch
```

Then restart the harness (the host half builds its index at boot).

## Use

| Key | Action |
|---|---|
| `⌥K` / `Alt+K` | Open search |
| `↑` `↓` (or `Ctrl+N` / `Ctrl+P`) | Move through results |
| `↵` | Open the session and scroll to that message |
| `Esc` | Close |

Results group by session, newest first, with the matched terms highlighted.
Choosing a hit opens the session, pages its history back until the message is
on screen, and flashes it.

## How it works

The index lives **entirely on the host** — the browser never downloads it, and
each query returns only a page of short snippets. The tab stays light.

- **One document per message**: your prompts (`user/message` with a human
  source — plugin and system snapshots are skipped) and the assistant's replies.
- **Built once at boot** from the session store, then kept current from the
  live `session/event` stream. No polling, no rescans.
- **Ranking** mirrors omnisearch: prefix + fuzzy matching, a 3× boost on the
  session title, strict AND with an OR fallback when nothing lines up.
- **Renames restamp** every document of a session, so a result always shows the
  session's current name.
- **Forks are de-duplicated** — a forked session inherits its parent's history
  verbatim, so the inherited prefix is skipped *when the parent is also
  present*. When it is not (archived, deleted, or never on this machine), those
  messages are indexed here, because they exist nowhere else.

Reference scale: ~70 sessions / ~1,200 messages indexes in about a second, and
queries answer in single-digit milliseconds.

## Permissions and data

- Reads your local session logs through the harness's own session-store
  service. **Nothing leaves your machine**; there is no network call, no
  telemetry, and no external service.
- Registers one private host channel (`/dsh-omnisearch`) with `search` and
  `status` endpoints, plus one browser overlay and one `keydown` listener.

## Optional companion

If [`dsh-kepler-graveyard`](https://github.com/ivanearisty/kepler-dsh) is also
installed, hits in **archived** sessions show a Resurrect button. Without it,
archived sessions still appear, marked 🪦 and not openable. The companion is
detected at runtime and is in no way required.

## Compatibility

- DeepSeek Harness `0.1.x` (developed against `0.1.1-rc.2`), `web` profile.
- Node `^22.19 || >=24`.
- Harness packages are **optional peer dependencies**: the plugin resolves them
  from the host installation rather than bundling its own copies.

## Known limitations

- Only text is indexed — images, tool call arguments, and reasoning blocks are not.
- The reveal step finds the message by text. If a message was compacted out of
  the visible history, the session still opens but nothing is highlighted.
- Chord is fixed at `⌥K` in this version; it is not yet rebindable.

## License

MIT
