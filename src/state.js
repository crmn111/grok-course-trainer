import {
  applyStudyDay,
  freshProgress,
  localISODate,
  passed,
  percent,
  rateCard,
  sanitizeProgress,
} from "./logic.js";

export const PROGRESS_KEY = "grok-course-trainer-v1";

const GAME_SCALE = { match: 0.1, which: 6, scenarios: 8, swap: 5 };

let progress = freshProgress();
let saveWarning = "";

function load() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return freshProgress();
    return sanitizeProgress(JSON.parse(raw));
  } catch {
    saveWarning = "Saved progress on this device could not be read. You can import a backup file.";
    return freshProgress();
  }
}

function save() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    saveWarning = "";
  } catch {
    saveWarning = "Progress could not be saved in this browser. Export a backup before you leave.";
  }
}

function noteStudy() {
  const day = applyStudyDay(progress, localISODate());
  progress.lastStudyDate = day.lastStudyDate;
  progress.streak = day.streak;
  progress.xp += day.xpGained;
  return day.xpGained;
}

function lessonState(lessonNumber) {
  const key = String(lessonNumber);
  if (!progress.lessons[key]) {
    progress.lessons[key] = { done: false, bestQuiz: null, attempts: 0, rewarded: false };
  }
  return progress.lessons[key];
}

export function init() {
  progress = load();
}

export function get() {
  return progress;
}

export function warning() {
  return saveWarning;
}

export function rate(id, rating) {
  const rated = rateCard(progress.cards[id], rating);
  progress.cards[id] = { knows: rated.knows, lapses: rated.lapses, mastered: rated.mastered };
  const day = noteStudy();
  progress.xp += rated.xp;
  save();
  return { ...rated, xpGained: rated.xp + day };
}

export function toggleLesson(lessonNumber) {
  const lesson = lessonState(lessonNumber);
  lesson.done = !lesson.done;
  let bonus = 0;
  if (lesson.done && !lesson.rewarded) {
    bonus = 40;
    lesson.rewarded = true;
    progress.xp += bonus;
  }
  const day = noteStudy();
  save();
  return { done: lesson.done, xpGained: bonus + day };
}

export function recordQuiz(lessonNumber, correct, total) {
  const lesson = lessonState(lessonNumber);
  const pct = percent(correct, total);
  let xp = 0;
  if (lesson.bestQuiz == null || pct > lesson.bestQuiz) {
    const base = lesson.bestQuiz == null ? 0 : lesson.bestQuiz;
    xp += pct - base;
    lesson.bestQuiz = pct;
  }
  lesson.attempts += 1;
  const pass = passed(correct, total);
  const newlyDone = Boolean(pass && !lesson.done);
  if (pass) lesson.done = true;
  if (lesson.done && !lesson.rewarded) {
    xp += 40;
    lesson.rewarded = true;
  }
  const day = noteStudy();
  progress.xp += xp;
  save();
  return { pct, best: lesson.bestQuiz, pass, newlyDone, xpGained: xp + day, attempts: lesson.attempts };
}

export function recordExam(correct, total) {
  const pct = percent(correct, total);
  let xp = 0;
  if (progress.exam.best == null || pct > progress.exam.best) {
    const base = progress.exam.best == null ? 0 : progress.exam.best;
    xp += (pct - base) * 2;
    progress.exam.best = pct;
  }
  progress.exam.attempts += 1;
  const pass = passed(correct, total);
  if (pass) progress.exam.passed = true;
  if (pass && !progress.exam.rewarded) {
    xp += 100;
    progress.exam.rewarded = true;
  }
  const day = noteStudy();
  progress.xp += xp;
  save();
  return { pct, best: progress.exam.best, pass, passed: progress.exam.passed, xpGained: xp + day };
}

export function recordGame(name, score) {
  const game = progress.games[name];
  const previous = game.best;
  const gained = Math.round(Math.max(0, score - previous) * GAME_SCALE[name]);
  if (score > game.best) game.best = score;
  game.plays += 1;
  const day = noteStudy();
  progress.xp += gained;
  save();
  return { best: game.best, plays: game.plays, xpGained: gained + day, improved: score > previous };
}

export function exportPayload() {
  return {
    app: "grok-course-trainer",
    version: 1,
    exportedAt: new Date().toISOString(),
    progress,
  };
}

export function replaceProgress(data) {
  progress = sanitizeProgress(data);
  save();
}

export function resetProgress() {
  progress = freshProgress();
  save();
}
