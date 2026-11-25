# Grok course trainer

A static study app for the 23-lesson course built from the [Grok YouTube channel](https://www.youtube.com/@Grok). It is for Dirk, founder and CEO of GConf AI: lessons, flashcards, quizzes, four games, and progress that stays on the device.

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

- **Lessons.** All 23 lessons. Open one for the summary, core concepts, and source videos. A video plays in the page after you choose it. Flashcards, the lesson quiz, and Mark done sit on the lesson.
- **Flashcards.** One deck per lesson, plus a 20-card round of the weakest cards across the course. Flip a card, then choose Again or I knew it. Again brings the card back after a couple of others and clears its run. A card is mastered after two “I knew it” ratings in a row.
- **Quizzes.** Each lesson quiz shuffles the choices and explains the answer immediately. 80% or better marks that lesson done. The final exam is 20 random questions from the whole course; 80% passes the exam. The app keeps the best score.
- **Games.** Match terms to meanings (timed, misses count). Which lesson is this, for 60 seconds. GConf scenarios, all 20 situations. Straight or swapped, a 45-second call on whether a meaning belongs to the term.
- **Progress.** XP, level, daily streak, cards mastered, lessons done, a per-lesson table, and game bests. Reset asks you to confirm. Export writes a JSON file; import replaces progress on this device, which is how a backup moves between a Mac and an iPhone.
- **Install and offline.** `manifest.webmanifest` plus a service worker generated at build time. On iPhone use Share → Add to Home Screen. After one online visit, the trainer opens offline. YouTube playback still needs a network connection.
- **Theme.** The app follows the system light or dark setting. The header control switches to the opposite of what you see. Progress has System, Light, and Dark.

Progress is stored in `localStorage` under `grok-course-trainer-v1`. The theme is stored separately under `color-scheme`, so a progress reset does not change it.

## Add a lesson

Course content lives in [`src/course.json`](src/course.json). The app does not hard-code lesson text. To extend the course:

1. Add any new video to `videos`, keyed by its YouTube id:

   ```json
   "VIDEO_ID": {
     "title": "Video title",
     "duration": "12:00",
     "url": "https://www.youtube.com/watch?v=VIDEO_ID"
   }
   ```

2. Append one object to `lessons`. The `correct` field is the right quiz answer. `wrong` is the list of other choices. The app shuffles them.

   ```json
   {
     "lesson": 24,
     "title": "New lesson title",
     "videos": ["VIDEO_ID"],
     "summary": "One or two sentences from the source.",
     "concepts": ["A concept from the source"],
     "flashcards": [{ "front": "Term", "back": "Meaning" }],
     "quiz": [{
       "question": "Question from the source?",
       "correct": "Right answer",
       "wrong": ["Distractor", "Other distractor"],
       "why": "Short explanation from the source."
     }]
   }
   ```

3. Optional: append a GConf scenario. `lesson` must be an existing lesson number.

   ```json
   {
     "situation": "A GConf situation grounded in the lesson.",
     "correct": "The move the lesson supports",
     "wrong": ["A poorer move", "Another poorer move"],
     "why": "Why that move follows the lesson.",
     "lesson": 24
   }
   ```

4. Run `npm test` and `npm run build`. Lesson counts in the interface come from the file, so a new lesson shows up without a code change. Ship it by merging to `main`.

Keep new text grounded in a source video. The file’s `howToExtend` note says the same thing in short form.

## GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs on every push to `main`. It installs dependencies, runs `npm test`, builds the site, and deploys `dist` to GitHub Pages.

Before the first deploy:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The next push to `main` (or a manual run of “Deploy GitHub Pages” from the Actions tab) publishes the site. The Pages URL is `https://crmn111.github.io/grok-course-trainer/`. Routes use hashes (`#/lessons/4`), so the host does not need a single-page redirect.

If the deploy fails with a Pages source error, the setting in step 3 is still on “Deploy from a branch”. Switch it to GitHub Actions and re-run the workflow.
