import "@fontsource/bricolage-grotesque/latin-400.css";
import "@fontsource/bricolage-grotesque/latin-600.css";
import "@fontsource/bricolage-grotesque/latin-700.css";
import "@fontsource/literata/latin-400.css";
import "@fontsource/literata/latin-600.css";
import "./styles.css";
import { setRenderer } from "./bus.js";
import { updateChrome } from "./chrome.js";
import { PROGRESS_KEY, init } from "./state.js";
import { initTheme, syncSchemeRadios, syncThemeColor } from "./theme.js";
import { afterPaint, enter, onAction, pageTitle, render } from "./views.js";

const view = document.getElementById("view");
let route = { section: "", id: null };

function parseRoute() {
  const parts = (location.hash.replace(/^#/, "") || "/lessons").split("/").filter(Boolean);
  return { section: parts[0] || "lessons", id: parts[1] || null };
}

function show(options = {}, routeChanged = false) {
  view.innerHTML = render(route);
  afterPaint(view);
  updateChrome();
  const section = route.section === "lessons" || route.section === "cards" || route.section === "quiz" || route.section === "play" || route.section === "progress"
    ? route.section
    : "lessons";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === section) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = `${pageTitle(route)} · Grok course`;
  if (options.focus) {
    const target = view.querySelector(options.focus);
    if (target) {
      if (!target.hasAttribute("tabindex") && !target.matches("a, button, input, select, textarea")) {
        target.tabIndex = -1;
      }
      target.focus();
    }
    return;
  }
  if (routeChanged) {
    window.scrollTo(0, 0);
    view.focus();
  }
}

function sync() {
  const next = parseRoute();
  const changed = next.section !== route.section || next.id !== route.id;
  route = next;
  if (changed) enter(route);
  show({}, changed);
}

setRenderer((options) => show(options, false));

view.addEventListener("click", (event) => {
  const element = event.target.closest("[data-action]");
  if (!element || !view.contains(element)) return;
  if (element.disabled || element.getAttribute("aria-disabled") === "true") return;
  onAction(element.dataset.action, element);
});

view.addEventListener("change", (event) => {
  const element = event.target.closest("[data-action]");
  if (!element || !view.contains(element)) return;
  onAction(element.dataset.action, element);
});

view.addEventListener("error", (event) => {
  if (event.target instanceof HTMLImageElement) event.target.closest(".video")?.classList.add("no-thumb");
}, true);

window.addEventListener("hashchange", sync);
window.addEventListener("storage", (event) => {
  if (event.key === "color-scheme") {
    const scheme = document.querySelector('meta[name="color-scheme"]');
    scheme.content = event.newValue === "light" || event.newValue === "dark" ? event.newValue : "light dark";
    syncThemeColor();
    syncSchemeRadios();
  }
  if (event.key === PROGRESS_KEY) {
    init();
    show({}, false);
  }
});

init();
initTheme();
sync();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
}
