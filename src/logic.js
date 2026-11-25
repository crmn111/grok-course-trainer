export function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function prevISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localISODate(dt);
}

export function effectiveStreak(progress, today) {
  if (!progress.lastStudyDate) return 0;
  if (progress.lastStudyDate === today) return progress.streak;
  if (progress.lastStudyDate === prevISODate(today)) return progress.streak;
  return 0;
}

export function applyStudyDay(progress, today) {
  if (progress.lastStudyDate === today) {
    return { lastStudyDate: today, streak: progress.streak, xpGained: 0 };
  }
  const continued = progress.lastStudyDate === prevISODate(today);
  return {
    lastStudyDate: today,
    streak: continued ? progress.streak + 1 : 1,
    xpGained: 15,
  };
}

export const PASS_RATIO = 0.8;

export function percent(correct, total) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

export function passed(correct, total) {
  return total > 0 && correct / total >= PASS_RATIO;
}

export function shuffle(list, rng = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function optionsFor(question, rng = Math.random) {
  return shuffle(
    [
      { text: question.correct, correct: true },
      ...question.wrong.map((text) => ({ text, correct: false })),
    ],
    rng,
  );
}

export function rateCard(card, rating) {
  const current = {
    knows: card?.knows ?? 0,
    lapses: card?.lapses ?? 0,
    mastered: Boolean(card?.mastered),
  };
  if (rating === "again") {
    return { knows: 0, lapses: current.lapses + 1, mastered: false, xp: 0, justMastered: false };
  }
  if (rating === "know") {
    if (current.mastered) return { ...current, xp: 0, justMastered: false };
    const knows = current.knows + 1;
    const mastered = knows >= 2;
    return {
      knows,
      lapses: current.lapses,
      mastered,
      xp: mastered ? 28 : 8,
      justMastered: mastered,
    };
  }
  throw new Error("Unknown rating");
}

export function weakness(card) {
  const knows = card?.knows ?? 0;
  const lapses = card?.lapses ?? 0;
  const mastered = card?.mastered ? 1 : 0;
  return mastered * 100 + knows * 10 - Math.min(lapses, 9);
}

export function weakestFirst(cards, limit) {
  return [...cards]
    .sort((a, b) => {
      const delta = weakness(a.state) - weakness(b.state);
      if (delta) return delta;
      if (a.lesson !== b.lesson) return a.lesson - b.lesson;
      return a.index - b.index;
    })
    .slice(0, limit);
}

export function bury(queue, gap = 2) {
  if (queue.length <= 1) return queue;
  const [card] = queue.splice(0, 1);
  const at = Math.min(queue.length, gap);
  queue.splice(at, 0, card);
  return queue;
}

export function levelFor(xp) {
  const span = 120;
  const safe = Math.max(0, Math.floor(xp));
  return {
    level: Math.floor(safe / span) + 1,
    into: safe % span,
    span,
    remaining: span - (safe % span),
  };
}

export function matchScore(seconds, misses, pairs) {
  return Math.max(0, pairs * 200 - seconds * 6 - misses * 50);
}

export function clock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function clampInt(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function freshProgress() {
  return {
    version: 1,
    xp: 0,
    streak: 0,
    lastStudyDate: null,
    lessons: {},
    cards: {},
    exam: { best: null, attempts: 0, passed: false, rewarded: false },
    games: {
      match: { best: 0, plays: 0 },
      which: { best: 0, plays: 0 },
      scenarios: { best: 0, plays: 0 },
      swap: { best: 0, plays: 0 },
    },
  };
}

export function sanitizeProgress(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("That file does not contain progress data. Choose a JSON export from this app.");
  }
  if (input.app && input.app !== "grok-course-trainer") {
    throw new Error("That file is not a Grok course trainer export.");
  }
  const src = input.progress && typeof input.progress === "object" ? input.progress : input;
  if (typeof src.xp !== "number" || !Number.isFinite(src.xp)) {
    throw new Error("That file has no usable XP value. Export again from the other device.");
  }
  const next = freshProgress();
  next.xp = clampInt(src.xp, 0, 2_000_000, 0);
  next.streak = clampInt(src.streak, 0, 100_000, 0);
  next.lastStudyDate = typeof src.lastStudyDate === "string" && DATE.test(src.lastStudyDate)
    ? src.lastStudyDate
    : null;

  if (src.lessons && typeof src.lessons === "object") {
    for (const [key, value] of Object.entries(src.lessons)) {
      if (!/^\d{1,3}$/.test(key) || !value || typeof value !== "object") continue;
      const best = value.bestQuiz;
      next.lessons[key] = {
        done: Boolean(value.done),
        bestQuiz: typeof best === "number" && Number.isFinite(best) ? clampInt(best, 0, 100, 0) : null,
        attempts: clampInt(value.attempts, 0, 100_000, 0),
        rewarded: Boolean(value.rewarded),
      };
    }
  }

  if (src.cards && typeof src.cards === "object") {
    for (const [key, value] of Object.entries(src.cards)) {
      if (!/^\d{1,3}-\d{1,3}$/.test(key) || !value || typeof value !== "object") continue;
      const knows = clampInt(value.knows, 0, 2, 0);
      next.cards[key] = {
        knows,
        lapses: clampInt(value.lapses, 0, 100_000, 0),
        mastered: Boolean(value.mastered) && knows >= 2,
      };
    }
  }

  const exam = src.exam && typeof src.exam === "object" ? src.exam : {};
  next.exam = {
    best: typeof exam.best === "number" && Number.isFinite(exam.best) ? clampInt(exam.best, 0, 100, 0) : null,
    attempts: clampInt(exam.attempts, 0, 100_000, 0),
    passed: Boolean(exam.passed),
    rewarded: Boolean(exam.rewarded),
  };

  const games = src.games && typeof src.games === "object" ? src.games : {};
  for (const name of Object.keys(next.games)) {
    const game = games[name] && typeof games[name] === "object" ? games[name] : {};
    next.games[name] = {
      best: clampInt(game.best, 0, 1_000_000, 0),
      plays: clampInt(game.plays, 0, 100_000, 0),
    };
  }
  return next;
}
