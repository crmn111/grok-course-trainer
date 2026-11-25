import { rerender } from "./bus.js";
import {
  allCards,
  allQuestions,
  cardsForVideo,
  counts,
  questionsForVideo,
  safeVideoId,
  scenarios,
  studyVideos,
  videoById,
  videos,
} from "./course.js";
import course from "./course.js";
import { updateChrome } from "./chrome.js";
import { announce, askConfirm } from "./dialog.js";
import { esc, icon } from "./html.js";
import {
  bury,
  clock,
  effectiveStreak,
  levelFor,
  localISODate,
  matchScore,
  optionsFor,
  shuffle,
  weakestFirst,
} from "./logic.js";
import {
  exportPayload,
  get,
  rate,
  recordExam,
  recordGame,
  recordQuiz,
  replaceProgress,
  resetProgress,
  toggleVideo,
  warning,
} from "./state.js";
import { applyScheme } from "./theme.js";

const TOTAL = counts();
let videoFilter = "all";
let seekSeconds = 0;
let session = null;
let keyHandler = null;

function progress() {
  return get();
}

function videoRecord(id) {
  return progress().videos[id] || { done: false, bestQuiz: null, attempts: 0, rewarded: false };
}

function cardRecord(id) {
  return progress().cards[id] || { knows: 0, lapses: 0, mastered: false };
}

function masteredAmong(cards) {
  return cards.filter((card) => cardRecord(card.id).mastered).length;
}

function clearTimer() {
  if (session?.timer) window.clearInterval(session.timer);
  if (session?.missTimer) window.clearTimeout(session.missTimer);
}

export function leave() {
  clearTimer();
  session = null;
  seekSeconds = 0;
  if (keyHandler) {
    window.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
}

export function enter(route) {
  leave();
  if (route.section === "cards" && route.id) session = createCardSession(route.id);
  if (route.section === "quiz" && route.id) session = createQuizSession(route.id);
  if (route.section === "play" && route.id) session = { kind: "game", name: route.id, phase: "ready" };
  if (route.section === "cards" && session) installCardKeys();
}

function installCardKeys() {
  keyHandler = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, textarea, select")) return;
    const key = event.key.toLowerCase();
    if (key === "f") {
      event.preventDefault();
      flipCard();
    } else if (key === "a") {
      event.preventDefault();
      gradeCard("again");
    } else if (key === "k") {
      event.preventDefault();
      gradeCard("know");
    }
  };
  window.addEventListener("keydown", keyHandler);
}

function createCardSession(id) {
  const deck = id === "all"
    ? weakestFirst(allCards().map((card) => ({ ...card, state: cardRecord(card.id) })), 20)
    : cardsForVideo(id);
  if (!deck.length) return null;
  const video = id === "all" ? null : videoById(id);
  if (id !== "all" && !video) return null;
  return {
    kind: "cards",
    id,
    video,
    queue: deck.map((card) => ({ ...card })),
    ids: deck.map((card) => card.id),
    flipped: false,
    phase: "study",
  };
}

function createQuizSession(id) {
  if (id === "exam") {
    const questions = shuffle(allQuestions()).slice(0, 20);
    return {
      kind: "quiz",
      mode: "exam",
      items: questions.map((question) => ({ question, options: optionsFor(question), picked: null })),
      index: 0,
      phase: "ask",
      recorded: false,
    };
  }
  const video = videoById(id);
  if (!video || !video.quiz.length) return null;
  return {
    kind: "quiz",
    mode: "video",
    video,
    items: shuffle(questionsForVideo(video.id)).map((question) => ({
      question,
      options: optionsFor(question),
      picked: null,
    })),
    index: 0,
    phase: "ask",
    recorded: false,
  };
}

export function pageTitle(route) {
  if (route.section === "videos" && route.id) {
    const video = videoById(route.id);
    return video ? video.title : "Videos";
  }
  if (route.section === "cards") return "Flashcards";
  if (route.section === "quiz" && route.id === "exam") return "Final exam";
  if (route.section === "quiz" && route.id) {
    const video = videoById(route.id);
    return video ? `Quiz: ${video.title}` : "Quizzes";
  }
  if (route.section === "quiz") return "Quizzes";
  if (route.section === "play") return "Games";
  if (route.section === "progress") return "Progress";
  return "Videos";
}

export function render(route) {
  if (route.section === "videos" && route.id) return renderVideo(route.id);
  if (route.section === "videos") return renderVideos();
  if (route.section === "cards" && route.id) return renderCardStudy();
  if (route.section === "cards") return renderCardIndex();
  if (route.section === "quiz" && route.id) return renderQuiz();
  if (route.section === "quiz") return renderQuizIndex();
  if (route.section === "play" && route.id) return renderGame();
  if (route.section === "play") return renderGameIndex();
  if (route.section === "progress") return renderProgress();
  return renderMissing();
}

function renderMissing() {
  return `<section class="page"><h1>That page is not in the course</h1><p class="lede">The trainer has a page for every Grok video, plus flashcards, quizzes, games, and progress.</p><p><a class="btn primary" href="#/videos">Back to videos</a></p></section>`;
}

function renderVideos() {
  const records = videos().map((video) => ({ video, record: videoRecord(video.id) }));
  const next = records.find((item) => !item.record.done);
  const filtered = records.filter((item) => {
    if (videoFilter === "done") return item.record.done;
    if (videoFilter === "open") return !item.record.done;
    if (videoFilter === "watch") return item.video.watchOnly;
    return true;
  });
  const doneCount = records.filter((item) => item.record.done).length;
  const banner = next
    ? `<a class="up-next" href="#/videos/${next.video.id}">
        <span>
          <strong>${next.video.order} · ${esc(next.video.title)}</strong>
          <span class="sum">${esc(next.video.summary)}</span>
        </span>
        <span class="btn-face">Continue</span>
      </a>`
    : `<div class="up-next static">
        <span><strong>All ${TOTAL.videos} videos are marked done.</strong><span class="sum">The final exam is 20 questions drawn from the whole course.</span></span>
        <a class="btn-face" href="#/quiz/exam">Final exam</a>
      </div>`;
  const tiles = filtered.map(({ video, record }) => {
    const mastered = masteredAmong(cardsForVideo(video.id));
    const total = video.flashcards.length;
    const status = video.watchOnly
      ? (record.done ? `${icon("check")} Watched` : "Watch only")
      : `${record.done ? `${icon("check")} Done` : "Not done"} · ${mastered}/${total} cards`;
    return `<a class="tile video-tile" href="#/videos/${video.id}">
      <img alt="" src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" width="320" height="180">
      <span class="tile-copy">
        <span class="tile-kicker">${video.order} · ${esc(video.duration)}${video.watchOnly ? " · Watch only" : ""}</span>
        <span class="tile-title">${esc(video.title)}</span>
        <span class="tile-status">${status}</span>
      </span>
    </a>`;
  }).join("");
  const empty = filtered.length ? "" : `<p class="fine">Nothing in this filter. ${doneCount} of ${TOTAL.videos} videos are marked done.</p>`;
  return `<section class="page">
    <h1>Videos</h1>
    <p class="lede">${TOTAL.videos} videos from the Grok channel, in learning order. Long sessions open into chapters. Music promos and the Odyssey pilots are marked watch only.</p>
    ${banner}
    <div class="filters" role="group" aria-label="Filter videos">
      ${filterButton("all", "All")}
      ${filterButton("open", "Still open")}
      ${filterButton("done", "Done")}
      ${filterButton("watch", "Watch only")}
    </div>
    <div class="tiles">${tiles}</div>
    ${empty}
    <p class="fine source-note">Source: <a href="https://www.youtube.com/@Grok" target="_blank" rel="noopener noreferrer">Grok on YouTube</a>. Course file dated ${esc(course.generated)}.</p>
  </section>`;
}

function filterButton(value, label) {
  const pressed = videoFilter === value ? "true" : "false";
  return `<button type="button" class="btn" data-action="filter" data-filter="${value}" aria-pressed="${pressed}">${label}</button>`;
}

function renderVideo(id) {
  const video = videoById(id);
  if (!video || !safeVideoId(video.id)) return renderMissing();
  const record = videoRecord(video.id);
  const mastered = masteredAmong(cardsForVideo(video.id));
  const concepts = video.concepts.map((concept) => `<li>${esc(concept)}</li>`).join("");
  const best = video.watchOnly
    ? "No quiz on a watch-only video."
    : (record.bestQuiz == null ? "No quiz yet" : `Best quiz ${record.bestQuiz}%`);
  const doneLabel = video.watchOnly
    ? (record.done ? "Mark as not watched" : "Mark watched")
    : (record.done ? "Mark as not done" : "Mark video done");
  const study = video.watchOnly ? "" : `<div class="actions">
      ${video.flashcards.length ? `<a class="btn primary" href="#/cards/${video.id}">Flashcards</a>` : ""}
      ${video.quiz.length ? `<a class="btn" href="#/quiz/${video.id}">Quiz</a>` : ""}
      <button type="button" class="btn" data-action="toggle-done" data-video="${video.id}">${doneLabel}</button>
    </div>`;
  const watchActions = video.watchOnly ? `<div class="actions">
      <button type="button" class="btn" data-action="toggle-done" data-video="${video.id}">${doneLabel}</button>
    </div>
    <p class="watch-note">Watch only. The transcript has no lesson, so this video has no cards and no quiz.</p>` : "";
  const conceptBlock = concepts
    ? `<h2>Core concepts</h2><ul class="concepts">${concepts}</ul>`
    : "";
  return `<article class="page">
    <p class="crumb"><a href="#/videos">All videos</a></p>
    <h1>${esc(video.title)}</h1>
    <p class="lede">${esc(video.summary)}</p>
    <p class="fine" data-done-note>${record.done ? "Marked done." : "Not done yet."} ${best}${video.flashcards.length ? `. Cards mastered ${mastered} of ${video.flashcards.length}.` : ""} ${esc(video.duration)}.</p>
    ${study}${watchActions}
    ${playerFrame(video)}
    <p class="fine">The player needs a network connection. The summary, cards, quizzes, and saved progress work offline. <a href="${esc(video.url)}" target="_blank" rel="noopener noreferrer">Open on YouTube</a>.</p>
    ${conceptBlock}
    ${renderChapters(video)}
  </article>`;
}

function renderChapters(video) {
  if (!video.chapters.length) return "";
  const items = video.chapters.map((chapter) => {
    const pressed = seekSeconds === chapter.seconds;
    const concepts = chapter.concepts.map((concept) => `<li>${esc(concept)}</li>`).join("");
    return `<li class="chapter">
      <button type="button" class="btn chapter-jump" data-action="seek" data-seconds="${chapter.seconds}" aria-pressed="${pressed ? "true" : "false"}">About ${clock(chapter.seconds)} · ${esc(chapter.title)}</button>
      <ul class="concepts">${concepts}</ul>
    </li>`;
  }).join("");
  return `<h2>Chapters</h2>
    <p class="fine">Times are approximate. They come from where the topic first shows up in the transcript, scaled to the video length. Choosing one starts the player there.</p>
    <ol class="chapters">${items}</ol>`;
}

function playerFrame(video) {
  const start = seekSeconds > 0 ? `&start=${seekSeconds}` : "";
  return `<div class="frame" tabindex="-1"><iframe title="${esc(video.title)}" src="https://www.youtube-nocookie.com/embed/${video.id}?rel=0${start}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

function renderCardIndex() {
  const rows = studyVideos().map((video) => {
    const cards = cardsForVideo(video.id);
    const mastered = masteredAmong(cards);
    return `<li><a href="#/cards/${video.id}"><span>${video.order}. ${esc(video.title)}</span><span class="fine">${mastered}/${cards.length} mastered</span></a></li>`;
  }).join("");
  return `<section class="page">
    <h1>Flashcards</h1>
    <p class="lede">${TOTAL.cards} cards. A card is mastered after you know it twice in a row. Again sends it back a couple of cards later and clears that run. Watch-only videos have no deck.</p>
    <a class="up-next" href="#/cards/all">
      <span><strong>20 weakest, all videos</strong><span class="sum">Unseen cards and cards you missed come first.</span></span>
      <span class="btn-face">Start</span>
    </a>
    <ol class="plain-list">${rows}</ol>
  </section>`;
}

function renderCardStudy() {
  if (!session || session.kind !== "cards") return renderMissing();
  if (!session.queue.length) return renderCardDone();
  const card = session.queue[0];
  const deckCards = session.ids.map((id) => allCards().find((item) => item.id === id)).filter(Boolean);
  const mastered = masteredAmong(deckCards);
  const label = session.flipped
    ? `Answer: ${card.back}. Activate to show the prompt again.`
    : `Prompt: ${card.front}. Activate to flip.`;
  const face = session.flipped ? card.back : card.front;
  const disabled = session.flipped ? "" : "disabled";
  return `<section class="page study">
    <p class="crumb"><a href="#/cards">All decks</a></p>
    <h1>${session.video ? esc(session.video.title) : "20 weakest cards"}</h1>
    <p class="fine">${session.queue.length} left in this round, including cards you asked to see again. Mastered in this set: ${mastered} of ${session.ids.length}. ${esc(card.videoTitle)}</p>
    <button type="button" class="study-card ${session.flipped ? "is-back is-revealing" : "is-revealing"}" data-action="flip" data-focus-card aria-label="${esc(label)}">
      <span class="eyebrow-free">${session.flipped ? "Answer" : "Prompt"}</span>
      <span class="face">${esc(face)}</span>
    </button>
    <div class="actions grade">
      <button type="button" class="btn" data-action="again" ${disabled}>Again</button>
      <button type="button" class="btn primary" data-action="know" ${disabled}>I knew it</button>
    </div>
    <p class="fine">F flips the card. A is Again. K is I knew it. Ratings unlock after the flip.</p>
  </section>`;
}

function renderCardDone() {
  const deckCards = session.ids.map((id) => allCards().find((item) => item.id === id)).filter(Boolean);
  const mastered = masteredAmong(deckCards);
  const again = session.id === "all" ? "#/cards/all" : `#/cards/${session.video.id}`;
  return `<section class="page">
    <h1>Round complete</h1>
    <p class="lede">${mastered} of ${session.ids.length} cards in this set are mastered. A card needs two “I knew it” ratings in a row.</p>
    <div class="actions">
      <a class="btn primary" href="${again}">Study this deck again</a>
      <a class="btn" href="#/cards">All decks</a>
    </div>
  </section>`;
}

function renderQuizIndex() {
  const exam = progress().exam;
  const examBest = exam.best == null ? "Not taken" : `Best ${exam.best}%${exam.passed ? " · Passed" : ""}`;
  const rows = videos().filter((video) => video.quiz.length).map((video) => {
    const record = videoRecord(video.id);
    const best = record.bestQuiz == null ? "Not taken" : `${record.bestQuiz}%`;
    return `<li><a href="#/quiz/${video.id}"><span>${video.order}. ${esc(video.title)}</span><span class="fine">${best}${record.done ? " · Done" : ""}</span></a></li>`;
  }).join("");
  return `<section class="page">
    <h1>Quizzes</h1>
    <p class="lede">Each video quiz shuffles its choices and explains the answer. 80% or better marks that video done. Your best score is the one that sticks. Watch-only videos are left off this list.</p>
    <a class="up-next" href="#/quiz/exam">
      <span><strong>Final exam</strong><span class="sum">20 random questions from the whole course. ${esc(examBest)}. 80% passes the exam.</span></span>
      <span class="btn-face">Start exam</span>
    </a>
    <ol class="plain-list">${rows}</ol>
  </section>`;
}

function renderQuiz() {
  if (!session || session.kind !== "quiz") return renderMissing();
  if (session.phase === "result") return renderQuizResult();
  const item = session.items[session.index];
  const correctSoFar = session.items.filter((entry) => entry.picked != null && entry.options[entry.picked]?.correct).length;
  const crumb = session.mode === "exam"
    ? `<a href="#/quiz">All quizzes</a> · Final exam`
    : `<a href="#/quiz">All quizzes</a> · ${esc(session.video.title)}`;
  const heading = esc(item.question.question);
  const choices = item.options.map((option, index) => {
    const locked = item.picked != null;
    let cls = "choice";
    let flag = "";
    if (locked && option.correct) {
      cls += " is-correct";
      flag = `<span class="flag">Correct</span>`;
    } else if (locked && index === item.picked) {
      cls += " is-wrong";
      flag = `<span class="flag">Your choice</span>`;
    }
    return `<button type="button" class="${cls}" data-action="pick-option" data-option="${index}" ${locked ? "disabled" : ""}>
      <span>${esc(option.text)}</span>${flag}
    </button>`;
  }).join("");
  const feedback = item.picked == null ? "" : quizFeedback(item);
  return `<section class="page">
    <p class="crumb">${crumb} · Question ${session.index + 1} of ${session.items.length} · ${correctSoFar} correct</p>
    <h1 id="question">${heading}</h1>
    <div class="choices">${choices}</div>
    ${feedback}
  </section>`;
}

function quizFeedback(item) {
  const chosen = item.options[item.picked];
  const right = chosen?.correct;
  const last = session.index + 1 >= session.items.length;
  return `<div class="feedback" tabindex="-1">
    <p><strong>${right ? "Correct." : "Not quite."}</strong> ${right ? "" : `Correct answer: ${esc(item.question.correct)}. `}${esc(item.question.why)}</p>
    <button type="button" class="btn primary" data-action="next-question">${last ? "See result" : "Next question"}</button>
  </div>`;
}

function renderQuizResult() {
  const result = commitQuiz();
  const exam = session.mode === "exam";
  const heading = exam ? "Exam result" : "Quiz result";
  let outcome;
  if (exam) {
    outcome = result.pass
      ? "80% or better passes the exam."
      : `80% passes the exam. This round is ${result.pct}%.`;
  } else if (result.pass && result.newlyDone) {
    outcome = "80% or better marks this video done. It is marked done now.";
  } else if (result.pass) {
    outcome = "80% or better. This video stays marked done.";
  } else {
    outcome = `80% marks the video done. This round is ${result.pct}%.`;
  }
  const review = exam
    ? `<a class="btn" href="#/cards/all">Review weakest cards</a>`
    : `<a class="btn" href="#/cards/${session.video.id}">Review these cards</a>`;
  const retry = exam ? "#/quiz/exam" : `#/quiz/${session.video.id}`;
  return `<section class="page">
    <h1>${heading}</h1>
    <p class="lede">${result.pct}% this round. Best is ${result.best}%. ${outcome}</p>
    <p class="fine">+${result.xpGained} XP. ${attemptLine(exam)}</p>
    <div class="actions">
      <a class="btn primary" href="${retry}">Try again</a>
      ${review}
      <a class="btn" href="#/quiz">All quizzes</a>
    </div>
  </section>`;
}

function attemptLine(exam) {
  const attempts = exam ? progress().exam.attempts : videoRecord(session.video.id).attempts;
  const noun = attempts === 1 ? "time" : "times";
  return exam ? `Taken ${attempts} ${noun}.` : `Taken ${attempts} ${noun} for this video.`;
}

function commitQuiz() {
  if (session.result) return session.result;
  const correct = session.items.filter((item) => item.options[item.picked]?.correct).length;
  session.result = session.mode === "exam"
    ? recordExam(correct, session.items.length)
    : recordQuiz(session.video.id, correct, session.items.length);
  announce(`${session.result.pct} percent. ${session.result.pass ? "Passed." : "Below 80 percent."}`);
  return session.result;
}

function renderGameIndex() {
  const games = progress().games;
  return `<section class="page">
    <h1>Games</h1>
    <p class="lede">Four short rounds made only from the course cards, quizzes, and GConf scenarios.</p>
    <ol class="game-list">
      ${gameRow("match", "Match the meaning", "Pair each term with its meaning. The clock runs and every miss counts.", games.match, "Best score")}
      ${gameRow("which", "Which video is this?", "A card appears. Pick the video it comes from. You have 60 seconds.", games.which, "Best correct")}
      ${gameRow("scenarios", "GConf scenarios", "Twenty GConf situations from the course. Pick the move that solves each one.", games.scenarios, "Best correct")}
      ${gameRow("swap", "Straight or swapped", "A term and a meaning appear. Say whether the meaning belongs to that term. 45 seconds.", games.swap, "Best correct")}
    </ol>
  </section>`;
}

function gameRow(id, title, body, record, bestLabel) {
  const best = record.plays ? `${bestLabel} ${record.best}` : "No score yet";
  return `<li>
    <h2>${title}</h2>
    <p>${body}</p>
    <p class="fine">${best}${record.plays ? ` · Played ${record.plays}` : ""}</p>
    <a class="btn primary play" href="#/play/${id}">Play</a>
  </li>`;
}

function renderGame() {
  if (!session || session.kind !== "game") return renderMissing();
  if (session.name === "match") return renderMatch();
  if (session.name === "which") return renderWhich();
  if (session.name === "scenarios") return renderScenarios();
  if (session.name === "swap") return renderSwap();
  return renderMissing();
}

function readyScreen(title, body, action) {
  return `<section class="page">
    <p class="crumb"><a href="#/play">All games</a></p>
    <h1>${title}</h1>
    <p class="lede">${body}</p>
    <button type="button" class="btn primary" data-action="${action}">Start</button>
  </section>`;
}

function renderMatch() {
  if (session.phase === "ready") {
    return readyScreen(
      "Match the meaning",
      "Five terms, five meanings, shuffled. Pair them. Misses and seconds both come off the score.",
      "start-match",
    );
  }
  if (session.phase === "done") return renderMatchDone();
  const termButtons = session.terms.map((term) => matchButton("pick-term", term, "term")).join("");
  const meaningButtons = session.meanings.map((meaning) => matchButton("pick-meaning", meaning, "meaning")).join("");
  return `<section class="page">
    <div class="hud">
      <a href="#/play">Games</a>
      <p>Time <span data-clock>${clock(elapsed())}</span></p>
      <p>Misses <span>${session.misses}</span></p>
    </div>
    <h1>Match the meaning</h1>
    <p class="fine" data-match-status>${session.note || "Choose a term, then its meaning."}</p>
    <div class="match">
      <div><h2>Term</h2><div class="stack">${termButtons}</div></div>
      <div><h2>Meaning</h2><div class="stack">${meaningButtons}</div></div>
    </div>
  </section>`;
}

function matchButton(action, item, side) {
  const matched = session.matched.has(item.id);
  const selected = session.selected[side] === item.id;
  const wrong = session.wrong?.[side] === item.id;
  const cls = `choice${selected ? " is-selected" : ""}${wrong ? " is-wrong" : ""}${matched ? " is-correct" : ""}`;
  const flag = matched ? `<span class="flag">Paired</span>` : wrong ? `<span class="flag">Not a pair</span>` : "";
  return `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(item.id)}" aria-pressed="${selected ? "true" : "false"}" ${matched ? "disabled" : ""}>
    <span>${esc(item.text)}</span>${flag}
  </button>`;
}

function renderMatchDone() {
  const result = session.result;
  return `<section class="page">
    <h1>Board cleared</h1>
    <p class="lede">Score ${session.score}. ${session.misses} misses in ${clock(session.seconds)}. Best is ${result.best}.</p>
    <p class="fine">${result.improved ? "New best." : "Best stays put."} +${result.xpGained} XP.</p>
    <div class="actions">
      <button type="button" class="btn primary" data-action="start-match">Play again</button>
      <a class="btn" href="#/play">All games</a>
    </div>
  </section>`;
}

function renderWhich() {
  if (session.phase === "ready") {
    return readyScreen(
      "Which video is this?",
      "You get 60 seconds. Each card is from one video. Four video titles, one of them right. Wrong answers just move you on.",
      "start-which",
    );
  }
  if (session.phase === "done") {
    return `<section class="page">
      <h1>Time</h1>
      <p class="lede">${session.correct} correct. Best is ${session.result.best}.</p>
      <p class="fine">${session.result.improved ? "New best." : "Best stays put."} +${session.result.xpGained} XP.</p>
      <div class="actions">
        <button type="button" class="btn primary" data-action="start-which">Play again</button>
        <a class="btn" href="#/play">All games</a>
      </div>
    </section>`;
  }
  const choices = session.current.choices.map((video) => `<button type="button" class="choice" data-action="answer-which" data-video="${video.id}"><span>${video.order}. ${esc(video.title)}</span></button>`).join("");
  return `<section class="page">
    <div class="hud">
      <a href="#/play">Games</a>
      <p class="big-clock" data-clock>${clock(whichLeft())}</p>
      <p>Correct <span>${session.correct}</span></p>
    </div>
    <h1>Which video is this?</h1>
    <div class="prompt" id="prompt" tabindex="-1">
      <p class="face">${esc(session.current.card.front)}</p>
      <p>${esc(session.current.card.back)}</p>
    </div>
    <div class="choices">${choices}</div>
  </section>`;
}

function renderScenarios() {
  if (session.phase === "ready") {
    return readyScreen(
      "GConf scenarios",
      `${TOTAL.scenarios} situations from the course, in a shuffled round. Pick the move that solves the problem. Each one names its video after you answer.`,
      "start-scenarios",
    );
  }
  if (session.phase === "done") {
    return `<section class="page">
      <h1>Scenarios complete</h1>
      <p class="lede">${session.correct} of ${session.items.length} correct. Best is ${session.result.best}.</p>
      <p class="fine">${session.result.improved ? "New best." : "Best stays put."} +${session.result.xpGained} XP.</p>
      <div class="actions">
        <button type="button" class="btn primary" data-action="start-scenarios">Play again</button>
        <a class="btn" href="#/play">All games</a>
      </div>
    </section>`;
  }
  const item = session.items[session.index];
  const video = videoById(item.scenario.video);
  const choices = item.options.map((option, index) => {
    const locked = item.picked != null;
    let cls = "choice";
    let flag = "";
    if (locked && option.correct) {
      cls += " is-correct";
      flag = `<span class="flag">Correct</span>`;
    } else if (locked && index === item.picked) {
      cls += " is-wrong";
      flag = `<span class="flag">Your choice</span>`;
    }
    return `<button type="button" class="${cls}" data-action="pick-scenario" data-option="${index}" ${locked ? "disabled" : ""}><span>${esc(option.text)}</span>${flag}</button>`;
  }).join("");
  const feedback = item.picked == null ? "" : `<div class="feedback" tabindex="-1">
      <p><strong>${item.options[item.picked].correct ? "Correct." : "Not quite."}</strong> ${esc(item.scenario.why)}</p>
      <p><a href="#/videos/${video.id}">${video.order}. ${esc(video.title)}</a></p>
      <button type="button" class="btn primary" data-action="next-scenario">${session.index + 1 >= session.items.length ? "See result" : "Next situation"}</button>
    </div>`;
  return `<section class="page">
    <p class="crumb"><a href="#/play">All games</a> · ${session.index + 1} of ${session.items.length} · ${session.correct} correct</p>
    <h1>${esc(item.scenario.situation)}</h1>
    <div class="choices">${choices}</div>
    ${feedback}
  </section>`;
}

function renderSwap() {
  if (session.phase === "ready") {
    return readyScreen(
      "Straight or swapped",
      "You get 45 seconds. Straight means the meaning is that term’s own card. Swapped means the meaning was borrowed from a different card.",
      "start-swap",
    );
  }
  if (session.phase === "done") {
    return `<section class="page">
      <h1>Time</h1>
      <p class="lede">${session.correct} correct calls. Best is ${session.result.best}.</p>
      <p class="fine">${session.result.improved ? "New best." : "Best stays put."} +${session.result.xpGained} XP.</p>
      <div class="actions">
        <button type="button" class="btn primary" data-action="start-swap">Play again</button>
        <a class="btn" href="#/play">All games</a>
      </div>
    </section>`;
  }
  return `<section class="page">
    <div class="hud">
      <a href="#/play">Games</a>
      <p class="big-clock" data-clock>${clock(swapLeft())}</p>
      <p>Correct <span>${session.correct}</span></p>
    </div>
    <h1>Straight or swapped</h1>
    <div class="prompt" id="prompt" tabindex="-1">
      <p class="face">${esc(session.current.front)}</p>
      <p>${esc(session.current.back)}</p>
    </div>
    <div class="actions">
      <button type="button" class="btn" data-action="judge" data-judge="straight">Straight</button>
      <button type="button" class="btn primary" data-action="judge" data-judge="swapped">Swapped</button>
    </div>
  </section>`;
}

function renderProgress() {
  const data = progress();
  const level = levelFor(data.xp);
  const today = localISODate();
  const streak = effectiveStreak(data, today);
  const mastered = allCards().filter((card) => cardRecord(card.id).mastered).length;
  const done = videos().filter((video) => videoRecord(video.id).done).length;
  const alive = data.lastStudyDate === prevDayLabel(today);
  const streakNote = streak === 0
    ? "No streak yet. Any study today starts one."
    : alive
      ? `Study today to keep the ${streak}-day streak.`
      : `${streak}-day streak, counted on this device’s calendar.`;
  const rows = videos().map((video) => {
    const record = videoRecord(video.id);
    const cards = cardsForVideo(video.id);
    const best = video.quiz.length ? (record.bestQuiz == null ? "—" : `${record.bestQuiz}%`) : "—";
    const cardCell = cards.length ? `${masteredAmong(cards)}/${cards.length}` : "—";
    const status = video.watchOnly ? (record.done ? "Watched" : "Watch only") : (record.done ? "Done" : "Open");
    return `<tr>
      <th scope="row"><a href="#/videos/${video.id}">${video.order}. ${esc(video.title)}</a></th>
      <td>${status}</td>
      <td>${cardCell}</td>
      <td>${best}</td>
    </tr>`;
  }).join("");
  const games = data.games;
  const scheme = document.querySelector('meta[name="color-scheme"]')?.content;
  const mode = scheme === "light" || scheme === "dark" ? scheme : "system";
  const saveNote = warning();
  return `<section class="page">
    <h1>Progress</h1>
    <p class="lede">Level ${level.level}. ${data.xp.toLocaleString()} XP, ${level.remaining} to level ${level.level + 1}. ${streak ? `${streak}-day streak.` : "No streak yet."} ${mastered} ${mastered === 1 ? "card" : "cards"} mastered. ${done} of ${TOTAL.videos} videos done.</p>
    <progress value="${level.into}" max="${level.span}">${level.into} of ${level.span} XP toward the next level</progress>
    <p class="fine">${streakNote}</p>
    ${data.migrationNote ? `<p class="note" role="status">${esc(data.migrationNote)}</p>` : ""}
    ${saveNote ? `<p class="alert" role="alert">${esc(saveNote)}</p>` : ""}
    <div class="table-wrap">
      <table>
        <caption>Progress by video</caption>
        <thead><tr><th scope="col">Video</th><th scope="col">Status</th><th scope="col">Cards</th><th scope="col">Best quiz</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <h2>Game bests</h2>
    <ul class="plain-list bests">
      <li><span>Match the meaning</span><span>${games.match.plays ? games.match.best : "—"}</span></li>
      <li><span>Which video is this?</span><span>${games.which.plays ? games.which.best : "—"}</span></li>
      <li><span>GConf scenarios</span><span>${games.scenarios.plays ? `${games.scenarios.best} of ${TOTAL.scenarios}` : "—"}</span></li>
      <li><span>Straight or swapped</span><span>${games.swap.plays ? games.swap.best : "—"}</span></li>
    </ul>
    <p class="fine">Exam best: ${data.exam.best == null ? "not taken" : `${data.exam.best}%`}${data.exam.passed ? ", passed" : ""}.</p>
    <h2>Color theme</h2>
    <fieldset>
      <legend>Choose the theme for this device</legend>
      ${schemeRadio("system", "System", mode)}
      ${schemeRadio("light", "Light", mode)}
      ${schemeRadio("dark", "Dark", mode)}
    </fieldset>
    <h2>Move progress</h2>
    <p>Export a JSON file from this browser, then import it on the other device. Import replaces the progress stored here.</p>
    <div class="actions">
      <button type="button" class="btn primary" data-action="export">Export progress</button>
      <label class="btn">Import progress<input class="file" type="file" accept="application/json,.json" data-action="import"></label>
    </div>
    <p id="import-note" class="alert" role="alert" hidden></p>
    <h2>Install</h2>
    <button type="button" class="btn" data-action="install" hidden>Install app</button>
    <p id="install-status" role="status"></p>
    <p>On iPhone, open Share and tap Add to Home Screen. After one online visit, videos, cards, quizzes, and games open offline. Playback still needs a connection.</p>
    <h2>How XP works</h2>
    <details>
      <summary>Scoring rules for this trainer</summary>
      <ul class="concepts">
        <li>Knowing a new card is 8 XP. The rating that masters it is 28 XP. Later reviews of a mastered card do not add XP.</li>
        <li>Again clears the two-in-a-row run and adds no XP.</li>
        <li>Quizzes add 1 XP per percentage point you improve on your best. The exam adds 2. The first time a video is marked done is 40 XP. The first exam pass is 100 XP.</li>
        <li>Games add XP only when the score beats your best.</li>
        <li>The first study action of a local day adds 15 XP and keeps the streak.</li>
      </ul>
    </details>
    <h2>Reset</h2>
    <p>This clears XP, the streak, cards, quizzes, the exam, and game scores on this device. It does not change the theme.</p>
    <button type="button" class="btn danger" data-action="reset">Reset progress</button>
  </section>`;
}

function schemeRadio(value, label, mode) {
  return `<label class="choice-row"><input type="radio" name="scheme" value="${value}" data-action="scheme" ${mode === value ? "checked" : ""}> ${label}</label>`;
}

function prevDayLabel(today) {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function flipCard() {
  if (!session || session.kind !== "cards" || session.phase !== "study" || !session.queue.length) return;
  session.flipped = !session.flipped;
  rerender({ focus: "[data-focus-card]" });
}

function gradeCard(rating) {
  if (!session || session.kind !== "cards" || !session.flipped || !session.queue.length) return;
  const card = session.queue[0];
  const result = rate(card.id, rating);
  if (rating === "again") bury(session.queue, 2);
  else session.queue.shift();
  session.flipped = false;
  if (result.justMastered) announce(`Mastered. ${card.front}`);
  if (!session.queue.length) {
    rerender({ focus: "h1" });
    return;
  }
  rerender({ focus: "[data-focus-card]" });
}

function pickOption(element) {
  const item = session?.items?.[session.index];
  if (!item || item.picked != null) return;
  item.picked = Number(element.dataset.option);
  rerender({ focus: ".feedback" });
}

function nextQuestion() {
  if (!session || session.kind !== "quiz") return;
  session.index += 1;
  if (session.index >= session.items.length) {
    session.phase = "result";
    rerender({ focus: "h1" });
    return;
  }
  rerender({ focus: "#question" });
}

function elapsed() {
  return Math.floor((performance.now() - session.t0) / 1000);
}

function startClock(tick) {
  clearTimer();
  session.timer = window.setInterval(tick, 250);
}

function startMatch() {
  clearTimer();
  const cards = shuffle(allCards()).slice(0, 5);
  session = {
    kind: "game",
    name: "match",
    phase: "play",
    pairs: cards,
    terms: cards.map((card) => ({ id: card.id, text: card.front })),
    meanings: shuffle(cards.map((card) => ({ id: card.id, text: card.back }))),
    matched: new Set(),
    selected: { term: null, meaning: null },
    wrong: null,
    misses: 0,
    locked: false,
    note: "",
    t0: performance.now(),
  };
  startClock(() => {
    const el = document.querySelector("[data-clock]");
    if (el && session?.phase === "play") el.textContent = clock(elapsed());
  });
  rerender({ focus: "[data-action='pick-term']" });
}

function pickMatch(side, id) {
  if (!session || session.phase !== "play" || session.locked) return;
  if (session.matched.has(id)) return;
  session.selected[side] = session.selected[side] === id ? null : id;
  session.note = "";
  const { term, meaning } = session.selected;
  if (term && meaning) {
    if (term === meaning) {
      session.matched.add(term);
      session.selected = { term: null, meaning: null };
      session.note = "Paired.";
      if (session.matched.size === session.pairs.length) {
        finishMatch();
        return;
      }
    } else {
      session.misses += 1;
      session.locked = true;
      session.wrong = { term, meaning };
      session.note = "Not a pair.";
      announce(`Not a pair. ${session.misses} misses.`);
      const token = {};
      session.token = token;
      session.missTimer = window.setTimeout(() => {
        if (session?.token !== token) return;
        session.wrong = null;
        session.locked = false;
        session.selected = { term: null, meaning: null };
        session.note = "Choose a term, then its meaning.";
        rerender({ focus: "[data-action='pick-term']" });
      }, 550);
    }
  }
  rerender(session.phase === "play" ? { focus: `[data-id='${id}']` } : { focus: "h1" });
}

function finishMatch() {
  clearTimer();
  session.phase = "done";
  session.seconds = elapsed();
  session.score = matchScore(session.seconds, session.misses, session.pairs.length);
  session.result = recordGame("match", session.score);
  announce(`Score ${session.score}.`);
  rerender({ focus: "h1" });
}

function nextWhich() {
  const cards = allCards();
  const card = cards[Math.floor(Math.random() * cards.length)];
  const correct = videoById(card.video);
  const distractors = shuffle(studyVideos().filter((video) => video.id !== card.video)).slice(0, 3);
  return { card, choices: shuffle([correct, ...distractors]) };
}

function whichLeft() {
  return Math.max(0, 60 - elapsed());
}

function startWhich() {
  clearTimer();
  session = {
    kind: "game",
    name: "which",
    phase: "play",
    correct: 0,
    current: nextWhich(),
    warned: false,
    t0: performance.now(),
  };
  startClock(() => {
    if (session?.phase !== "play") return;
    const left = whichLeft();
    const el = document.querySelector("[data-clock]");
    if (el) el.textContent = clock(left);
    if (left === 10 && !session.warned) {
      session.warned = true;
      announce("10 seconds left");
    }
    if (left <= 0) finishWhich();
  });
  rerender({ focus: "#prompt" });
}

function finishWhich() {
  if (!session || session.phase === "done") return;
  clearTimer();
  session.phase = "done";
  session.result = recordGame("which", session.correct);
  announce(`Time. ${session.correct} correct.`);
  rerender({ focus: "h1" });
}

function startScenarios() {
  clearTimer();
  session = {
    kind: "game",
    name: "scenarios",
    phase: "play",
    correct: 0,
    index: 0,
    items: shuffle(scenarios()).map((scenario) => ({
      scenario,
      options: optionsFor(scenario),
      picked: null,
    })),
  };
  rerender({ focus: "h1" });
}

function startSwap() {
  clearTimer();
  session = {
    kind: "game",
    name: "swap",
    phase: "play",
    correct: 0,
    seen: 0,
    current: nextSwap(),
    warned: false,
    t0: performance.now(),
  };
  startClock(() => {
    if (session?.phase !== "play") return;
    const left = swapLeft();
    const el = document.querySelector("[data-clock]");
    if (el) el.textContent = clock(left);
    if (left === 10 && !session.warned) {
      session.warned = true;
      announce("10 seconds left");
    }
    if (left <= 0) finishSwap();
  });
  rerender({ focus: "#prompt" });
}

function nextSwap() {
  const cards = allCards();
  const card = cards[Math.floor(Math.random() * cards.length)];
  let straight = Math.random() < 0.5;
  let back = card.back;
  if (!straight) {
    const others = cards.filter((item) => item.back !== card.back);
    if (!others.length) straight = true;
    else back = others[Math.floor(Math.random() * others.length)].back;
  }
  return { front: card.front, back, straight };
}

function swapLeft() {
  return Math.max(0, 45 - elapsed());
}

function finishSwap() {
  if (!session || session.phase === "done") return;
  clearTimer();
  session.phase = "done";
  session.result = recordGame("swap", session.correct);
  announce(`Time. ${session.correct} correct.`);
  rerender({ focus: "h1" });
}

function showImportNote(message) {
  const note = document.getElementById("import-note");
  if (!note) return;
  note.hidden = false;
  note.textContent = message;
}

async function importFile(file) {
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    showImportNote("That file is not valid JSON.");
    return;
  }
  try {
    const ok = await askConfirm({
      title: "Replace progress on this device?",
      body: "The file replaces XP, the streak, cards, quizzes, the exam, and game scores stored in this browser.",
      confirmLabel: "Replace progress",
    });
    if (!ok) {
      showImportNote("Import canceled. Progress on this device is unchanged.");
      return;
    }
    replaceProgress(data);
    announce("Progress imported.");
    rerender({ focus: "h1" });
  } catch (error) {
    showImportNote(error.message || "That file could not be imported.");
  }
}

const handlers = {
  filter(element) {
    videoFilter = element.dataset.filter;
    rerender({ focus: `[data-filter="${videoFilter}"]` });
  },
  seek(element) {
    const seconds = Number(element.dataset.seconds);
    if (!Number.isFinite(seconds)) return;
    seekSeconds = Math.max(0, Math.floor(seconds));
    rerender({ focus: ".frame" });
  },
  "toggle-done"(element) {
    const id = element.dataset.video;
    const video = videoById(id);
    if (!video) return;
    const result = toggleVideo(id);
    element.textContent = video.watchOnly
      ? (result.done ? "Mark as not watched" : "Mark watched")
      : (result.done ? "Mark as not done" : "Mark video done");
    const note = document.querySelector("[data-done-note]");
    const record = videoRecord(id);
    const mastered = masteredAmong(cardsForVideo(id));
    const best = video.watchOnly
      ? "No quiz on a watch-only video."
      : (record.bestQuiz == null ? "No quiz yet" : `Best quiz ${record.bestQuiz}%`);
    if (note) {
      const cards = video.flashcards.length ? ` Cards mastered ${mastered} of ${video.flashcards.length}.` : "";
      note.textContent = `${result.done ? "Marked done." : "Not done yet."} ${best}${cards} ${video.duration}.`;
    }
    announce(result.done ? `${video.title} marked done.` : `${video.title} marked not done.`);
    updateChrome();
  },
  flip() {
    flipCard();
  },
  again() {
    gradeCard("again");
  },
  know() {
    gradeCard("know");
  },
  "pick-option"(element) {
    pickOption(element);
  },
  "next-question"() {
    nextQuestion();
  },
  "start-match"() {
    startMatch();
  },
  "pick-term"(element) {
    pickMatch("term", element.dataset.id);
  },
  "pick-meaning"(element) {
    pickMatch("meaning", element.dataset.id);
  },
  "start-which"() {
    startWhich();
  },
  "answer-which"(element) {
    if (!session || session.phase !== "play") return;
    const id = element.dataset.video;
    if (id === session.current.card.video) session.correct += 1;
    session.current = nextWhich();
    rerender({ focus: "#prompt" });
  },
  "start-scenarios"() {
    startScenarios();
  },
  "pick-scenario"(element) {
    const item = session?.items?.[session.index];
    if (!item || item.picked != null) return;
    item.picked = Number(element.dataset.option);
    if (item.options[item.picked].correct) session.correct += 1;
    rerender({ focus: ".feedback" });
  },
  "next-scenario"() {
    if (!session) return;
    session.index += 1;
    if (session.index >= session.items.length) {
      session.phase = "done";
      session.result = recordGame("scenarios", session.correct);
      announce(`${session.correct} of ${session.items.length} correct.`);
      rerender({ focus: "h1" });
      return;
    }
    rerender({ focus: "h1" });
  },
  "start-swap"() {
    startSwap();
  },
  judge(element) {
    if (!session || session.phase !== "play") return;
    const straight = element.dataset.judge === "straight";
    if (straight === session.current.straight) session.correct += 1;
    session.seen += 1;
    session.current = nextSwap();
    const score = document.querySelector(".hud p:last-child span");
    const prompt = document.getElementById("prompt");
    if (score && prompt && session.phase === "play") {
      score.textContent = String(session.correct);
      prompt.querySelector(".face").textContent = session.current.front;
      prompt.querySelector("p:last-child").textContent = session.current.back;
      prompt.focus();
      return;
    }
    rerender({ focus: "#prompt" });
  },
  scheme(element) {
    applyScheme(element.value);
  },
  export() {
    const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = localISODate();
    link.href = url;
    link.download = `grok-course-progress-${today}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    announce("Progress file downloaded.");
  },
  import(element) {
    const file = element.files?.[0];
    element.value = "";
    importFile(file);
  },
  async install() {
    const status = document.getElementById("install-status");
    const button = document.querySelector("[data-action='install']");
    if (typeof navigator.install !== "function") {
      if (status) status.textContent = "This browser does not offer in-page install. Use the browser menu, or Share on iPhone.";
      return;
    }
    button?.setAttribute("aria-disabled", "true");
    try {
      await navigator.install();
      if (status) status.textContent = "The app was installed or opened.";
      if (button) button.hidden = true;
    } catch (error) {
      if (status) {
        status.textContent = error?.name === "AbortError"
          ? "Installation was canceled or could not complete."
          : "Installation could not start.";
      }
    } finally {
      button?.removeAttribute("aria-disabled");
    }
  },
  async reset() {
    const ok = await askConfirm({
      title: "Reset progress on this device?",
      body: "XP, the streak, mastered cards, video status, quiz scores, and game bests will be cleared. This cannot be undone unless you already exported a file.",
      confirmLabel: "Reset progress",
    });
    if (!ok) return;
    resetProgress();
    announce("Progress reset on this device.");
    rerender({ focus: "h1" });
  },
};

export function onAction(name, element) {
  const handler = handlers[name];
  if (handler) return handler(element);
  return undefined;
}

export function afterPaint(root) {
  const button = root.querySelector("[data-action='install']");
  if (button && typeof navigator.install === "function") button.hidden = false;
}
