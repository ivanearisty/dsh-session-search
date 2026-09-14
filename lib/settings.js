/**
 * Durable settings for session search, shared by the Host schema and the
 * browser scope.
 *
 * Registering this namespace is also what puts the plugin's card on
 * Settings → Plugins: that tab dispatches one card per namespace the Host
 * serves, so a plugin with no settings has no card there.
 */
import z from '@deepseek-ai/schemastery';
export { SEARCH_SETTINGS_NAMESPACE } from './namespace.js';
/** Durable schema; also the envelope the browser scope validates against. */
export const SearchSettingsSchema = z.object({
    resultLimit: z.natural().default(60),
    indexAssistant: z.boolean().default(true),
});
