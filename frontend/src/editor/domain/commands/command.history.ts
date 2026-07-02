/**
 * Command history — deterministic undo/redo stack.
 * Stores state snapshots (copy-on-write) for reliable rollback.
 *
 * Location: frontend/src/editor/domain/commands/command.history.ts
 */

import type { MapItem } from "@jagres/shared";

const MAX_HISTORY = 50;

export interface HistoryState {
    stack: readonly MapItem[][];
    index: number; // points to current state in stack
}

export function createHistory(initial: readonly MapItem[]): HistoryState {
    return {
        stack: [[...initial]],
        index: 0,
    };
}

export function pushHistory(
    state: HistoryState,
    newItems: readonly MapItem[],
): HistoryState {
    const nextStack = state.stack.slice(0, state.index + 1);
    nextStack.push([...newItems]);
    if (nextStack.length > MAX_HISTORY) {
        nextStack.shift();
    }
    return {
        stack: nextStack,
        index: nextStack.length - 1,
    };
}

export function undoHistory(state: HistoryState): {
    items: readonly MapItem[];
    history: HistoryState;
} | null {
    if (state.index <= 0) return null;
    const newIndex = state.index - 1;
    return {
        items: state.stack[newIndex],
        history: { stack: state.stack, index: newIndex },
    };
}

export function redoHistory(state: HistoryState): {
    items: readonly MapItem[];
    history: HistoryState;
} | null {
    if (state.index >= state.stack.length - 1) return null;
    const newIndex = state.index + 1;
    return {
        items: state.stack[newIndex],
        history: { stack: state.stack, index: newIndex },
    };
}
