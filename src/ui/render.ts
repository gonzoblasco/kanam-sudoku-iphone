/**
 * Render the Sudoku board from pre-computed CellView objects.
 *
 * This module follows `docs/architecture.md` §3.12: it computes nothing, it
 * only puts the values it is given into the DOM.
 *
 * The board is row-major: index 0..8 is the first row, 9..17 the second one.
 * Every cell is appended to the row container of `view.row`, and the row
 * containers are laid out as horizontal rows by `styles.css`. Appending cells
 * to a row while the container stacks them vertically renders a transposed
 * board: the puzzle looks scrambled even though the data is right.
 */
import { hasDigit } from '../core/mask.ts';

export interface CellView {
  index: number;
  value: number;
  given: boolean;
  selected: boolean;
  conflict: boolean;
  highlight: "row" | "column" | "block" | "same" | null;
  /** The candidate mask of the cell (0 = no notes). */
  notes: number;
  row: number;
  column: number;
  block: number;
}

/**
 * The digits marked as notes in a cell, in ascending order.
 *
 * The mask uses the engine's convention (`bit (d-1)`), so the digit `d` sits
 * in bit `d - 1`.
 */
export const noteDigits = (mask: number): number[] => {
  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if (hasDigit(mask, d)) digits.push(d);
  }
  return digits;
};

/**
 * Draw the classic 3x3 pencil-mark grid of a cell.
 *
 * The grid is `aria-hidden`: the candidates are already in the cell's
 * accessible name, and announcing them twice is noise for a screen reader.
 */
const renderNoteGrid = (cell: HTMLElement, mask: number): void => {
  const grid = document.createElement("div");
  grid.className = "note-grid";
  grid.setAttribute("aria-hidden", "true");
  const digits = noteDigits(mask);
  for (let position = 1; position <= 9; position++) {
    const slot = document.createElement("span");
    slot.className = "note-slot";
    slot.dataset.position = String(position);
    const digit = digits.find((d) => d === position);
    if (digit !== undefined) slot.textContent = String(digit);
    grid.appendChild(slot);
  }
  cell.appendChild(grid);
};

/** Render the board into the provided container. */
export function renderBoard(container: HTMLElement, views: CellView[]): void {
  container.innerHTML = "";
  container.setAttribute("role", "grid");
  container.setAttribute("aria-label", "Tablero de sudoku");
  // Roving tabindex: the grid is one tab stop. The selected cell (or the first
  // one when nothing is selected) is the only tabbable cell, and the arrow keys
  // move the selection from there (the WAI-ARIA grid pattern).
  const hasSelection = views.some((view) => view.selected);

  // Create row containers (role="row"), one per board row.
  const rows: HTMLElement[] = [];
  for (let r = 0; r < 9; r++) {
    const rowDiv = document.createElement("div");
    rowDiv.setAttribute("role", "row");
    rowDiv.classList.add("board-row");
    rows.push(rowDiv);
    container.appendChild(rowDiv);
  }

  for (const view of views) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.setAttribute("role", "gridcell");
    const notes = noteDigits(view.notes);
    const notesText =
      notes.length > 0 ? `, anotaciones ${notes.join(", ")}` : "";
    cell.setAttribute(
      "aria-label",
      `Fila ${view.row + 1}, columna ${view.column + 1}${
        view.value ? `, ${view.value}` : ""
      }${notesText}`
    );
    // A state attribute is only present when the state holds: an empty,
    // unselected cell carries no `data-*` state at all (SPEC-003 RF-11).
    if (view.given) cell.dataset.given = "true";
    if (view.selected) cell.dataset.selected = "true";
    if (view.conflict) cell.dataset.conflict = "true";
    if (view.highlight) {
      cell.dataset.highlight = view.highlight;
    }
    cell.dataset.index = String(view.index);
    cell.dataset.row = String(view.row);
    cell.dataset.col = String(view.column);
    cell.dataset.block = String(view.block);
    cell.tabIndex = view.selected || (!hasSelection && view.index === 0) ? 0 : -1;
    // The value and the notes are different things and live in different
    // elements: the value of a cell and the candidates marked on it are not
    // the same information, and a cell that shows one must not look like it
    // shows the other.
    if (view.value !== 0) {
      const value = document.createElement('span');
      value.className = 'cell-value';
      value.textContent = String(view.value);
      cell.appendChild(value);
    } else if (view.notes !== 0) {
      // A filled cell shows its value and hides its notes; the notes come
      // back when the value is cleared.
      renderNoteGrid(cell, view.notes);
    }
    // Row-major placement: a cell belongs to the container of its own row.
    rows[view.row].appendChild(cell);
  }
}
