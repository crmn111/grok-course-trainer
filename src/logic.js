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
      const orderA = a.order ?? a.lesson ?? 0;
      const orderB = b.order ?? b.lesson ?? 0;
      if (orderA !== orderB) return orderA - orderB;
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

const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;
const CARD_ID = /^[A-Za-z0-9_-]{6,20}-\d{1,3}$/;

// Lessons that were already one video, with the same card order, can move across.
export const LEGACY_LESSON_VIDEO = {
  5: "i-7F2EpQOhc",
  6: "lQB3kZZZYss",
  7: "NhrXdX_93Hc",
  8: "FNQkRPR4h2Y",
  15: "VSaeKaC2Tck",
  16: "zupqr-rApp4",
  17: "FFOZAl7wihE",
  18: "jcKcAfJtTlk",
  19: "AdxoMFFmTE0",
  20: "91J3eaBH6no",
  21: "rcwwIEmfcjk",
};

export function freshProgress() {
  return {
    version: 2,
    xp: 0,
    streak: 0,
    lastStudyDate: null,
    videos: {},
    cards: {},
    exam: { best: null, attempts: 0, passed: false, rewarded: false },
    games: {
      match: { best: 0, plays: 0 },
      which: { best: 0, plays: 0 },
      scenarios: { best: 0, plays: 0 },
      swap: { best: 0, plays: 0 },
    },
    migrationNote: "",
  };
}

function videoRecord(value) {
  const best = value?.bestQuiz;
  return {
    done: Boolean(value?.done),
    bestQuiz: typeof best === "number" && Number.isFinite(best) ? clampInt(best, 0, 100, 0) : null,
    attempts: clampInt(value?.attempts, 0, 100_000, 0),
    rewarded: Boolean(value?.rewarded),
  };
}

function cardRecord(value) {
  const knows = clampInt(value?.knows, 0, 2, 0);
  return {
    knows,
    lapses: clampInt(value?.lapses, 0, 100_000, 0),
    mastered: Boolean(value?.mastered) && knows >= 2,
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

  const legacy = src.lessons && typeof src.lessons === "object" && !src.videos;
  if (src.videos && typeof src.videos === "object") {
    for (const [key, value] of Object.entries(src.videos)) {
      if (!VIDEO_ID.test(key) || !value || typeof value !== "object") continue;
      next.videos[key] = videoRecord(value);
    }
  } else if (legacy) {
    for (const [key, value] of Object.entries(src.lessons)) {
      if (!/^\d{1,3}$/.test(key) || !value || typeof value !== "object") continue;
      const videoId = LEGACY_LESSON_VIDEO[Number(key)];
      if (!videoId) continue;
      next.videos[videoId] = videoRecord(value);
    }
  }

  if (src.cards && typeof src.cards === "object") {
    for (const [key, value] of Object.entries(src.cards)) {
      if (!value || typeof value !== "object") continue;
      if (CARD_ID.test(key) && !/^\d{1,3}-\d{1,3}$/.test(key)) {
        next.cards[key] = cardRecord(value);
        continue;
      }
      const old = /^(\d{1,3})-(\d{1,3})$/.exec(key);
      if (!old) continue;
      if (legacy) {
        const videoId = LEGACY_LESSON_VIDEO[Number(old[1])];
        if (!videoId) continue;
        next.cards[`${videoId}-${old[2]}`] = cardRecord(value);
      }
    }
  }

  next.migrationNote = typeof src.migrationNote === "string"
    ? src.migrationNote.slice(0, 500)
    : "";
  if (legacy) {
    next.migrationNote = "Saved lesson progress moved onto the videos that used to be a single lesson, including those cards. Webinars that were split into several lessons started fresh, so one old chapter is not marked done for the whole video.";
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
