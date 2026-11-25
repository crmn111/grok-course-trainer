export function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

const PATHS = {
  book: '<path d="M5 5.2A2.2 2.2 0 0 1 7.2 3H19v15.2H7.2A2.2 2.2 0 0 0 5 20.4z"/><path d="M5 5.2A2.2 2.2 0 0 1 7.2 7.4H19"/>',
  cards: '<rect x="7" y="6" width="12" height="14" rx="2"/><path d="M5 16.5V5.8A1.8 1.8 0 0 1 6.8 4H16"/>',
  quiz: '<circle cx="12" cy="12" r="8"/><path d="M8.6 12.2 11 14.6 15.6 9.6"/>',
  play: '<circle cx="12" cy="12" r="8"/><path d="M10.2 9.2v5.6l5-2.8z" fill="currentColor" stroke="none"/>',
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15.2 11.2 11l2.6 2.4L18 8"/>',
  sun: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.6v1.8M12 18.6v1.8M3.6 12h1.8M18.6 12h1.8M6.1 6.1l1.3 1.3M16.6 16.6l1.3 1.3M17.9 6.1l-1.3 1.3M7.4 16.6l-1.3 1.3"/>',
  moon: '<path d="M15.2 3.6a7.2 7.2 0 1 0 4.6 11.6A6 6 0 0 1 15.2 3.6z"/>',
  check: '<path d="M5 12.4 9.2 16.6 19 7.2"/>',
};

export function icon(name) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ""}</svg>`;
}
