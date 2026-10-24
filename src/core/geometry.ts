/**
 * Geometry utilities for the Sudoku grid.
 *
 * The grid is 81 cells indexed 0..80, row‑major order.
 * Units: 0‑8 rows, 9‑17 columns, 18‑26 blocks.
 * For each cell we compute the three unit IDs it belongs to and its peers
 * (the other 20 cells sharing a unit).
 */

export const CELLS = 81;
export const UNITS = 27; // 9 rows + 9 cols + 9 blocks

/** Convert a cell index to its row (0‑8). */
export const rowOf = (idx: number): number => Math.floor(idx / 9);
/** Convert a cell index to its column (0‑8). */
export const colOf = (idx: number): number => idx % 9;
/** Convert a cell index to its block (0‑8). */
export const blockOf = (idx: number): number => {
  const r = rowOf(idx);
  const c = colOf(idx);
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
};

/** Unit IDs for rows, columns and blocks. */
export const rowUnit = (row: number): number => row; // 0‑8
export const colUnit = (col: number): number => 9 + col; // 9‑17
export const blockUnit = (block: number): number => 18 + block; // 18‑26

/** For each cell the three unit IDs it belongs to: [row, col, block]. */
export const UNITS_OF_CELL: number[][] = (() => {
  const arr: number[][] = new Array(CELLS);
  for (let i = 0; i < CELLS; i++) {
    const r = rowOf(i);
    const c = colOf(i);
    const b = blockOf(i);
    arr[i] = [rowUnit(r), colUnit(c), blockUnit(b)];
  }
  return arr;
})();

/** Cells belonging to each unit (size 27, each an array of 9 indices). */
export const CELLS_OF_UNIT: number[][] = (() => {
  const units: number[][] = Array.from({ length: UNITS }, () => []);
  for (let i = 0; i < CELLS; i++) {
    const [rU, cU, bU] = UNITS_OF_CELL[i];
    units[rU].push(i);
    units[cU].push(i);
    units[bU].push(i);
  }
  return units;
})();

/** Peers for each cell: the union of its unit members, minus itself. */
export const PEERS: number[][] = (() => {
  const peers: number[][] = new Array(CELLS);
  for (let i = 0; i < CELLS; i++) {
    const set = new Set<number>();
    for (const u of UNITS_OF_CELL[i]) {
      for (const cell of CELLS_OF_UNIT[u]) {
        if (cell !== i) set.add(cell);
      }
    }
    peers[i] = Array.from(set);
  }
  return peers;
})();

