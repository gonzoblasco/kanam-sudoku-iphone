/**
 * Initialise the victory screen.
 *
 * Two actions: "Jugar de nuevo" (same level) and "Elegir otro nivel" (back to
 * the menu). The screen only appears when the board is complete AND free of
 * conflicts.
 */
export function initVictory(
  ui: { victoryContainer: HTMLElement },
  onPlayAgain: () => void,
  onChooseLevel: () => void,
): void {
  const container = ui.victoryContainer;
  container.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = '¡Victoria!';
  container.appendChild(title);

  const timeEl = document.createElement('p');
  timeEl.className = 'time';
  timeEl.textContent = 'Tiempo: --';
  container.appendChild(timeEl);

  const playAgainBtn = document.createElement('button');
  playAgainBtn.type = 'button';
  playAgainBtn.textContent = 'Jugar de nuevo';
  playAgainBtn.dataset.action = 'play-again';
  playAgainBtn.addEventListener('click', onPlayAgain);
  container.appendChild(playAgainBtn);

  const otherBtn = document.createElement('button');
  otherBtn.type = 'button';
  otherBtn.textContent = 'Elegir otro nivel';
  otherBtn.dataset.action = 'choose-level';
  otherBtn.addEventListener('click', onChooseLevel);
  container.appendChild(otherBtn);
}
