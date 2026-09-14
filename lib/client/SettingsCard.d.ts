/**
 * The plugin's card in Settings → Plugins.
 *
 * Every well-behaved DSH plugin claims a `settings.plugin.item` seat so an
 * installed plugin is discoverable where users manage plugins, instead of
 * only through its keyboard chord. The card also reports live index size,
 * which is the one piece of state a user may want to confirm.
 */
import type { ReactNode } from 'react';
import type { SearchState } from './types.js';
export interface SettingsCardProps {
    useSearch: <S>(select: (s: SearchState) => S) => S;
}
export declare function SettingsCard({ useSearch }: SettingsCardProps): ReactNode;
