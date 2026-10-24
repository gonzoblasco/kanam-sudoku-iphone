/**
 * Initialise the on‑screen numeric keypad (1‑9 + Borrar).
 * The keypad dispatches digit events to the provided handler.
 * The HTML structure follows SPEC‑004 – native <button> elements, role="group".
 */
export function initKeypad(
  ui: { keypadContainer: HTMLElement },
  onDigit: (digit: number) => void
): void {
  // Ensure container is empty.
  const container = ui.keypadContainer;
  container.innerHTML = "";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Teclado de dígitos");

  // Create digit buttons 1‑9.
  for (let d = 1; d <= 9; d++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(d);
    btn.dataset.digit = String(d);
    btn.addEventListener("click", () => onDigit(d));
    container.appendChild(btn);
  }
  // Delete / clear button.
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Borrar";
  clearBtn.dataset.digit = "0";
  clearBtn.setAttribute("aria-label", "Borrar");
  clearBtn.addEventListener("click", () => onDigit(0));
  container.appendChild(clearBtn);
}

