/**
 * The notes toolbar: notes mode, automatic candidates, clear notes.
 *
 * Three controls, all native buttons:
 *
 *  - "Notas" toggles the notes mode. In that mode the numeric keypad marks
 *    candidates instead of writing values. The button carries `aria-pressed`,
 *    so the state is available to a screen reader and not only to the eye.
 *  - "Auto" writes the automatic candidates of every empty cell.
 *  - "Limpiar" removes every note of the game.
 */
export interface NotesControls {
  container: HTMLElement;
  notesButton: HTMLButtonElement;
  autoButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
}

export function initNotesControls(
  container: HTMLElement,
  handlers: {
    onToggleNotes: () => void;
    onAutoNotes: () => void;
    onClearNotes: () => void;
  },
): NotesControls {
  container.innerHTML = '';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Anotaciones');

  const notesButton = document.createElement('button');
  notesButton.type = 'button';
  notesButton.dataset.action = 'notes-mode';
  notesButton.textContent = 'Notas';
  notesButton.setAttribute('aria-pressed', 'false');
  notesButton.addEventListener('click', () => handlers.onToggleNotes());
  container.appendChild(notesButton);

  const autoButton = document.createElement('button');
  autoButton.type = 'button';
  autoButton.dataset.action = 'auto-notes';
  autoButton.textContent = 'Auto';
  autoButton.setAttribute('aria-label', 'Auto: calcular candidatos');
  autoButton.addEventListener('click', () => handlers.onAutoNotes());
  container.appendChild(autoButton);

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.dataset.action = 'clear-notes';
  clearButton.textContent = 'Limpiar';
  clearButton.setAttribute('aria-label', 'Limpiar anotaciones');
  clearButton.addEventListener('click', () => handlers.onClearNotes());
  container.appendChild(clearButton);

  return { container, notesButton, autoButton, clearButton };
}

/**
 * Reflect the notes mode on the button.
 *
 * The active state is carried by `aria-pressed` AND by a class, so it is not
 * only a colour change.
 */
export function setNotesMode(controls: NotesControls, active: boolean): void {
  controls.notesButton.setAttribute('aria-pressed', active ? 'true' : 'false');
  controls.notesButton.classList.toggle('is-active', active);
  // The label does not change: the inverted fill and `aria-pressed` already say
  // the mode is on, and a button whose text changes under the finger is a
  // button that shifts its own hit area.
  controls.notesButton.textContent = 'Notas';
}
