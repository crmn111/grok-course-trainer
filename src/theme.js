function meta() {
  return document.querySelector('meta[name="color-scheme"]');
}

export function systemScheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function renderedScheme() {
  const content = meta()?.content;
  if (content === "dark" || content === "light") return content;
  return systemScheme();
}

function persist(mode) {
  try {
    if (mode === "light" || mode === "dark") localStorage.setItem("color-scheme", mode);
    else localStorage.removeItem("color-scheme");
  } catch {
    /* Storage can be blocked. The meta tag still updates this tab. */
  }
}

export function syncThemeColor() {
  const el = document.getElementById("theme-color");
  if (el) el.content = renderedScheme() === "dark" ? "#101618" : "#e4eeef";
}

export function syncSchemeRadios() {
  const content = meta()?.content;
  const mode = content === "light" || content === "dark" ? content : "system";
  document.querySelectorAll('input[name="scheme"]').forEach((input) => {
    input.checked = input.value === mode;
  });
}

export function applyScheme(mode) {
  const element = meta();
  if (!element) return;
  if (mode === "light" || mode === "dark") {
    persist(mode);
    element.content = mode;
  } else {
    persist("system");
    element.content = "light dark";
  }
  syncThemeColor();
  syncSchemeRadios();
}

export function toggleScheme() {
  const target = renderedScheme() === "dark" ? "light" : "dark";
  applyScheme(target === systemScheme() ? "system" : target);
}

export function initTheme() {
  document.getElementById("theme-toggle")?.addEventListener("click", toggleScheme);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    syncThemeColor();
  });
  syncThemeColor();
}
