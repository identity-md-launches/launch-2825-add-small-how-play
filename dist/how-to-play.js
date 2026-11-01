// @ts-check
// This module owns the introduction only; the game runtime stays unchanged.
const seenKey = 'wheel-merge:how-to-play:seen';

function setupHelp() {
  const trigger = document.getElementById('howToPlay');
  const dialog = document.getElementById('playHelp');
  const close = document.getElementById('closePlayHelp');
  if (!(trigger instanceof HTMLButtonElement)
      || !(dialog instanceof HTMLDialogElement)
      || !(close instanceof HTMLButtonElement)) return;

  function hasSeenHelp() {
    try {
      if (localStorage.getItem(seenKey) === '1') return true;
    } catch { /* Storage can be unavailable in private or restricted browsers. */ }
    try {
      return sessionStorage.getItem(seenKey) === '1';
    } catch { return false; }
  }

  function rememberHelp() {
    try { localStorage.setItem(seenKey, '1'); } catch { /* Keep help usable. */ }
    try { sessionStorage.setItem(seenKey, '1'); } catch { /* In-memory only. */ }
  }

  const openHelp = () => {
    if (dialog.open) return;
    dialog.showModal();
    rememberHelp();
  };

  trigger.addEventListener('click', openHelp);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));

  // Modal background inertness blocks pointer input. Keep game shortcuts from
  // receiving keys too, even if focus is moved to the dialog's text by a browser.
  window.addEventListener('keydown', (event) => {
    if (!dialog.open) return;
    event.stopImmediatePropagation();
    if (event.key === 'Tab') {
      // Close is the dialog's only interactive control.
      event.preventDefault();
      close.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  }, { capture: true });

  if (!hasSeenHelp()) openHelp();
}

setupHelp();
