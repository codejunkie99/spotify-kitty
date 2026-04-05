import type { KeyEvent } from "@opentui/core";

export interface SearchEmptyStateInput {
  inputMode: boolean;
  loading: boolean;
  query: string;
  resultsCount: number;
  hasSearched: boolean;
}

export interface FilterOverlayState {
  active: boolean;
  query: string;
}

export interface FilterOverlayKeyResult {
  handled: boolean;
  changed: boolean;
  submit: boolean;
}

export interface ClickSelectionResult {
  selected: number;
  activate: boolean;
}

export function shouldShowSearchEmptyState(input: SearchEmptyStateInput): boolean {
  return !input.inputMode
    && !input.loading
    && input.hasSearched
    && input.query.trim().length > 0
    && input.resultsCount === 0;
}

export function applyFilterOverlayKey(
  state: FilterOverlayState,
  key: KeyEvent,
): FilterOverlayKeyResult {
  if (!state.active && (key.name === "/" || key.sequence === "/")) {
    state.active = true;
    return { handled: true, changed: false, submit: false };
  }

  if (!state.active) {
    return { handled: false, changed: false, submit: false };
  }

  if (key.name === "escape") {
    const changed = state.query.length > 0 || state.active;
    state.active = false;
    state.query = "";
    return { handled: true, changed, submit: false };
  }

  if (key.name === "enter") {
    state.active = false;
    return { handled: true, changed: false, submit: true };
  }

  if (key.name === "backspace") {
    const nextQuery = state.query.slice(0, -1);
    const changed = nextQuery !== state.query;
    state.query = nextQuery;
    return { handled: true, changed, submit: false };
  }

  if (key.sequence && key.sequence.length === 1) {
    state.query += key.sequence;
    return { handled: true, changed: true, submit: false };
  }

  return { handled: false, changed: false, submit: false };
}

export function moveSelection(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(current + delta, length - 1));
}

export function resolveClickSelection(
  currentSelected: number,
  clickedIndex: number,
  length: number,
): ClickSelectionResult {
  if (length <= 0 || clickedIndex < 0 || clickedIndex >= length) {
    return {
      selected: currentSelected,
      activate: false,
    };
  }

  return {
    selected: clickedIndex,
    activate: currentSelected === clickedIndex,
  };
}

export function getPlaybackOffset(selected: number, length: number): number | undefined {
  if (length <= 0) return undefined;
  return Math.max(0, Math.min(selected, length - 1));
}

export function filterItemsFromQuery<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...items];

  const terms = trimmed.split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const haystack = getText(item).toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
