/**
 * Initialise the start menu UI.
 * Shows three difficulty buttons and a "Continuar" button if a saved game exists.
 */
export function initMenu(
  ui: { menuContainer: HTMLElement },
  onStart: (difficulty: "facil" | "medio" | "dificil") => void
): void {
  const container = ui.menuContainer;
  container.innerHTML = "";
  const title = document.createElement("h1");
  title.textContent = "Kanam Sudoku";
  container.appendChild(title);
  const difficulties: Array<[string, "facil" | "medio" | "dificil"]> = [
    ["Fácil", "facil"],
    ["Medio", "medio"],
    ["Difícil", "dificil"],
  ];
  difficulties.forEach(([label, diff]) => {
    const btn = document.createElement("button");
    btn.className = "menu-button";
    btn.textContent = label;
    btn.dataset.action = diff;
    btn.addEventListener("click", () => onStart(diff));
    container.appendChild(btn);
  });
  // Continuar button – enabled later if saved state present.
  const contBtn = document.createElement("button");
  contBtn.className = "menu-button";
  contBtn.textContent = "Continuar";
  contBtn.dataset.action = "continue";
  // Disabled state will be toggled by the app when a saved game exists.
  contBtn.disabled = true;
  container.appendChild(contBtn);
}

