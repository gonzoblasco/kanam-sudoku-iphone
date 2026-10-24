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

/**
 * Label the "Continuar" action with the level of the game in progress.
 *
 * SPEC-006 RF-11 asks for the level next to "Continuar": two games of different
 * levels are otherwise indistinguishable from the menu.
 */
export function setContinueLabel(
  ui: { menuContainer: HTMLElement },
  difficulty: "facil" | "medio" | "dificil" | null,
): void {
  const contBtn = ui.menuContainer.querySelector(
    "button[data-action='continue']",
  ) as HTMLButtonElement | null;
  if (!contBtn) return;
  const labels = { facil: "Fácil", medio: "Medio", dificil: "Difícil" } as const;
  contBtn.textContent = difficulty ? `Continuar (${labels[difficulty]})` : "Continuar";
}

