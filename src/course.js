import course from "./course.json";

let cardCache;
let questionCache;

export default course;

export function videos() {
  return course.videos;
}

export function videoById(id) {
  return course.videos.find((video) => video.id === id) || null;
}

export function studyVideos() {
  return course.videos.filter((video) => video.flashcards.length > 0);
}

export function scenarios() {
  return course.scenarios;
}

export function safeVideoId(id) {
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

export function allCards() {
  if (!cardCache) {
    cardCache = course.videos.flatMap((video) => video.flashcards.map((card, index) => ({
      id: `${video.id}-${index}`,
      video: video.id,
      order: video.order,
      index,
      front: card.front,
      back: card.back,
      videoTitle: video.title,
    })));
  }
  return cardCache;
}

export function cardsForVideo(id) {
  return allCards().filter((card) => card.video === id);
}

export function allQuestions() {
  if (!questionCache) {
    questionCache = course.videos.flatMap((video) => video.quiz.map((question, index) => ({
      ...question,
      id: `${video.id}-${index}`,
      video: video.id,
      videoTitle: video.title,
      order: video.order,
    })));
  }
  return questionCache;
}

export function questionsForVideo(id) {
  return allQuestions().filter((question) => question.video === id);
}

export function counts() {
  const list = course.videos;
  return {
    videos: list.length,
    study: list.filter((video) => !video.watchOnly).length,
    watchOnly: list.filter((video) => video.watchOnly).length,
    cards: allCards().length,
    questions: allQuestions().length,
    scenarios: course.scenarios.length,
  };
}
