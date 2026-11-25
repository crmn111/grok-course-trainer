import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const course = JSON.parse(readFileSync(new URL("../src/course.json", import.meta.url), "utf8"));

test("course file has the full Grok lesson set", () => {
  assert.equal(course.lessons.length, 23);
  assert.equal(course.scenarios.length, 20);
  const cards = course.lessons.reduce((sum, lesson) => sum + lesson.flashcards.length, 0);
  const questions = course.lessons.reduce((sum, lesson) => sum + lesson.quiz.length, 0);
  assert.equal(cards, 226);
  assert.equal(questions, 138);
  const numbers = course.lessons.map((lesson) => lesson.lesson);
  assert.deepEqual(numbers, Array.from({ length: 23 }, (_, index) => index + 1));
});

test("every lesson points at known videos and complete study items", () => {
  for (const lesson of course.lessons) {
    assert.ok(lesson.title && lesson.summary && lesson.concepts.length);
    assert.ok(lesson.videos.length);
    for (const id of lesson.videos) {
      assert.ok(course.videos[id], `missing video ${id}`);
      assert.match(id, /^[A-Za-z0-9_-]{6,20}$/);
      assert.ok(course.videos[id].url.includes(id));
    }
    for (const card of lesson.flashcards) {
      assert.equal(typeof card.front, "string");
      assert.equal(typeof card.back, "string");
      assert.ok(card.front.length && card.back.length);
    }
    for (const question of lesson.quiz) {
      assert.ok(question.question && question.correct && question.why);
      assert.ok(Array.isArray(question.wrong) && question.wrong.length >= 1);
      assert.ok(!question.wrong.includes(question.correct));
    }
  }
  for (const scenario of course.scenarios) {
    assert.ok(course.lessons.some((lesson) => lesson.lesson === scenario.lesson));
    assert.ok(scenario.situation && scenario.correct && scenario.why);
    assert.equal(scenario.wrong.length, 2);
  }
});
