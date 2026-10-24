/**
 * Render the Sudoku board based on pre‑computed CellView objects.
 * This file follows the contract in docs/architecture.md §3.12 – it does not
 * compute any logic, only updates the DOM attributes.
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
  // Clear previous board and set up ARIA grid semantics.
  container.innerHTML = "";
  container.setAttribute("role", "grid");
  // Create row containers (role="row").
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
    cell.dataset.given = view.given ? "true" : "false";
    cell.dataset.selected = view.selected ? "true" : "false";
    cell.dataset.conflict = view.conflict ? "true" : "false";
    if (view.highlight) {
      cell.dataset.highlight = view.highlight;
    }
    cell.dataset.index = String(view.index);
    if (view.value !== 0) {
      cell.textContent = String(view.value);
    }
    // Append to the correct row based on view.row.
    rows[view.row].appendChild(cell);
  }
}

