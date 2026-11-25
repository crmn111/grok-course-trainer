import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const course = JSON.parse(readFileSync(new URL("../src/course.json", import.meta.url), "utf8"));

const WATCH_ONLY = ["pS6_5PNS8qs", "ffNQGX6gXaU", "OvBayqdwUag", "3gNg7NdoPIk"];

function durationSeconds(duration) {
  const [minutes, seconds] = duration.split(":").map(Number);
  return minutes * 60 + seconds;
}

test("course file has one study unit per channel video", () => {
  assert.equal(course.videos.length, 24);
  assert.equal(course.scenarios.length, 20);
  const ids = course.videos.map((video) => video.id);
  assert.equal(new Set(ids).size, 24);
  assert.deepEqual(course.videos.map((video) => video.order), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.equal(course.videos[0].id, "F1_0Lkp16Rc");
  assert.equal(course.videos.at(-1).id, "3gNg7NdoPIk");
  assert.deepEqual(
    course.videos.filter((video) => video.watchOnly).map((video) => video.id),
    WATCH_ONLY,
  );
});

test("each video has catalog timing and a complete study set", () => {
  for (const video of course.videos) {
    assert.match(video.id, /^[A-Za-z0-9_-]{6,20}$/);
    assert.equal(video.url, `https://www.youtube.com/watch?v=${video.id}`);
    assert.equal(video.lengthSeconds, durationSeconds(video.duration));
    assert.ok(video.title && video.summary);
    if (video.watchOnly) {
      assert.equal(video.flashcards.length, 0);
      assert.equal(video.quiz.length, 0);
      assert.equal(video.chapters.length, 0);
      continue;
    }
    assert.ok(video.concepts.length);
    const substantial = video.lengthSeconds >= 600;
    if (substantial) {
      assert.ok(video.flashcards.length >= 8 && video.flashcards.length <= 12, video.id);
      assert.ok(video.quiz.length >= 5, video.id);
    } else {
      assert.ok(video.flashcards.length >= 2 && video.flashcards.length <= 12, video.id);
      assert.ok(video.quiz.length >= 2, video.id);
      assert.equal(video.chapters.length, 0);
    }
    if (video.lengthSeconds >= 1700) assert.ok(video.chapters.length >= 3, video.id);
    let previous = -1;
    for (const chapter of video.chapters) {
      assert.ok(chapter.title && chapter.concepts.length);
      assert.ok(chapter.seconds > previous);
      assert.ok(chapter.seconds < video.lengthSeconds);
      previous = chapter.seconds;
    }
    for (const card of video.flashcards) assert.ok(card.front && card.back);
    for (const question of video.quiz) {
      assert.ok(question.question && question.correct && question.why);
      assert.ok(Array.isArray(question.wrong) && question.wrong.length >= 1);
      assert.ok(!question.wrong.includes(question.correct));
    }
  }
});

test("scenarios point at a video that can be studied", () => {
  const videos = Object.fromEntries(course.videos.map((video) => [video.id, video]));
  for (const scenario of course.scenarios) {
    const video = videos[scenario.video];
    assert.ok(video, scenario.video);
    assert.equal(video.watchOnly, false);
    assert.ok(scenario.situation && scenario.correct && scenario.why);
    assert.equal(scenario.wrong.length, 2);
    assert.ok(!scenario.wrong.includes(scenario.correct));
  }
});
