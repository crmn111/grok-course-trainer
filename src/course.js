import course from "./course.json";

let cardCache;
let questionCache;

export default course;

export function lessons() {
  return course.lessons;
}

export function scenarios() {
  return course.scenarios;
}

export function lessonByNumber(value) {
  const number = Number(value);
  return course.lessons.find((lesson) => lesson.lesson === number) || null;
}

export function videoInfo(id) {
  return course.videos[id] || null;
}

export function safeVideoId(id) {
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

export function allCards() {
  if (!cardCache) {
    cardCache = course.lessons.flatMap((lesson) => lesson.flashcards.map((card, index) => ({
      id: `${lesson.lesson}-${index}`,
      lesson: lesson.lesson,
      index,
      front: card.front,
      back: card.back,
      lessonTitle: lesson.title,
    })));
  }
  return cardCache;
}

export function cardsForLesson(value) {
  const number = Number(value);
  return allCards().filter((card) => card.lesson === number);
}

export function allQuestions() {
  if (!questionCache) {
    questionCache = course.lessons.flatMap((lesson) => lesson.quiz.map((question, index) => ({
      ...question,
      id: `${lesson.lesson}-${index}`,
      lesson: lesson.lesson,
      lessonTitle: lesson.title,
    })));
  }
  return questionCache;
}

export function questionsForLesson(value) {
  const number = Number(value);
  return allQuestions().filter((question) => question.lesson === number);
}

export function counts() {
  return {
    lessons: course.lessons.length,
    cards: allCards().length,
    questions: allQuestions().length,
    scenarios: course.scenarios.length,
  };
}
