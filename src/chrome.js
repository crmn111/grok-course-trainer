import { effectiveStreak, localISODate } from "./logic.js";
import { get } from "./state.js";

export function updateChrome() {
  const streak = effectiveStreak(get(), localISODate());
  const el = document.getElementById("streak");
  if (!el) return;
  el.textContent = streak > 0 ? `${streak}-day streak` : "Start today";
}
