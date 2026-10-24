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
import { clearSaved, load, save, type Storage } from '../state/persistence.ts';
import { createTimer } from '../state/timer.ts';
import { conflictCells, isSolved } from '../core/validator.ts';
import { rowOf, colOf, blockOf } from '../core/geometry.ts';
import type { Cell } from '../core/grid.ts';
import { renderBoard } from './render.ts';
import { initKeypad } from './keypad.ts';
import { initMenu } from './menu.ts';
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
  const timer = createTimer(() => Date.now());

  const loaded = load(storage);
  let state: GameState = loaded.state ?? createGameState(new Array(81).fill(0) as never);
  let phase: Phase = 'menu';
  let currentDifficulty: Difficulty = 'facil';
  /** The puzzle in play, so "Continuar" can rebuild the givens. */
  let currentPuzzle: number[] = Array.from(state.grid);
  let hasSavedGame = loaded.state !== null && state.givens.length > 0;

  if (loaded.recovered) {
    ui.statusMessage.textContent =
      'No se pudo recuperar la partida guardada. Se empieza una nueva.';
  }

  // The timer resumes paused: the time with the app closed does not count.
  timer.start();
  timer.pause();

  const announce = (message: string): void => {
    ui.liveRegion.textContent = message;
  };

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /**
   * Show the given screens and hide the rest.
   *
   * Several screens can be visible at once: the board and the keypad belong
   * to the same phase, so hiding "everything else" one screen at a time would
   * hide the board as soon as the keypad was shown.
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
      cell.addEventListener('click', () => {
        state = selectCell(state, index);
        save(state, storage);
        renderPlaying();
        const row = rowOf(index) + 1;
        const col = colOf(index) + 1;
        const value = state.grid[index];
        announce(
          value === 0
            ? `Fila ${row}, columna ${col}: vacía`
            : `Fila ${row}, columna ${col}: ${value}`,
        );
      });
    });
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

  const startGeneration = (difficulty: Difficulty): void => {
    currentDifficulty = difficulty;
    phase = 'generating';
    ui.statusMessage.textContent = 'Generando...';
    showOnly('menuContainer');
    const buttons = ui.menuContainer.querySelectorAll('button');
    buttons.forEach((b) => ((b as HTMLButtonElement).disabled = true));

    // The generator is synchronous but can take a moment: yield first so the
    // "Generando..." state is actually painted.
    window.setTimeout(() => {
      const result = generatePuzzle(difficulty, { seed: Date.now() >>> 0 });
      buttons.forEach((b) => ((b as HTMLButtonElement).disabled = false));

      if (!result.matched) {
        // Honest failure: the level was not reached, so it is not shown as if
        // it had been.
        ui.statusMessage.textContent =
          'No se pudo generar un puzzle en el nivel pedido. Probá con otro nivel.';
        phase = 'menu';
        showOnly('menuContainer');
        return;
      }

      currentPuzzle = Array.from(result.puzzle);
      state = createGameState(result.puzzle);
      hasSavedGame = true;
      save(state, storage);
      timer.start();
      timer.resume();
      ui.statusMessage.textContent = '';
      renderPlaying();
    }, 0);
  };

  const handleDigit = (digit: number): void => {
    if (phase !== 'playing') return;
    const selected = state.selected;
    if (selected === null) return;

    state =
      digit === 0
        ? clearValue(state, selected)
        : setValue(state, selected, digit as Cell);
    state = { ...state, elapsedMs: timer.elapsedMs() };
    save(state, storage);
    renderPlaying();

    const value = state.grid[selected];
    announce(
      value === 0
        ? `Fila ${rowOf(selected) + 1}, columna ${colOf(selected) + 1}: vacía`
        : `Fila ${rowOf(selected) + 1}, columna ${colOf(selected) + 1}: ${value}`,
    );

    // Victory requires a COMPLETE board with NO conflicts: a full board with
    // a mistake is not a win.
    if (isSolved(state.grid)) {
      state = { ...state, elapsedMs: timer.elapsedMs() };
      save(state, storage);
      timer.pause();
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
      clearSaved(storage);
      hasSavedGame = false;
      state = createGameState(new Array(81).fill(0) as never);
      currentPuzzle = Array.from(state.grid);
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
        renderMenu();
        return;
      }
      state = restored.state;
      hasSavedGame = true;
      timer.start();
      timer.pause();
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

  root.append(menu, board, keypad, victory, status, live);

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
