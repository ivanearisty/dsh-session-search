/**
 * dsh-session-search host half: the full-text index and its RPC channel.
 *
 * The index is a MiniSearch instance (the engine behind obsidian-omnisearch)
 * over one document per human/assistant message across every session the
 * deployment persists, plus every live session's in-memory tail. It is
 * built once at boot from the persistence store (~70 sessions / 1 MB of
 * message text indexes in about a second) and then kept current from
 * the `session/event` firehose — no rescans, no timers. The browser never
 * downloads the index; queries go over `/dsh-session-search` (`search`,
 * `status`) and return small snippet rows.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-session-search";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
