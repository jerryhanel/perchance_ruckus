import { db } from './db.js';
import { readFromGist, writeToGist } from './gist.js';

export async function processSlashCommand(text) {
  if (!text.startsWith('/')) return null;

  const parts = text.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();

  if (command === 'movie') {
    return await handleMovieCommand(text);
  } else if (command === 'tv') {
    return await handleTVCommand(text);
  }

  return null;
}

async function handleMovieCommand(text) {
  const match = text.match(/^\/movie\s+(\S*)\s*(.*)/i);
  if (!match) {
    return { error: 'Usage: /movie [add|search|rate|list|?]' };
  }

  const cmd = match[1].toLowerCase();
  const params = match[2].trim();

  if (cmd === 'add') return handleMovieAdd(params);
  if (cmd === 'search') return handleMovieSearch(params);
  if (cmd === 'rate') return handleMovieRate(params);
  if (cmd === 'delete' || cmd === 'remove') return handleMovieDelete(params);
  if (cmd === 'list') return handleMovieList();
  if (cmd === '?' || cmd === 'help') return handleMovieHelp();
  return { error: `Unknown movie command: ${cmd}` };
}

async function handleTVCommand(text) {
  const match = text.match(/^\/tv\s+(\S*)\s*(.*)/i);
  if (!match) {
    return { error: 'Usage: /tv [add|search|rate|list|?]' };
  }

  const cmd = match[1].toLowerCase();
  const params = match[2].trim();

  if (cmd === 'add') return handleTVAdd(params);
  if (cmd === 'search') return handleTVSearch(params);
  if (cmd === 'rate') return handleTVRate(params);
  if (cmd === 'delete' || cmd === 'remove') return handleTVDelete(params);
  if (cmd === 'list') return handleTVList();
  if (cmd === '?' || cmd === 'help') return handleTVHelp();
  return { error: `Unknown tv command: ${cmd}` };
}

async function handleMovieAdd(params) {
  const allMatches = params.match(/"([^"]*)"/g);

  if (!allMatches || allMatches.length < 3) {
    return { error: 'Usage: /movie add "Movie Title" "Type/Genre" "Franchise" "Optional notes"' };
  }

  const title = allMatches[0].slice(1, -1).trim();
  const type = allMatches[1].slice(1, -1).trim();
  const franchise = allMatches[2].slice(1, -1).trim();
  const notes = allMatches[3] ? allMatches[3].slice(1, -1).trim() : '';

  if (!title || !type || !franchise) {
    return { error: 'Usage: /movie add "Movie Title" "Type/Genre" "Franchise" "Optional notes"' };
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    let movies = [];
    const existing = await readFromGist(pat, 'movie-collection.json');
    if (existing) {
      movies = JSON.parse(existing);
    }

    if (movies.some(m => m.title.toLowerCase() === title.toLowerCase())) {
      return { error: `"${title}" already in collection` };
    }

    movies.push({
      title,
      type,
      notes,
      franchise,
      rating: null,
      dateAdded: new Date().toISOString().split('T')[0]
    });

    await writeToGist(pat, 'movie-collection.json', JSON.stringify(movies, null, 2));
    return { success: `Added "${title}" (${type}) to ${franchise} (${movies.length} total)` };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

async function handleMovieSearch(params) {
  const allMatches = params.match(/"([^"]*)"/g);

  if (!allMatches || allMatches.length < 1) {
    return { error: 'Usage: /movie search "title" rating-range "type"\nExample: /movie search "Star Wars" 7-10 "Sci-fi"' };
  }

  const titleQuery = allMatches[0].slice(1, -1).trim().toLowerCase();
  const typeQuery = allMatches[1] ? allMatches[1].slice(1, -1).trim().toLowerCase() : '';

  let minRating = null, maxRating = null;
  const ratingStr = params.match(/\s(\d*-?\d*)\s/);
  if (ratingStr && ratingStr[1] && ratingStr[1] !== '-') {
    const parts = ratingStr[1].split('-');
    if (parts[0]) minRating = parseInt(parts[0]);
    if (parts[1]) maxRating = parseInt(parts[1]);
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    const existing = await readFromGist(pat, 'movie-collection.json');
    if (!existing) {
      return { info: 'No movies in collection yet' };
    }

    const movies = JSON.parse(existing);

    const results = movies.filter(m => {
      if (titleQuery && !m.title.toLowerCase().includes(titleQuery)) return false;
      if (typeQuery && !m.type.toLowerCase().includes(typeQuery)) return false;
      if (m.rating !== null) {
        if (minRating !== null && m.rating < minRating) return false;
        if (maxRating !== null && m.rating > maxRating) return false;
      } else if (minRating !== null || maxRating !== null) {
        return false;
      }
      return true;
    });

    if (results.length === 0) {
      const filters = [];
      if (titleQuery) filters.push(`title "${titleQuery}"`);
      if (minRating || maxRating) {
        const range = `${minRating || '—'}-${maxRating || '—'}`;
        filters.push(`rating ${range}`);
      }
      if (typeQuery) filters.push(`type "${typeQuery}"`);
      return { info: `No movies found matching: ${filters.join(', ')}` };
    }

    let output = `Found ${results.length} movie(s):\n\n`;
    results.forEach((m, i) => {
      output += `${i + 1}. **${m.title}** (${m.type})`;
      if (m.rating) output += ` - Rating: ${m.rating}/10`;
      if (m.notes) output += ` - ${m.notes}`;
      output += '\n';
    });

    return { success: output };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

async function handleMovieList() {
  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    const existing = await readFromGist(pat, 'movie-collection.json');
    if (!existing) {
      return { info: 'No movies in collection yet' };
    }

    const movies = JSON.parse(existing);

    if (movies.length === 0) {
      return { info: 'No movies in collection yet' };
    }

    const byFranchise = {};
    movies.forEach(m => {
      if (!byFranchise[m.franchise]) {
        byFranchise[m.franchise] = [];
      }
      byFranchise[m.franchise].push(m);
    });

    let output = `# Movie Collection (${movies.length} total)\n\n`;

    Object.keys(byFranchise).sort().forEach(franchise => {
      output += `## ${franchise}\n\n`;
      output += '| Title | Type | Rating | Notes |\n';
      output += '|-------|------|--------|-------|\n';

      byFranchise[franchise].sort((a, b) => a.title.localeCompare(b.title)).forEach(m => {
        const title = m.title.replace(/\|/g, '\\|');
        const type = (m.type || '—').replace(/\|/g, '\\|');
        const rating = m.rating ? `${m.rating}/10` : '—';
        const notes = m.notes ? m.notes.replace(/\|/g, '\\|') : '—';
        output += `| ${title} | ${type} | ${rating} | ${notes} |\n`;
      });

      output += '\n';
    });

    return { success: output };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

async function handleMovieRate(params) {
  const allMatches = params.match(/"([^"]+)"/g);
  const ratingMatch = params.match(/\s(\d+)\s/);

  if (!allMatches || allMatches.length < 1 || !ratingMatch) {
    return { error: 'Usage: /movie rate "Movie Title" 1-10 "Optional notes"' };
  }

  const title = allMatches[0].slice(1, -1).trim();
  const rating = parseInt(ratingMatch[1]);
  const notes = allMatches[1] ? allMatches[1].slice(1, -1).trim() : '';

  if (rating < 1 || rating > 10) {
    return { error: 'Rating must be between 1 and 10' };
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    const existing = await readFromGist(pat, 'movie-collection.json');
    if (!existing) {
      return { error: 'No movies in collection' };
    }

    const movies = JSON.parse(existing);
    const movie = movies.find(m => m.title.toLowerCase() === title.toLowerCase());

    if (!movie) {
      return { error: `"${title}" not found in collection` };
    }

    movie.rating = rating;
    if (notes) movie.notes = notes;
    movie.dateRated = new Date().toISOString().split('T')[0];

    await writeToGist(pat, 'movie-collection.json', JSON.stringify(movies, null, 2));
    return { success: `Rated "${title}" ${rating}/10` + (notes ? ` - ${notes}` : '') };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

async function handleMovieDelete(params) {
  const allMatches = params.match(/"([^"]*)"/g);
  const title = allMatches ? allMatches[0].slice(1, -1).trim() : params.trim();

  if (!title) {
    return { error: 'Usage: /movie delete "Movie Title"' };
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    const existing = await readFromGist(pat, 'movie-collection.json');
    if (!existing) {
      return { error: 'No movies in collection' };
    }

    const movies = JSON.parse(existing);
    const index = movies.findIndex(m => m.title.toLowerCase() === title.toLowerCase());

    if (index === -1) {
      return { error: `"${title}" not found in collection` };
    }

    const [removed] = movies.splice(index, 1);

    await writeToGist(pat, 'movie-collection.json', JSON.stringify(movies, null, 2));
    return { success: `Removed "${removed.title}" from collection (${movies.length} remaining)` };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

function handleMovieHelp() {
  const help = `# /movie Command Reference

**Add a movie:**
\`/movie add "Movie Title" "Type/Genre" "Franchise" "Optional notes"\`

**Search movies:**
\`/movie search "title substring or empty" rating-range "type substring or empty"\`
Examples:
- \`/movie search "Star Wars" 7-10 "Sci-fi"\` — Star Wars, rated 7-10, Sci-fi
- \`/movie search "" - "Action"\` — all Action movies
- \`/movie search "Batman" 8- ""\` — Batman movies rated 8+

**Rate a movie:**
\`/movie rate "Movie Title" 1-10 "Optional notes"\`

**Delete a movie:**
\`/movie delete "Movie Title"\`

**List all movies:**
\`/movie list\` — shows all movies grouped by franchise

**Show this help:**
\`/movie ?\` or \`/movie help\``;
  return { success: help };
}

async function handleTVAdd(params) {
  const allMatches = params.match(/"([^"]*)"/g);

  if (!allMatches || allMatches.length < 3) {
    return { error: 'Usage: /tv add "Title" "Type" "Season"' };
  }

  const title = allMatches[0].slice(1, -1).trim();
  const type = allMatches[1].slice(1, -1).trim();
  const season = allMatches[2].slice(1, -1).trim();

  if (!title || !type || !season) {
    return { error: 'Usage: /tv add "Title" "Type" "Season"' };
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    let shows = [];
    const existing = await readFromGist(pat, 'tv-collection.json');
    if (existing) {
      shows = JSON.parse(existing);
    }

    if (shows.some(s => s.title.toLowerCase() === title.toLowerCase())) {
      return { error: `"${title}" already in collection` };
    }

    shows.push({
      title,
      type,
      mostRecentSeason: season,
      rating: null,
      notes: '',
      dateAdded: new Date().toISOString().split('T')[0]
    });

    await writeToGist(pat, 'tv-collection.json', JSON.stringify(shows, null, 2));
    return { success: `Added "${title}" (${type}, season ${season}) to collection (${shows.length} total)` };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

async function handleTVSearch(params) {
  const allMatches = params.match(/"([^"]*)"/g);

  if (!allMatches || allMatches.length < 1) {
    return { error: 'Usage: /tv search "title" rating-range "type"\nExample: /tv search "Star" 8-10 "Sci-fi"' };
  }

  const titleQuery = allMatches[0].slice(1, -1).trim().toLowerCase();
  const typeQuery = allMatches[1] ? allMatches[1].slice(1, -1).trim().toLowerCase() : '';

  let minRating = null, maxRating = null;
  const ratingStr = params.match(/\s(\d*-?\d*)\s/);
  if (ratingStr && ratingStr[1] && ratingStr[1] !== '-') {
    const parts = ratingStr[1].split('-');
    if (parts[0]) minRating = parseInt(parts[0]);
    if (parts[1]) maxRating = parseInt(parts[1]);
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    const existing = await readFromGist(pat, 'tv-collection.json');
    if (!existing) {
      return { info: 'No TV shows in collection yet' };
    }

    const shows = JSON.parse(existing);
    const results = shows.filter(s => {
      if (titleQuery && !s.title.toLowerCase().includes(titleQuery)) return false;
      if (typeQuery && !s.type.toLowerCase().includes(typeQuery)) return false;
      if (s.rating !== null) {
        if (minRating !== null && s.rating < minRating) return false;
        if (maxRating !== null && s.rating > maxRating) return false;
      } else if (minRating !== null || maxRating !== null) {
        return false;
      }
      return true;
    });

    if (results.length === 0) {
      const filters = [];
      if (titleQuery) filters.push(`title "${titleQuery}"`);
      if (minRating || maxRating) {
        const range = `${minRating || '—'}-${maxRating || '—'}`;
        filters.push(`rating ${range}`);
      }
      if (typeQuery) filters.push(`type "${typeQuery}"`);
      return { info: `No shows found matching: ${filters.join(', ')}` };
    }

    let output = `Found ${results.length} show(s):\n\n`;
    results.forEach((s, i) => {
      output += `${i + 1}. **${s.title}** (${s.type})`;
      output += ` - Season: ${s.mostRecentSeason}`;
      if (s.rating) output += ` - Rating: ${s.rating}/10`;
      if (s.notes) output += ` - ${s.notes}`;
      output += '\n';
    });

    return { success: output };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

async function handleTVRate(params) {
  const allMatches = params.match(/"([^"]*)"/g);
  const ratingMatch = params.match(/\s(\d+)\s/);

  if (!allMatches || allMatches.length < 1 || !ratingMatch) {
    return { error: 'Usage: /tv rate "Title" 1-10 "Optional notes"' };
  }

  const title = allMatches[0].slice(1, -1).trim();
  const rating = parseInt(ratingMatch[1]);
  const notes = allMatches[1] ? allMatches[1].slice(1, -1).trim() : '';

  if (rating < 1 || rating > 10) {
    return { error: 'Rating must be between 1 and 10' };
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    const existing = await readFromGist(pat, 'tv-collection.json');
    if (!existing) {
      return { error: 'No shows in collection' };
    }

    const shows = JSON.parse(existing);
    const show = shows.find(s => s.title.toLowerCase() === title.toLowerCase());

    if (!show) {
      return { error: `"${title}" not found in collection` };
    }

    show.rating = rating;
    if (notes) show.notes = notes;
    show.dateRated = new Date().toISOString().split('T')[0];

    await writeToGist(pat, 'tv-collection.json', JSON.stringify(shows, null, 2));
    return { success: `Rated "${title}" ${rating}/10` + (notes ? ` - ${notes}` : '') };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

async function handleTVDelete(params) {
  const allMatches = params.match(/"([^"]*)"/g);
  const title = allMatches ? allMatches[0].slice(1, -1).trim() : params.trim();

  if (!title) {
    return { error: 'Usage: /tv delete "Title"' };
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    const existing = await readFromGist(pat, 'tv-collection.json');
    if (!existing) {
      return { error: 'No shows in collection' };
    }

    const shows = JSON.parse(existing);
    const index = shows.findIndex(s => s.title.toLowerCase() === title.toLowerCase());

    if (index === -1) {
      return { error: `"${title}" not found in collection` };
    }

    const [removed] = shows.splice(index, 1);

    await writeToGist(pat, 'tv-collection.json', JSON.stringify(shows, null, 2));
    return { success: `Removed "${removed.title}" from collection (${shows.length} remaining)` };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

async function handleTVList() {
  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    return { error: 'GitHub PAT not configured. Go to File > Settings.' };
  }

  try {
    const existing = await readFromGist(pat, 'tv-collection.json');
    if (!existing) {
      return { info: 'No TV shows in collection yet' };
    }

    const shows = JSON.parse(existing);

    if (shows.length === 0) {
      return { info: 'No TV shows in collection yet' };
    }

    let output = `# TV Series Collection (${shows.length} total)\n\n`;
    output += '| Title | Type | Season | Rating |\n';
    output += '|-------|------|--------|--------|\n';

    shows.sort((a, b) => a.title.localeCompare(b.title)).forEach(s => {
      const title = s.title.replace(/\|/g, '\\|');
      const type = (s.type || '—').replace(/\|/g, '\\|');
      const season = (s.mostRecentSeason || '—').replace(/\|/g, '\\|');
      const rating = s.rating ? `${s.rating}/10` : '—';
      output += `| ${title} | ${type} | ${season} | ${rating} |\n`;
    });

    return { success: output };
  } catch (error) {
    return { error: `Error: ${error.message}` };
  }
}

function handleTVHelp() {
  const help = `# /tv Command Reference

**Add a show:**
\`/tv add "Title" "Type" "Season"\`

**Search shows:**
\`/tv search "title" rating-range "type"\`
Examples:
- \`/tv search "Star" 8-10 "Sci-fi"\` — Star shows, rated 8-10, Sci-fi
- \`/tv search "" - "Comedy"\` — all Comedy shows
- \`/tv search "The" 9- ""\` — The... shows rated 9+

**Rate a show:**
\`/tv rate "Title" 1-10 "Optional notes"\`

**Delete a show:**
\`/tv delete "Title"\`

**List all shows:**
\`/tv list\` — shows all shows alphabetically

**Show this help:**
\`/tv ?\` or \`/tv help\``;
  return { success: help };
}
