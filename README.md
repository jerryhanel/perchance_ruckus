# Ruckus 50

Ruckus is a chat companion with an animated face. It's a single-page web app that runs in the browser: you type or talk to Ruckus, it replies in a conversational voice, and its on-screen face changes with the mood of the reply. It also handles a few everyday tools (dice, picking from a list, odds-or-evens, weather, and a movie/TV collection) and keeps your conversations in separate threads.

Ruckus is a personal project by Jerry Hanel. The personality profile in `src/config.js` is written for Jerry's own use.

## Features

- **Chat with an animated face.** The face cycles through emotion videos (happy, thinking, bored, sleepy, and more). After a stretch of inactivity it moves into bored and then sleepy states, and it wakes when you return.
- **Threads.** Conversations are saved locally in the browser (IndexedDB via Dexie). You can switch between threads, start a new one, delete one, or back up and restore a thread.
- **Thread backup and restore.** Backups are written to a private GitHub Gist using a personal access token you supply.
- **Speech.** Replies can be read aloud through an Edge TTS service, using the Microsoft Christopher (Neural) voice with emotion-based speech settings. A stop button silences playback.
- **Tools.** Ruckus can call these behind the scenes when your message asks for them:
  - Roll dice (for example, "roll 3d6+2").
  - Pick one item from a list you give it.
  - Decide "odds or evens" for a yes/no question.
  - Look up current weather and a 7-day forecast (Nova Scotia only, using browser location).
  - Search and manage a movie and TV collection.
- **Slash commands.** Direct commands for the movie and TV collection, for example `/movie add "Title" "Genre" "Franchise"`, `/movie search`, `/movie rate`, `/movie list`, `/tv add`, `/tv search`, and so on. Type `/movie ?` or `/tv ?` for help.
- **Themes.** Four built-in color themes: Dark Slate (default), Light Mode, Deep Ocean Blue, and Cyberpunk Purple.
- **Test modes.** Thread menu items that jump the face straight into bored, sleepy, sleep, or normal mode, for testing.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The chat page: menu bar, face panel, chat area, and input. Loads `src/app.js` as a module. |
| `src/app.js` | Startup: opens the database, applies the saved theme, loads threads, wires up buttons. |
| `src/ai.js` | Sends messages to the AI, handles streaming replies and tool calls, and generates thread names. |
| `src/commands.js` | Parses and runs the `/movie` and `/tv` slash commands. |
| `src/config.js` | Personality prompt, emotion lists, theme colors, and service URLs. |
| `src/face.js` | Face video playback, emotion changes, and the inactivity timers. |
| `src/speech.js` | Text-to-speech playback and text cleanup before speaking. |
| `src/threads.js` | Thread switching, creation, deletion, backup, and restore. |
| `src/settings.js` | The Settings dialog (theme and GitHub token). |
| `src/db.js` | IndexedDB schema (threads, messages, settings, and cached data). |
| `src/gist.js` | Reads and writes files in a GitHub Gist. |
| `src/ui.js` | Chat rendering, the menu bar, and mobile layout. |
| `src/tools/*.js` | The individual tools: dice, pick-one, odds-or-evens, weather, movie-tv. |
| `src/style.css` | Styles for the page and the themes. |
| `generator.pcjs` | The Perchance generator source. It wraps the app for the Perchance host and supplies the AI and helper plugins. |

## Running it

Ruckus needs a few things from its environment:

- **The Perchance host.** The AI plugin (`window.root.aiTextPlugin`) and the helper plugins come from the Perchance generator environment, which `generator.pcjs` describes. Without that host, chat replies won't work.
- **Optional: a GitHub token.** Thread backup and restore need a personal access token with the `gist` scope. Add it in **File → Settings**.
- **External services.** Face videos are loaded from `ruckus-faces` on GitHub. Speech uses an Edge TTS service configured in `src/config.js` (`EDGE_TTS_URL`). Weather and movie data come from the services the tools call.

Open `index.html` through the Perchance host to use it. To run the page outside Perchance, serve the folder with any static web server so the module imports work, then expect the AI and tools to be unavailable unless the host is present.

## Notes

- Conversations and settings are stored in your browser, not on a server. Clearing site data erases them, so use **Thread → Backup** if you want a copy.
- The personality prompt tells Ruckus not to invent details about Jerry. Anything outside the profile in `src/config.js` gets an "I don't know" answer.
