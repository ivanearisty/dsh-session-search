import type { SearchHit, SearchState } from './types.js';
export interface SearchPaletteProps {
    useSearch: <S>(select: (s: SearchState) => S) => S;
    setQuery: (q: string) => void;
    close: () => void;
    pick: (hit: SearchHit) => void;
    resurrect: (sessionId: string) => Promise<void>;
}
export declare function SearchPalette({ useSearch, setQuery, close, pick, resurrect }: SearchPaletteProps): import("react").JSX.Element;
