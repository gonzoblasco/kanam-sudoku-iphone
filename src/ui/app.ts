/**
 * UI application state machine: menu | generating | playing | victory.
 *
 * This module wires the DOM to the pure layers. It calculates nothing about
 * the game: conflicts come from the core validator, the level from the
 * generator, and the board state from the state layer. What it owns is the
 * phase of the app and the events that move it.
 */
import {
  createGameState,
  clearValue,
  selectCell,
  setValue,
  type GameState,
} from '../state/state.ts';
import { generatePuzzle } from '../core/generator.ts';
import type { Difficulty } from '../core/rater.ts';
import {
  clearSaved,
  load,
  loadPrefs,
  save,
  savePrefs,
  type Prefs,
  type Storage,
} from '../state/persistence.ts';
import { createTimer } from '../state/timer.ts';
import { conflictCells, isSolved } from '../core/validator.ts';
import { rowOf, colOf, blockOf } from '../core/geometry.ts';
import type { Cell } from '../core/grid.ts';
import { renderBoard } from './render.ts';
import { initKeypad } from './keypad.ts';
import { initMenu, setContinueLabel } from './menu.ts';
import { initVictory } from './victory.ts';

type Phase = 'menu' | 'generating' | 'playing' | 'victory';

interface UI {
  root: HTMLElement;
  boardContainer: HTMLElement;
  keypadContainer: HTMLElement;
  menuContainer: HTMLElement;
  victoryContainer: HTMLElement;
  statusMessage: HTMLElement;
  liveRegion: HTMLElement;
}

/** Initialise the UI inside the given root element. */
export function initApp(root: HTMLElement): void {
  const ui = buildUI(root);
  const storage: Storage = window.localStorage;

  const loaded = load(storage);
  const prefs: Prefs = loadPrefs(storage);
  let state: GameState = loaded.state ?? createGameState(new Array(81).fill(0) as never);
  let phase: Phase = 'menu';
  // The level of the game in play. A restored game has no level in its payload,
  // so the last level used is taken from the prefs key (its documented purpose)
  // and used for "Jugar de nuevo". `null` means "unknown": an old payload may
  // predate the prefs, and labelling it with a guess would be a lie.
  let knownDifficulty: Difficulty | null = prefs.lastDifficulty;
  let currentDifficulty: Difficulty = knownDifficulty ?? 'facil';
  let hasSavedGame = loaded.state !== null && state.givens.length > 0;

  // The timer starts with the effective time already played. Restoring a game
  // must not reset the clock to zero. It is paused until the player writes.
  let timer = createTimer(() => Date.now(), state.elapsedMs);

  if (loaded.recovered) {
    ui.statusMessage.textContent =
      'No se pudo recuperar la partida guardada. Se empieza una nueva.';
  }

  const announce = (message: string): void => {
    ui.liveRegion.textContent = message;
  };

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /**
   * Show the given screens and hide the rest.
   *
   * Several screens are visible at once: the board and the keypad belong to the
   * same phase, so hiding "everything else" one screen at a time would hide the
   * board as soon as the keypad was shown.
   */
  const showOnly = (...visible: Array<keyof UI>): void => {
    ui.menuContainer.classList.toggle('hidden', !visible.includes('menuContainer'));
    ui.boardContainer.classList.toggle('hidden', !visible.includes('boardContainer'));
    ui.keypadContainer.classList.toggle('hidden', !visible.includes('keypadContainer'));
    ui.victoryContainer.classList.toggle('hidden', !visible.includes('victoryContainer'));
  };

  const renderMenu = (): void => {
    phase = 'menu';
    showOnly('menuContainer');
    // "Continuar" carries the level of the saved game (spec-006 RF-11): the
    // payload has no level field, so the last level used is the honest label.
    setContinueLabel(ui, hasSavedGame ? knownDifficulty : null);
    const contBtn = ui.menuContainer.querySelector(
      "button[data-action='continue']",
    ) as HTMLButtonElement | null;
    if (contBtn) contBtn.disabled = !hasSavedGame;
  };

  const renderPlaying = (): void => {
    phase = 'playing';
    showOnly('boardContainer', 'keypadContainer');

    const conflictSet = new Set(conflictCells(state.grid));
    const selected = state.selected;
    const selectedRow = selected === null ? -1 : rowOf(selected);
    const selectedCol = selected === null ? -1 : colOf(selected);
    const selectedBlock = selected === null ? -1 : blockOf(selected);
    const selectedValue = selected === null ? 0 : state.grid[selected];

    // Highlight precedence is fixed in one place: same > block > column > row
    // (docs/data-model.md §1.7). A cell carries ONE `data-highlight` value.
    const views = state.grid.map((value, index) => {
      let highlight: 'row' | 'column' | 'block' | 'same' | null = null;
      if (selected !== null && index !== selected) {
        if (selectedValue !== 0 && value === selectedValue) highlight = 'same';
        else if (blockOf(index) === selectedBlock) highlight = 'block';
        else if (colOf(index) === selectedCol) highlight = 'column';
        else if (rowOf(index) === selectedRow) highlight = 'row';
      }
      return {
        index,
        value,
        given: state.givens.includes(index),
        selected: index === selected,
        conflict: conflictSet.has(index),
        highlight,
        row: rowOf(index),
        column: colOf(index),
        block: blockOf(index),
      };
    });

    renderBoard(ui.boardContainer, views);

    ui.boardContainer.querySelectorAll<HTMLElement>('.cell').forEach((cell) => {
      const index = Number(cell.dataset.index);
      const select = (): void => {
        state = selectCell(state, index);
        save(state, storage);
        renderPlaying();
        announceCell(index);
        // Keep the focus on the cell the player just chose: without this, the
        // re-render replaces the node and the keyboard focus falls to <body>.
        ui.boardContainer
          .querySelector<HTMLElement>(`.cell[data-index="${index}"]`)
          ?.focus({ preventScroll: true });
      };
      cell.addEventListener('click', select);
      cell.addEventListener('keydown', (event) => selectOnKey(event, index, select));
    });
  };

  /**
   * Keyboard navigation on the board.
   *
   * SPEC-003 §No-objetivo allows keyboard support for accessibility even though
   * the keypad is the primary input, and the BRIEF promises a keyboard-navigable
   * grid. The arrows move the selection, Enter/Space selects, and the digits
   * write through the same `handleDigit` path as the keypad: no second write
   * path, no second set of rules.
   */
  const selectOnKey = (event: KeyboardEvent, index: number, select: () => void): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select();
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      state = selectCell(state, index);
      handleDigit(Number(event.key));
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      state = selectCell(state, index);
      handleDigit(0);
      return;
    }
    const deltas: Record<string, number> = {
      ArrowUp: -9,
      ArrowDown: 9,
      ArrowLeft: -1,
      ArrowRight: 1,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const row = rowOf(index);
    const target =
      (event.key === 'ArrowLeft' && colOf(index) === 0) ||
      (event.key === 'ArrowRight' && colOf(index) === 8) ||
      (event.key === 'ArrowUp' && row === 0) ||
      (event.key === 'ArrowDown' && row === 8)
        ? index
        : index + delta;
    state = selectCell(state, target);
    save(state, storage);
    renderPlaying();
    announceCell(target);
    ui.boardContainer
      .querySelector<HTMLElement>(`.cell[data-index="${target}"]`)
      ?.focus({ preventScroll: true });
  };

  const announceCell = (index: number): void => {
    const row = rowOf(index) + 1;
    const col = colOf(index) + 1;
    const value = state.grid[index];
    announce(
      value === 0 ? `Fila ${row}, columna ${col}: vacía` : `Fila ${row}, columna ${col}: ${value}`,
    );
  };

  const renderVictory = (): void => {
    phase = 'victory';
    showOnly('victoryContainer');
    const timeEl = ui.victoryContainer.querySelector('.time');
    if (timeEl) {
      timeEl.textContent = `Tiempo: ${Math.round(timer.elapsedMs() / 1000)} s`;
    }
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Forget the game in progress: it is over, won or abandoned. */
  const endGame = (): void => {
    clearSaved(storage);
    hasSavedGame = false;
  };

  const startGeneration = (difficulty: Difficulty): void => {
    currentDifficulty = difficulty;
    knownDifficulty = difficulty;
    phase = 'generating';
    ui.statusMessage.textContent = 'Generando...';
    showOnly('menuContainer');
    const buttons = ui.menuContainer.querySelectorAll('button');
    buttons.forEach((b) => ((b as HTMLButtonElement).disabled = true));

    // The generator is synchronous and can take a moment: yield first so the
    // "Generando..." state is actually painted.
    window.setTimeout(() => {
      let result;
      try {
        result = generatePuzzle(difficulty, { seed: Date.now() >>> 0 });
      } catch {
        buttons.forEach((b) => ((b as HTMLButtonElement).disabled = false));
        ui.statusMessage.textContent =
          'No se pudo generar el puzzle. Probá de nuevo o elegí otro nivel.';
        phase = 'menu';
        showOnly('menuContainer');
        return;
      }
      buttons.forEach((b) => ((b as HTMLButtonElement).disabled = false));

      if (!result.matched) {
        // Honest failure: the level was not reached, so it is not shown as if
        // it had been.
        ui.statusMessage.textContent =
          'No se pudo generar un puzzle en el nivel pedido. Probá con otro nivel o intentá de nuevo.';
        phase = 'menu';
        showOnly('menuContainer');
        return;
      }

      savePrefs({ lastDifficulty: difficulty }, storage);
      // A new game replaces the previous one: abandon it explicitly so no stale
      // payload turns into a "Continuar" for a game the player has left.
      endGame();
      state = createGameState(result.puzzle.grid);
      hasSavedGame = true;
      save(state, storage);
      // A new game has a new clock: the previous game's time must not carry
      // over into it.
      timer = createTimer(() => Date.now(), 0);
      timer.start();
      ui.statusMessage.textContent = '';
      renderPlaying();
    }, 0);
  };

  const handleDigit = (digit: number): void => {
    if (phase !== 'playing') return;
    const selected = state.selected;
    if (selected === null) return;

    const next =
      digit === 0
        ? clearValue(state, selected)
        : setValue(state, selected, digit as Cell);

    // A no-op (a given, or the same digit twice) must not restart the clock or
    // re-render the whole board for nothing.
    if (next === state) {
      announceCell(selected);
      return;
    }

    // The clock starts on the first real move, including after a restore.
    timer.resume();
    state = { ...next, elapsedMs: timer.elapsedMs(), paused: false };
    save(state, storage);
    renderPlaying();
    announceCell(selected);

    // Victory requires a COMPLETE board with NO conflicts: a full board with a
    // mistake is not a win.
    if (isSolved(state.grid)) {
      timer.pause();
      state = { ...state, elapsedMs: timer.elapsedMs(), paused: true };
      // The game is over: there is nothing left to continue, and "Jugar de
      // nuevo" must generate, not restore a finished board.
      endGame();
      renderVictory();
    }
  };

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  initMenu(ui, (difficulty) => startGeneration(difficulty));
  initKeypad(ui, (digit) => handleDigit(digit));
  initVictory(
    ui,
    () => startGeneration(currentDifficulty),
    () => {
      endGame();
      state = createGameState(new Array(81).fill(0) as never);
      ui.statusMessage.textContent = '';
      renderMenu();
    },
  );

  const contBtn = ui.menuContainer.querySelector(
    "button[data-action='continue']",
  ) as HTMLButtonElement | null;
  if (contBtn) {
    contBtn.addEventListener('click', () => {
      const restored = load(storage);
      if (!restored.state) {
        hasSavedGame = false;
        renderMenu();
        return;
      }
      state = restored.state;
      hasSavedGame = true;
      // The restored clock starts paused, and keeps the effective time already
      // played: the time the app was closed does not count.
      timer = createTimer(() => Date.now(), state.elapsedMs);
      renderPlaying();
    });
  }

  renderMenu();
}

/** Build the DOM containers the app uses. */
function buildUI(root: HTMLElement): UI {
  const board = document.createElement('div');
  board.id = 'board';
  board.classList.add('hidden');

  const keypad = document.createElement('div');
  keypad.id = 'keypad';
  keypad.classList.add('hidden');

  const menu = document.createElement('div');
  menu.id = 'menu';
  menu.classList.add('screen');

  const victory = document.createElement('div');
  victory.id = 'victory';
  victory.classList.add('screen', 'hidden');

  const status = document.createElement('div');
  status.id = 'status';
  status.setAttribute('role', 'status');

  const live = document.createElement('div');
  live.id = 'live';
  live.classList.add('sr-only');
  live.setAttribute('aria-live', 'polite');

  root.append(menu, board, keypad, victory, live, status);

  return {
    root,
    boardContainer: board,
    keypadContainer: keypad,
    menuContainer: menu,
    victoryContainer: victory,
    statusMessage: status,
    liveRegion: live,
  };
}
