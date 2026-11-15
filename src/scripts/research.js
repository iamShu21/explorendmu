// Entry for the research page and the 404 page: the same gradient, header and quiet reveals, without the tour.
import { ScrollTrigger, $, $$, boot, initHeadlines, initReveals, initPointer, initHeader } from './core.js';
import { initGradient } from './gradient.js';

initHeader();

// figures open in a dialog
const dialog = $('[data-lightbox-dialog]'), big = $('[data-lightbox-img]');
$$('[data-lightbox]').forEach((b) => b.addEventListener('click', () => {
  big.src = b.dataset.lightbox; big.alt = b.dataset.lightboxAlt;
  dialog.showModal?.();
}));
dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

// copy the citation
const copy = $('[data-copy-cite]');
copy?.addEventListener('click', async () => {
  const label = $('span', copy);
  try { await navigator.clipboard.writeText($('[data-cite]').textContent.trim()); label.textContent = 'Copied'; }
  catch { label.textContent = 'Select the text to copy it'; }
  setTimeout(() => (label.textContent = 'Copy citation'), 2200);
});

// The animation engine and the gradient start after the first paint, as on the main page.
requestAnimationFrame(() => setTimeout(() => {
  boot();
  initGradient()?.bloom(0);
  initHeadlines();
  initReveals();
  initPointer();
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}, 0));
