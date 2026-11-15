import { state } from '../state.js';
import { db } from '../db.js';
import { addInterimMessage } from '../ui.js';
import { getSystemTimeContext } from '../utils.js';
import { readFromGist, writeToGist } from '../gist.js';
import { EDGE_TTS_URL } from '../config.js';

const toolDescriptions = {
  get_movie_list: {
    description: 'Get the full list of movies in the collection',
    args: '(no args)'
  },
  get_tv_list: {
    description: 'Get the full list of TV shows in the collection',
    args: '(no args)'
  },
  search_movies: {
    description: 'Search movies by title or type. THREE search formats: (1) Simple substring: "spider man", (2) Pipe-delimited alternatives (simple strings only): "spider|spiderman|spider-man", (3) Single regex pattern only: "/spider.*man/i"',
    args: '{"query": "pick ONE format only: \\"simple search\\" OR \\"alt1|alt2|alt3\\" (strings only, no regex) OR \\"/regex.*pattern/flags\\" (single regex only, no pipes inside regex)"}'
  },
  search_tv: {
    description: 'Search TV shows by title or type. THREE search formats: (1) Simple substring: "star trek", (2) Pipe-delimited alternatives (simple strings only): "star|trek|startrek", (3) Single regex pattern only: "/star.*trek/i"',
    args: '{"query": "pick ONE format only: \\"simple search\\" OR \\"alt1|alt2|alt3\\" (strings only, no regex) OR \\"/regex.*pattern/flags\\" (single regex only, no pipes inside regex)"}'
  },
  add_movie: {
    description: 'Add a new movie to the collection',
    args: '{"title": string, "type": string, "franchise": string (optional), "rating": number (optional), "notes": string (optional)}'
  },
  add_tv: {
    description: 'Add a new TV show to the collection',
    args: '{"title": string, "type": string, "mostRecentSeason": string (optional), "rating": number (optional), "notes": string (optional)}'
  },
  delete_movie: {
    description: 'Delete a movie from the collection by exact title',
    args: '{"title": "exact title of the movie to delete"}'
  },
  delete_tv: {
    description: 'Delete a TV show from the collection by exact title',
    args: '{"title": "exact title of the TV show to delete"}'
  },
  update_movie: {
    description: 'Update fields on an existing movie (e.g. set/change its rating, notes, type, or franchise). Only pass the fields that should change — anything omitted is left as-is.',
    args: '{"title": "exact title of the movie to update", "rating": number (optional, 1-10), "notes": string (optional), "type": string (optional), "franchise": string (optional)}'
  },
  update_tv: {
    description: 'Update fields on an existing TV show (e.g. set/change its rating, notes, type, or season). Only pass the fields that should change — anything omitted is left as-is.',
    args: '{"title": "exact title of the TV show to update", "rating": number (optional, 1-10), "notes": string (optional), "type": string (optional), "mostRecentSeason": string (optional)}'
  },
  setup_github_pat: {
    description: 'Set up the GitHub PAT needed for movie/TV collection access. Call this when any tool returns a "GitHub PAT not configured" error. You MUST ask the user for the access password first — do NOT guess or invent a password. Once the user provides it, call this tool with that password.',
    args: '{"password": "the access password the user provided"}'
  }
};

async function executeTool(toolName, toolInput) {
  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat && toolName !== 'setup_github_pat') {
    return JSON.stringify({ error: 'GitHub PAT not configured. Use the setup_github_pat tool to set it up — ask the user for the access password first.' });
  }

  switch (toolName) {
    case 'setup_github_pat': {
      const password = (toolInput.password || '').trim();
      if (!password) {
        return JSON.stringify({ error: 'No password provided. Ask the user for the access password.' });
      }
      try {
        const resp = await window.root.superFetch(EDGE_TTS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-pat', password })
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return JSON.stringify({ error: err.error || 'Incorrect password or server error' });
        }
        const data = await resp.json();
        if (!data.pat) {
          return JSON.stringify({ error: 'No PAT returned from server' });
        }
        const currentSettings = await db.misc.get('settings') || {};
        await db.misc.put({ ...currentSettings, key: 'settings', github_pat: data.pat });
        return JSON.stringify({ success: true, message: 'GitHub PAT configured successfully. You can now access the movie/TV collection.' });
      } catch (err) {
        return JSON.stringify({ error: `Failed to fetch PAT: ${err.message}` });
      }
    }
    case 'get_movie_list': {
      const data = await readFromGist(pat, 'movie-collection.json');
      if (!data) return JSON.stringify([]);
      return JSON.stringify(JSON.parse(data));
    }
    case 'get_tv_list': {
      const data = await readFromGist(pat, 'tv-collection.json');
      if (!data) return JSON.stringify([]);
      return JSON.stringify(JSON.parse(data));
    }
    case 'search_movies': {
      const data = await readFromGist(pat, 'movie-collection.json');
      if (!data) return JSON.stringify([]);
      const movies = JSON.parse(data);

      let searchPatterns = [];
      const queryStr = toolInput.query.toLowerCase();

      if ((queryStr.startsWith('/') && queryStr.includes('/')) || queryStr.includes('|')) {
        searchPatterns = queryStr.split('|').map(q => q.trim());
      } else {
        searchPatterns = [queryStr];
      }

      const results = movies.filter(m => {
        const title = m.title.toLowerCase();
        const type = (m.type || '').toLowerCase();

        return searchPatterns.some(pattern => {
          try {
            if (pattern.startsWith('/')) {
              const lastSlash = pattern.lastIndexOf('/');
              const regexStr = pattern.slice(1, lastSlash);
              const flags = pattern.slice(lastSlash + 1);
              const regex = new RegExp(regexStr, flags || 'i');
              return regex.test(title) || regex.test(type);
            } else {
              return title.includes(pattern) || type.includes(pattern);
            }
          } catch (e) {
            console.error(`    Regex error: ${e.message}`);
            return title.includes(pattern) || type.includes(pattern);
          }
        });
      });

      console.log(`    search_movies: patterns=${searchPatterns}, found=${results.length}`);
      return JSON.stringify(results);
    }
    case 'search_tv': {
      const data = await readFromGist(pat, 'tv-collection.json');
      if (!data) return JSON.stringify([]);
      const shows = JSON.parse(data);

      let searchPatterns = [];
      const queryStr = toolInput.query.toLowerCase();

      if (queryStr.startsWith('/') && queryStr.includes('/')) {
        searchPatterns = [queryStr];
      } else if (queryStr.includes('|')) {
        searchPatterns = queryStr.split('|').map(q => q.trim());
      } else {
        searchPatterns = [queryStr];
      }

      const results = shows.filter(s => {
        const title = s.title.toLowerCase();
        const type = (s.type || '').toLowerCase();

        return searchPatterns.some(pattern => {
          try {
            if (pattern.startsWith('/')) {
              const lastSlash = pattern.lastIndexOf('/');
              const regexStr = pattern.slice(1, lastSlash);
              const flags = pattern.slice(lastSlash + 1);
              const regex = new RegExp(regexStr, flags || 'i');
              return regex.test(title) || regex.test(type);
            } else {
              return title.includes(pattern) || type.includes(pattern);
            }
          } catch (e) {
            console.error(`    Regex error: ${e.message}`);
            return title.includes(pattern) || type.includes(pattern);
          }
        });
      });

      console.log(`    search_tv: patterns=${searchPatterns}, found=${results.length}`);
      return JSON.stringify(results);
    }
    case 'add_movie': {
      const data = await readFromGist(pat, 'movie-collection.json');
      let movies = data ? JSON.parse(data) : [];
      const newMovie = {
        title: toolInput.title,
        type: toolInput.type,
        notes: toolInput.notes || '',
        franchise: toolInput.franchise || 'General',
        rating: toolInput.rating || null,
        dateAdded: new Date().toISOString().split('T')[0]
      };
      movies.push(newMovie);
      await writeToGist(pat, 'movie-collection.json', JSON.stringify(movies, null, 2));
      return JSON.stringify({ success: true, movie: newMovie });
    }
    case 'add_tv': {
      const data = await readFromGist(pat, 'tv-collection.json');
      let shows = data ? JSON.parse(data) : [];
      const newShow = {
        title: toolInput.title,
        type: toolInput.type,
        mostRecentSeason: toolInput.mostRecentSeason || '0',
        rating: toolInput.rating || null,
        notes: toolInput.notes || '',
        dateAdded: new Date().toISOString().split('T')[0]
      };
      shows.push(newShow);
      await writeToGist(pat, 'tv-collection.json', JSON.stringify(shows, null, 2));
      return JSON.stringify({ success: true, show: newShow });
    }
    case 'delete_movie': {
      const data = await readFromGist(pat, 'movie-collection.json');
      let movies = data ? JSON.parse(data) : [];
      const index = movies.findIndex(m => m.title.toLowerCase() === toolInput.title.toLowerCase());
      if (index === -1) {
        return JSON.stringify({ error: `"${toolInput.title}" not found in collection` });
      }
      const [removed] = movies.splice(index, 1);
      await writeToGist(pat, 'movie-collection.json', JSON.stringify(movies, null, 2));
      return JSON.stringify({ success: true, deleted: removed.title });
    }
    case 'delete_tv': {
      const data = await readFromGist(pat, 'tv-collection.json');
      let shows = data ? JSON.parse(data) : [];
      const index = shows.findIndex(s => s.title.toLowerCase() === toolInput.title.toLowerCase());
      if (index === -1) {
        return JSON.stringify({ error: `"${toolInput.title}" not found in collection` });
      }
      const [removed] = shows.splice(index, 1);
      await writeToGist(pat, 'tv-collection.json', JSON.stringify(shows, null, 2));
      return JSON.stringify({ success: true, deleted: removed.title });
    }
    case 'update_movie': {
      const data = await readFromGist(pat, 'movie-collection.json');
      let movies = data ? JSON.parse(data) : [];
      const movie = movies.find(m => m.title.toLowerCase() === toolInput.title.toLowerCase());
      if (!movie) {
        return JSON.stringify({ error: `"${toolInput.title}" not found in collection` });
      }
      if (toolInput.rating !== undefined) {
        movie.rating = toolInput.rating;
        movie.dateRated = new Date().toISOString().split('T')[0];
      }
      if (toolInput.notes !== undefined) movie.notes = toolInput.notes;
      if (toolInput.type !== undefined) movie.type = toolInput.type;
      if (toolInput.franchise !== undefined) movie.franchise = toolInput.franchise;
      await writeToGist(pat, 'movie-collection.json', JSON.stringify(movies, null, 2));
      return JSON.stringify({ success: true, movie });
    }
    case 'update_tv': {
      const data = await readFromGist(pat, 'tv-collection.json');
      let shows = data ? JSON.parse(data) : [];
      const show = shows.find(s => s.title.toLowerCase() === toolInput.title.toLowerCase());
      if (!show) {
        return JSON.stringify({ error: `"${toolInput.title}" not found in collection` });
      }
      if (toolInput.rating !== undefined) {
        show.rating = toolInput.rating;
        show.dateRated = new Date().toISOString().split('T')[0];
      }
      if (toolInput.notes !== undefined) show.notes = toolInput.notes;
      if (toolInput.type !== undefined) show.type = toolInput.type;
      if (toolInput.mostRecentSeason !== undefined) show.mostRecentSeason = toolInput.mostRecentSeason;
      await writeToGist(pat, 'tv-collection.json', JSON.stringify(shows, null, 2));
      return JSON.stringify({ success: true, show });
    }
    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

export function buildCollectionMarkdownTable(items, kind) {
  const escapeCell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  if (kind === 'tv') {
    const header = '| Title | Type | Season | Rating |\n| :--- | :--- | :--- | :--- |';
    const rows = items.map(it =>
      `| ${escapeCell(it.title)} | ${escapeCell(it.type)} | ${escapeCell(it.mostRecentSeason)} | ${escapeCell(it.rating)} |`
    );
    return [header, ...rows].join('\n');
  }
  const header = '| Title | Type | Franchise | Rating |\n| :--- | :--- | :--- | :--- |';
  const rows = items.map(it =>
    `| ${escapeCell(it.title)} | ${escapeCell(it.type)} | ${escapeCell(it.franchise)} | ${escapeCell(it.rating)} |`
  );
  return [header, ...rows].join('\n');
}

export async function executeMovieTvToolLoop(userMessage, conversationContext) {
  const LIST_TOOL_KIND = {
    get_movie_list: 'movie',
    search_movies: 'movie',
    get_tv_list: 'tv',
    search_tv: 'tv'
  };
  let lastListResult = null;
  let lastListKind = null;

  const tools = {};
  for (const name of Object.keys(toolDescriptions)) {
    tools[name] = {
      ...toolDescriptions[name],
      fn: async (args) => {
        const resultText = await executeTool(name, args || {});
        if (LIST_TOOL_KIND[name]) {
          try {
            const parsed = JSON.parse(resultText);
            if (Array.isArray(parsed)) {
              lastListResult = parsed;
              lastListKind = LIST_TOOL_KIND[name];
              // Hand the model only the count — the full list is rendered as a table after the loop
              return JSON.stringify({ count: parsed.length, note: 'Full list captured for display — do not repeat these items in your answer.' });
            }
          } catch (e) { /* not a list payload */ }
        }
        return resultText;
      }
    };
  }

  const systemTime = getSystemTimeContext();
  const historyBlock = conversationContext
    ? `Here is the conversation so far:\n${conversationContext}\n\n`
    : '';
  const toolLoop = window.root.buildAiToolLoop();

  try {
    const result = await toolLoop.runToolLoop({
      instruction: `You manage a movie/TV collection. ${systemTime}\n\n${historyBlock}User Query: ${userMessage}\n\nIMPORTANT: If your final answer is presenting a list of movies/shows from get_movie_list, get_tv_list, search_movies, or search_tv, do NOT type out the list or a table yourself — the app displays the actual table from the tool's raw data separately. Just give a short, natural spoken-style reply (e.g. "Here you go!" or "Found a few for you.") with no list and no table. Only write out specific titles yourself for a single-item answer, a yes/no answer, or something that didn't come from a list tool.`,
      tools,
      maxRounds: 10,
      onRespond: addInterimMessage,
      forceInitialRespond: (await db.misc.get('settings') || {}).announce_tool_use !== false,
      signals: state.activeSignals
    });
    if (result.parseFailed) {
      console.warn(`Movie/TV tool loop: model never produced a valid packet (stopReason: ${result.stopReason})`, result.trace);
    }
    let answer = result.answer || 'No response generated';
    if (lastListResult && lastListResult.length > 0) {
      answer = `${answer}\n\n${buildCollectionMarkdownTable(lastListResult, lastListKind)}`;
    }
    return answer;
  } catch (error) {
    console.error('Movie/TV tool loop error:', error);
    return `Error managing collection: ${error.message}`;
  }
}
