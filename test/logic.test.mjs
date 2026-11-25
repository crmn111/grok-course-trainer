import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStudyDay,
  bury,
  effectiveStreak,
  freshProgress,
  levelFor,
  matchScore,
  optionsFor,
  passed,
  percent,
  prevISODate,
  rateCard,
  sanitizeProgress,
  weakness,
  weakestFirst,
} from "../src/logic.js";

test("two knows in a row masters a card and Again clears it", () => {
  let card = rateCard(null, "know");
  assert.equal(card.mastered, false);
  assert.equal(card.xp, 8);
  card = rateCard(card, "know");
  assert.equal(card.mastered, true);
  assert.equal(card.knows, 2);
  assert.equal(card.xp, 28);
  const again = rateCard(card, "again");
  assert.equal(again.mastered, false);
  assert.equal(again.knows, 0);
  assert.equal(again.lapses, 1);
  assert.equal(rateCard(card, "know").xp, 0);
});

test("Again returns the current card a short gap later", () => {
  const queue = ["a", "b", "c", "d"];
  bury(queue, 2);
  assert.deepEqual(queue, ["b", "c", "a", "d"]);
  const solo = ["only"];
  bury(solo, 2);
  assert.deepEqual(solo, ["only"]);
});

test("weakest cards are unseen and missed cards, mastered cards last", () => {
  const cards = [
    { id: "2-0", lesson: 2, index: 0, state: { knows: 2, lapses: 0, mastered: true } },
    { id: "1-1", lesson: 1, index: 1, state: { knows: 0, lapses: 3, mastered: false } },
    { id: "1-0", lesson: 1, index: 0, state: null },
    { id: "1-2", lesson: 1, index: 2, state: { knows: 1, lapses: 0, mastered: false } },
  ];
  const order = weakestFirst(cards, 3).map((card) => card.id);
  assert.deepEqual(order, ["1-1", "1-0", "1-2"]);
  assert.ok(weakness({ mastered: true, knows: 2, lapses: 0 }) > weakness(null));
});

test("80 percent is the pass line and scores keep a rounded percent", () => {
  assert.equal(passed(4, 5), true);
  assert.equal(passed(16, 20), true);
  assert.equal(passed(15, 20), false);
  assert.equal(passed(4, 6), false);
  assert.equal(passed(5, 6), true);
  assert.equal(percent(5, 6), 83);
  assert.equal(percent(1, 3), 33);
});

test("quiz options keep the correct answer and shuffle the rest", () => {
  const question = { correct: "Right", wrong: ["A", "B"] };
  const options = optionsFor(question, () => 0);
  assert.equal(options.filter((option) => option.correct).length, 1);
  assert.equal(options.find((option) => option.correct).text, "Right");
  assert.equal(new Set(options.map((option) => option.text)).size, 3);
});

test("streak survives until the local day is missed", () => {
  const today = "2026-03-01";
  assert.equal(prevISODate(today), "2026-02-28");
  const progress = freshProgress();
  progress.lastStudyDate = "2026-02-28";
  progress.streak = 4;
  assert.equal(effectiveStreak(progress, today), 4);
  const next = applyStudyDay(progress, today);
  assert.equal(next.streak, 5);
  assert.equal(next.xpGained, 15);
  progress.lastStudyDate = "2026-02-20";
  progress.streak = 4;
  assert.equal(effectiveStreak(progress, today), 0);
  assert.equal(applyStudyDay(progress, today).streak, 1);
  progress.lastStudyDate = today;
  progress.streak = 5;
  assert.equal(applyStudyDay(progress, today).xpGained, 0);
});

test("import keeps a trainer export and rejects anything else", () => {
  const clean = sanitizeProgress({
    app: "grok-course-trainer",
    progress: {
      version: 1,
      xp: 42.2,
      streak: 3,
      lastStudyDate: "2026-11-25",
      lessons: { 4: { done: true, bestQuiz: 80, attempts: 1, rewarded: true }, bad: { done: true } },
      cards: { "4-0": { knows: 2, lapses: 1, mastered: true }, "nope": { knows: 1 } },
      exam: { best: 90, attempts: 1, passed: true, rewarded: true },
      games: { match: { best: 500, plays: 2 } },
    },
  });
  assert.equal(clean.xp, 42);
  assert.equal(clean.lessons["4"].bestQuiz, 80);
  assert.equal(clean.lessons.bad, undefined);
  assert.equal(clean.cards["4-0"].mastered, true);
  assert.equal(clean.cards.nope, undefined);
  assert.equal(clean.games.match.best, 500);
  assert.equal(clean.games.which.best, 0);
  assert.throws(() => sanitizeProgress({ app: "other", progress: { xp: 1 } }), /not a Grok course/);
  assert.throws(() => sanitizeProgress({ progress: {} }), /no usable XP/);
});

test("levels step every 120 XP", () => {
  assert.deepEqual(levelFor(0), { level: 1, into: 0, span: 120, remaining: 120 });
  assert.equal(levelFor(120).level, 2);
  assert.equal(levelFor(250).remaining, 110);
});

test("match score falls with misses and time", () => {
  assert.equal(matchScore(0, 0, 5), 1000);
  assert.ok(matchScore(30, 2, 5) < matchScore(10, 0, 5));
  assert.equal(matchScore(500, 20, 5), 0);
});
