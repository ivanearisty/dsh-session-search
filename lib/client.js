window.__ModuleLoader__.load({
	id: "dsh-session-search",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/SearchPalette.tsx
		/**
		* The search palette: a centered input over a result list, in the style of
		* obsidian-omnisearch
		* (query at the top, excerpts with highlighted terms, session title + role +
		* time per row, arrow/Enter/Escape keyboard model). Pure React on the
		* --dsw-* tokens; no dependencies beyond React so the boot bundle stays
		* small (the index and ranking live host-side).
		*/
		const CSS$1 = `
.ks-scrim { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh; background: var(--dsw-alias-bg-mask-2, rgba(0,0,0,.45)); }
.ks-card { width: min(720px, 92vw); max-height: 72vh; display: flex; flex-direction: column; overflow: hidden;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; box-shadow: var(--dsw-shadow-lv3); font: var(--dsw-font-s-14); }
.ks-inputRow { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ks-inputRow svg { flex: none; color: var(--dsw-alias-label-tertiary); }
.ks-input { flex: 1; min-width: 0; appearance: none; border: 0; outline: 0; background: transparent; color: inherit;
  font: var(--dsw-font-base-16, 16px/1.4 inherit); }
.ks-input::placeholder { color: var(--dsw-alias-label-tertiary); }
.ks-kbd { flex: none; font: var(--dsw-font-xs-13); font-family: var(--ds-font-family-code, var(--dsw-font-family)); color: var(--dsw-alias-label-tertiary);
  padding: 1px 6px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 5px; background: var(--dsw-alias-bg-layer-2); }
.ks-list { flex: 1; min-height: 0; overflow-y: auto; padding: 6px; }
.ks-group { padding: 8px 8px 2px; font: var(--dsw-font-xs-strong-13); color: var(--dsw-alias-label-secondary); text-transform: uppercase; letter-spacing: .04em;
  display: flex; align-items: baseline; gap: 8px; }
.ks-group small { text-transform: none; letter-spacing: 0; font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); }
.ks-group .ks-tomb { margin-left: auto; text-transform: none; letter-spacing: 0; font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); }
.ks-group .ks-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xs-13); padding: 1px 8px; border-radius: 5px; cursor: pointer; text-transform: none; letter-spacing: 0; }
.ks-group .ks-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ks-row[data-archived="true"] { cursor: default; opacity: .6; }
.ks-row { display: block; width: 100%; appearance: none; border: 0; background: none; text-align: left; cursor: pointer;
  padding: 7px 10px; border-radius: 8px; color: inherit; }
.ks-row[aria-selected="true"] { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.ks-meta { display: flex; gap: 8px; align-items: baseline; margin-bottom: 2px; font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); }
.ks-role { font: var(--dsw-font-xs-strong-13); color: var(--dsw-alias-label-secondary); }
.ks-role[data-role="user"] { color: var(--dsw-alias-brand-text, var(--dsw-alias-brand-primary)); }
.ks-snip { font: var(--dsw-font-s-14); line-height: 1.4; color: var(--dsw-alias-label-primary); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ks-snip mark { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
.ks-empty { padding: 28px 14px; text-align: center; color: var(--dsw-alias-label-tertiary); }
.ks-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 7px 14px; border-top: 1px solid var(--dsw-alias-border-l1);
  font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); }
.ks-foot span { display: inline-flex; gap: 6px; align-items: center; }
`;
		let cssInjected$2 = false;
		function ensureCss$2() {
			if (cssInjected$2 || typeof document === "undefined") return;
			const style = document.createElement("style");
			style.setAttribute("data-plugin", "dsh-session-search");
			style.textContent = CSS$1;
			document.head.appendChild(style);
			cssInjected$2 = true;
		}
		const when = (ms) => new Date(ms).toLocaleString(void 0, {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit"
		});
		/** Wrap every matched term occurrence in <mark>. */
		function highlight(text, terms) {
			const clean = terms.map((t) => t.trim()).filter((t) => t.length > 1);
			if (clean.length === 0) return text;
			const re = new RegExp(`(${clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
			return text.split(re).map((part, i) => i % 2 === 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("mark", { children: part }, i) : part);
		}
		/** Group consecutive-by-session while keeping best-first order of first appearance. */
		function groupHits(hits) {
			const order = [];
			const byId = /* @__PURE__ */ new Map();
			for (const hit of hits) {
				let g = byId.get(hit.sessionId);
				if (g === void 0) {
					g = {
						sessionId: hit.sessionId,
						title: hit.title,
						hits: []
					};
					byId.set(hit.sessionId, g);
					order.push(g);
				}
				g.hits.push(hit);
			}
			for (const g of order) g.hits.sort((a, b) => a.seq - b.seq);
			return order;
		}
		function SearchPalette({ useSearch, setQuery, close, pick, resurrect }) {
			ensureCss$2();
			const query = useSearch((s) => s.query);
			const hits = useSearch((s) => s.hits);
			const status = useSearch((s) => s.status);
			const error = useSearch((s) => s.error);
			const documents = useSearch((s) => s.documents);
			const sessionsIndexed = useSearch((s) => s.sessionsIndexed);
			const archived = useSearch((s) => s.archived);
			const resurrecting = useSearch((s) => s.resurrecting);
			const canResurrect = useSearch((s) => s.canResurrect);
			const [cursor, setCursor] = (0, react.useState)(0);
			const input = (0, react.useRef)(null);
			const list = (0, react.useRef)(null);
			const groups = (0, react.useMemo)(() => groupHits(hits), [hits]);
			const flat = (0, react.useMemo)(() => groups.flatMap((g) => g.hits), [groups]);
			(0, react.useEffect)(() => {
				input.current?.focus();
				input.current?.select();
			}, []);
			(0, react.useEffect)(() => {
				setCursor(0);
			}, [hits]);
			(0, react.useEffect)(() => {
				(list.current?.querySelector(`[data-index="${String(cursor)}"]`))?.scrollIntoView({ block: "nearest" });
			}, [cursor]);
			const onKeyDown = (e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					close();
					return;
				}
				if (e.key === "ArrowDown" || e.ctrlKey && e.key === "n") {
					e.preventDefault();
					setCursor((c) => Math.min(flat.length - 1, c + 1));
					return;
				}
				if (e.key === "ArrowUp" || e.ctrlKey && e.key === "p") {
					e.preventDefault();
					setCursor((c) => Math.max(0, c - 1));
					return;
				}
				if (e.key === "Enter") {
					e.preventDefault();
					const hit = flat[cursor];
					if (hit !== void 0) pick(hit);
				}
			};
			let index = -1;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "ks-scrim",
				role: "presentation",
				onMouseDown: (e) => {
					if (e.target === e.currentTarget) close();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ks-card",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": "Search messages",
					onKeyDown,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ks-inputRow",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
									width: "16",
									height: "16",
									viewBox: "0 0 24 24",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "2",
									strokeLinecap: "round",
									strokeLinejoin: "round",
									"aria-hidden": "true",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
										cx: "11",
										cy: "11",
										r: "7"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m20 20-3.5-3.5" })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: input,
									className: "ks-input",
									type: "text",
									value: query,
									placeholder: "Search every conversation…",
									spellCheck: false,
									autoComplete: "off",
									"aria-label": "Search query",
									"aria-controls": "dsh-session-search-results",
									onChange: (e) => {
										setQuery(e.currentTarget.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "ks-kbd",
									children: "esc"
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ks-list",
							id: "dsh-session-search-results",
							role: "listbox",
							ref: list,
							children: [
								query.trim().length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ks-empty",
									children: [
										"Type to search across ",
										sessionsIndexed,
										" sessions · ",
										documents,
										" messages"
									]
								}),
								query.trim().length > 0 && status === "ready" && flat.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ks-empty",
									children: [
										"No matches for “",
										query,
										"”"
									]
								}),
								status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ks-empty",
									role: "alert",
									children: error
								}),
								resurrecting !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ks-empty",
									role: "status",
									children: "Resurrecting — the server restarts (~15 s); the session returns to your sidebar when the GUI is back."
								}),
								groups.map((group) => {
									const tomb = archived.includes(group.sessionId);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ks-group",
										children: [
											tomb && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												children: "🪦"
											}),
											" ",
											group.title,
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
												group.hits.length,
												" hit",
												group.hits.length === 1 ? "" : "s"
											] }),
											tomb && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ks-tomb",
												children: "archived"
											}),
											tomb && canResurrect && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "ks-btn",
												disabled: resurrecting !== null,
												onClick: () => {
													resurrect(group.sessionId);
												},
												children: resurrecting === group.sessionId ? "Rising…" : "Resurrect"
											})
										]
									}), group.hits.map((hit) => {
										index += 1;
										const i = index;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											role: "option",
											className: "ks-row",
											"data-index": i,
											"data-archived": tomb,
											"aria-selected": i === cursor,
											"aria-disabled": tomb,
											title: tomb ? "Archived — resurrect the session to open it" : void 0,
											onMouseEnter: () => {
												setCursor(i);
											},
											onClick: () => {
												pick(hit);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ks-meta",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "ks-role",
													"data-role": hit.role,
													children: hit.role === "user" ? "You" : "Assistant"
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: when(hit.time) })]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "ks-snip",
												children: highlight(hit.snippet, hit.terms)
											})]
										}, `${hit.sessionId}#${String(hit.seq)}`);
									})] }, group.sessionId);
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ks-foot",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("kbd", {
									className: "ks-kbd",
									children: "↑↓"
								}),
								" navigate ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("kbd", {
									className: "ks-kbd",
									children: "↵"
								}),
								" open"
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: status === "searching" ? "searching…" : `${flat.length} result${flat.length === 1 ? "" : "s"}` })]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/SettingsCard.tsx
		const CSS = `
.dss-card { display: flex; flex-direction: column; gap: 6px; }
.dss-card p { margin: 0; font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-secondary); }
.dss-card dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 4px 0 0; align-items: baseline; }
.dss-card dt, .dss-card dd { margin: 0; }
.dss-card dd { font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-secondary); }
.dss-key { font: var(--dsw-font-xs-strong-13); font-family: var(--ds-font-family-code, var(--dsw-font-family));
  white-space: nowrap; padding: 1px 7px; border-radius: 5px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
`;
		let cssInjected$1 = false;
		function ensureCss$1() {
			if (cssInjected$1 || typeof document === "undefined") return;
			const style = document.createElement("style");
			style.setAttribute("data-plugin", "dsh-session-search-card");
			style.textContent = CSS;
			document.head.appendChild(style);
			cssInjected$1 = true;
		}
		function SettingsCard({ useSearch }) {
			ensureCss$1();
			const documents = useSearch((s) => s.documents);
			const sessions = useSearch((s) => s.sessionsIndexed);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dss-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Full-text search across every conversation. The index is built on the host from your session logs and kept current as you chat; nothing leaves this machine." }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dss-key",
							children: "⌥K"
						}) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: "Open search" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dss-key",
							children: "↵"
						}) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: "Open the session and scroll to the matching message" })
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: documents > 0 ? `Indexed: ${String(documents)} messages across ${String(sessions)} sessions.` : "Index size is reported here once the palette has been opened." })
				]
			});
		}
		//#endregion
		//#region src/namespace.ts
		/**
		* Settings namespace owned by this plugin, in its own module so the browser
		* half can import it without pulling the schema (and schemastery) into the
		* client bundle.
		*/
		const SEARCH_SETTINGS_NAMESPACE = "dsh-session-search";
		//#endregion
		//#region src/client/reveal.ts
		const FLASH_CSS = `
@keyframes dsh-session-search-flash { 0% { box-shadow: 0 0 0 3px var(--dsw-alias-brand-primary); } 100% { box-shadow: 0 0 0 0 transparent; } }
.dsh-session-search-flash { animation: dsh-session-search-flash 1.6s ease-out 1; border-radius: 8px; }
`;
		let cssInjected = false;
		function ensureCss(doc) {
			if (cssInjected) return;
			const style = doc.createElement("style");
			style.setAttribute("data-plugin", "dsh-session-search-reveal");
			style.textContent = FLASH_CSS;
			doc.head.appendChild(style);
			cssInjected = true;
		}
		/** A ~40-char probe from the middle of the snippet, ellipses stripped. */
		function probe(hit) {
			const flat = hit.snippet.replace(/[…]/g, " ").replace(/\s+/g, " ").trim();
			if (flat.length <= 48) return flat;
			const mid = Math.floor(flat.length / 2);
			return flat.slice(Math.max(0, mid - 24), mid + 24).trim();
		}
		function findNode(doc, needle) {
			const candidates = (doc.querySelector("[data-conversation-scroll]") ?? doc.body).querySelectorAll("p, li, pre, td, h1, h2, h3, h4, blockquote, div");
			const norm = (s) => (s ?? "").replace(/\s+/g, " ");
			let best;
			for (const el of candidates) {
				if (!norm(el.textContent).includes(needle)) continue;
				if (best === void 0 || el.textContent.length < best.textContent.length) best = el;
			}
			return best;
		}
		const sleep = (ms) => new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
		/**
		* Reveal one hit. Resolves true when the node was flashed, false when the
		* probe was never found (session never rendered, or the text is not on the
		* folded surface — e.g. compacted away).
		*/
		async function revealMessage(doc, hit, pager) {
			ensureCss(doc);
			const needle = probe(hit);
			if (needle.length < 8) return false;
			const flash = (node) => {
				node.scrollIntoView({
					block: "center",
					behavior: "smooth"
				});
				node.classList.add("dsh-session-search-flash");
				setTimeout(() => {
					node.classList.remove("dsh-session-search-flash");
				}, 1800);
				return true;
			};
			const started = Date.now();
			let p;
			while (Date.now() - started < 6e3) {
				const node = findNode(doc, needle);
				if (node !== void 0) return flash(node);
				p = pager();
				if (p !== void 0 && p.getSnapshot().openState === "open" && !p.getSnapshot().loadingOlder) break;
				await sleep(150);
			}
			if (p === void 0) return false;
			for (let pages = 0; pages < 40; pages++) {
				const node = findNode(doc, needle);
				if (node !== void 0) return flash(node);
				const snap = p.getSnapshot();
				if (!snap.hasMore) break;
				if (snap.loadingOlder) {
					await sleep(100);
					continue;
				}
				try {
					await p.loadOlder();
				} catch (error) {
					console.warn("[session-search] loadOlder failed", error);
					break;
				}
				await sleep(160);
			}
			const node = findNode(doc, needle);
			return node === void 0 ? false : flash(node);
		}
		//#endregion
		//#region src/client/index.ts
		const CHANNEL = "/dsh-session-search";
		const inject = [
			"slots",
			"connection",
			"sessions",
			"workspaces"
		];
		/**
		* Optional companion: `dsh-kepler-graveyard` publishes this channel and can
		* un-archive a session. It is NOT a dependency — when the channel is absent
		* (the common case), archived hits are still shown as tombstones, just
		* without a Resurrect button. Probed once per palette open.
		*/
		const GRAVEYARD = "/kepler-dsh-graveyard";
		/** Whether a keydown is our chord: physical K with Option/Alt alone. */
		function isSearchChord(e) {
			return e.code === "KeyK" && e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.repeat;
		}
		function apply(ctx) {
			const connection = ctx.get("connection");
			const sessions = ctx.sessions;
			const workspaces = ctx.workspaces;
			const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
				open: false,
				query: "",
				hits: [],
				status: "idle",
				error: null,
				documents: 0,
				sessionsIndexed: 0,
				archived: [],
				resurrecting: null,
				canResurrect: false
			});
			let generation = 0;
			const run = async (query) => {
				const gen = ++generation;
				if (query.trim().length === 0) {
					store.update((d) => {
						d.hits = [];
						d.status = "idle";
						d.error = null;
					});
					return;
				}
				store.update((d) => {
					d.status = "searching";
				});
				const result = await connection.rpc.call(CHANNEL, "search", {
					query,
					limit: 60
				});
				if (gen !== generation) return;
				if (!result.ok) {
					store.update((d) => {
						d.status = "error";
						d.error = result.error.message;
					});
					return;
				}
				const value = result.value;
				const listed = new Set(sessions.list.getSnapshot().ids);
				const archivedSet = new Set(workspaces.list.getSnapshot().archivedSessionIds);
				store.update((d) => {
					d.archived = [...new Set(value.hits.map((h) => h.sessionId).filter((id) => archivedSet.has(id) || !listed.has(id)))];
					d.hits = value.hits;
					d.documents = value.documents;
					d.sessionsIndexed = value.sessions;
					d.status = "ready";
					d.error = null;
				});
			};
			let timer;
			const setQuery = (query) => {
				store.update((d) => {
					d.query = query;
				});
				if (timer !== void 0) clearTimeout(timer);
				timer = setTimeout(() => {
					run(query);
				}, 120);
			};
			const open = () => {
				store.update((d) => {
					d.open = true;
				});
				connection.rpc.call(GRAVEYARD, "list", {}).then((probe) => {
					store.update((d) => {
						d.canResurrect = probe.ok;
					});
				}, () => {
					store.update((d) => {
						d.canResurrect = false;
					});
				});
				connection.rpc.call(CHANNEL, "status", {}).then((result) => {
					if (!result.ok) return;
					const value = result.value;
					store.update((d) => {
						d.documents = value.documents;
						d.sessionsIndexed = value.sessions;
					});
				});
			};
			const close = () => {
				store.update((d) => {
					d.open = false;
				});
			};
			const toggle = () => {
				if (store.getSnapshot().open) close();
				else open();
			};
			const pick = (hit) => {
				if (store.getSnapshot().archived.includes(hit.sessionId)) return;
				close();
				const { current } = sessions.list.getSnapshot();
				if (current !== hit.sessionId) sessions.open(hit.sessionId);
				revealMessage(document, hit, () => sessions.binding(hit.sessionId)?.session);
			};
			/** Archived hit: resurrect through the graveyard plugin (rewrites the archive set + restarts, ~15 s). */
			const resurrect = async (sessionId) => {
				store.update((d) => {
					d.resurrecting = sessionId;
				});
				const result = await connection.rpc.call(GRAVEYARD, "resurrect", { sessionId });
				if (!result.ok) store.update((d) => {
					d.resurrecting = null;
					d.status = "error";
					d.error = result.error.message;
				});
			};
			ctx.effect(() => {
				const onKeyDown = (e) => {
					if (!isSearchChord(e)) return;
					e.preventDefault();
					e.stopPropagation();
					toggle();
				};
				window.addEventListener("keydown", onKeyDown, true);
				return () => {
					window.removeEventListener("keydown", onKeyDown, true);
					if (timer !== void 0) clearTimeout(timer);
				};
			}, "dsh-session-search: chord");
			ctx.effect(() => {
				const w = window;
				w.__dshSessionSearch = {
					open,
					close,
					reveal: (hit) => revealMessage(document, hit, () => sessions.binding(hit.sessionId)?.session)
				};
				return () => {
					delete w.__dshSessionSearch;
				};
			}, "dsh-session-search: window face");
			ctx.inject(["slots"], (scoped) => {
				scoped.effect(() => scoped.slots.inject("settings.plugin.item", () => scoped.slots.register({
					name: "settings.plugin.item",
					key: SEARCH_SETTINGS_NAMESPACE,
					inject: () => ({ hooks: { search: store } })
				}, SettingsCard)), "dsh-session-search: settings card");
			});
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-session-search",
				order: 910,
				inject: () => ({
					hooks: { search: store },
					setQuery,
					close,
					pick,
					resurrect
				})
			}, SearchEntry));
		}
		/** shell.overlay entry: renders the palette only while open. */
		function SearchEntry(props) {
			if (!props.useSearch((s) => s.open)) return null;
			return (0, react.createElement)(SearchPalette, {
				useSearch: props.useSearch,
				setQuery: props.setQuery,
				close: props.close,
				pick: props.pick,
				resurrect: props.resurrect
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map