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
export interface CellView {
  index: number;
  value: number;
  given: boolean;
  selected: boolean;
  conflict: boolean;
  highlight: "row" | "column" | "block" | "same" | null;
  row: number;
  column: number;
  block: number;
}

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
    cell.setAttribute(
      "aria-label",
      `Fila ${view.row + 1}, columna ${view.column + 1}${view.value ? ", " + view.value : ""}`
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
    if (view.value !== 0) {
      cell.textContent = String(view.value);
    }
    // Row-major placement: a cell belongs to the container of its own row.
    rows[view.row].appendChild(cell);
  }
}
