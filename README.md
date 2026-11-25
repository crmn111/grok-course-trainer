# Grok course trainer

A static study app for the [Grok YouTube channel](https://www.youtube.com/@Grok). It is for Dirk, founder and CEO of GConf AI. Every video is its own page: summary, chapters on the long sessions, flashcards, a quiz, four games, and progress that stays on the device.

The site is published with GitHub Pages at [https://crmn111.github.io/grok-course-trainer/](https://crmn111.github.io/grok-course-trainer/).

## Run it locally

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:5173/grok-course-trainer/](http://localhost:5173/grok-course-trainer/). The `/grok-course-trainer/` prefix matches the GitHub Pages project URL, so asset paths are the same locally and in production.

```bash
npm run build
npm run preview
```

`preview` serves the production build, including the service worker, at the same base path.

## What’s in the app

- **Videos.** All 24 channel videos, in learning order, with the YouTube thumbnail, title, and duration. Open one for the embedded player, the summary, and the core concepts. A session of about 30 minutes or more also has chapters. A chapter’s time is approximate: it is where that topic first shows up in the transcript, scaled to the video length, and it seeks the player. Flashcards, the quiz, and Mark done sit on the video. Music-only promos and the two Odyssey pilots are marked watch only and have no quiz.
- **Flashcards.** One deck per video that teaches something, plus a 20-card round of the weakest cards across the course. Flip a card, then choose Again or I knew it. Again brings the card back after a couple of others and clears its run. A card is mastered after two “I knew it” ratings in a row.
- **Quizzes.** Each video quiz shuffles the choices and explains the answer immediately. 80% or better marks that video done. The final exam is 20 random questions from the whole course; 80% passes the exam. The app keeps the best score.
- **Games.** Match terms to meanings (timed, misses count). Which video is this, for 60 seconds. GConf scenarios, all 20 situations, each linked to a video. Straight or swapped, a 45-second call on whether a meaning belongs to the term.
- **Progress.** XP, level, daily streak, cards mastered, videos done, a per-video table, and game bests. Reset asks you to confirm. Export writes a JSON file; import replaces progress on this device, which is how a backup moves between a Mac and an iPhone. An older lesson-based save is kept for videos that used to be a single lesson. Webinars that had been split into several lessons start fresh, so one old chapter is not marked done for the whole video.
- **Install and offline.** `manifest.webmanifest` plus a service worker generated at build time. On iPhone use Share → Add to Home Screen. After one online visit, the trainer opens offline. YouTube playback still needs a network connection.
- **Theme.** The app follows the system light or dark setting. The header control switches to the opposite of what you see. Progress has System, Light, and Dark.

Progress is stored in `localStorage` under `grok-course-trainer-v1`. The theme is stored separately under `color-scheme`, so a progress reset does not change it. Opening the app once rewrites an old lesson-based save into this video-based shape.

## Add a video

Course content lives in [`src/course.json`](src/course.json). The app does not hard-code video text. `videos` is the learning order. To extend the course, append one object. `order` must be the next number. `correct` is the right quiz answer. `wrong` is the other choices. The app shuffles them.

```json
{
  "id": "VIDEO_ID",
  "order": 25,
  "title": "Video title",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "duration": "42:00",
  "lengthSeconds": 2520,
  "published": "2026-12-01",
  "watchOnly": false,
  "summary": "One or two sentences from the transcript.",
  "concepts": ["A concept from the transcript"],
  "chapters": [
    { "title": "Chapter title", "seconds": 180, "concepts": ["A concept from that part of the transcript"] }
  ],
  "flashcards": [{ "front": "Term", "back": "Meaning from the transcript" }],
  "quiz": [{
    "question": "Question from the transcript?",
    "correct": "Right answer",
    "wrong": ["Distractor", "Other distractor"],
    "why": "Short explanation from the transcript."
  }]
}
```

Use `watchOnly: true` and empty `flashcards`, `quiz`, and `chapters` when the transcript has no lesson. For a video of about 30 minutes or more, add chapters. `seconds` is approximate: where the topic shows up in the transcript, scaled to `lengthSeconds`. Aim for 8 to 12 cards and at least 5 questions on a substantial video, and fewer on a short promo.

Optional: append a GConf scenario. `video` must be an existing video id.

```json
{
  "situation": "A GConf situation grounded in the video.",
  "correct": "The move the video supports",
  "wrong": ["A poorer move", "Another poorer move"],
  "why": "Why that move follows the video.",
  "video": "VIDEO_ID"
}
```

Run `npm test` and `npm run build`. Counts in the interface come from the file, so a new video shows up without a code change. Ship it by merging to `main`.

Keep new text grounded in that video’s transcript. The file’s `howToExtend` note says the same thing in short form.

## GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs on every push to `main`. It installs dependencies, runs `npm test`, builds the site, and deploys `dist` to GitHub Pages.

Before the first deploy:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The next push to `main` (or a manual run of “Deploy GitHub Pages” from the Actions tab) publishes the site. The Pages URL is `https://crmn111.github.io/grok-course-trainer/`. Routes use hashes (`#/videos/CODaDnHwe2M`), so the host does not need a single-page redirect. Old `#/lessons` links open the video list.

If the deploy fails with a Pages source error, the setting in step 3 is still on “Deploy from a branch”. Switch it to GitHub Actions and re-run the workflow.
