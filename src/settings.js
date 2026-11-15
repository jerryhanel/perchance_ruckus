import { db } from './db.js';
import { THEMES } from './config.js';

async function loadSavedTheme() {
  const settings = await db.misc.get('settings') || {};
  if (settings.theme && THEMES[settings.theme]) {
    const selectedTheme = THEMES[settings.theme];
    for (const [varName, varValue] of Object.entries(selectedTheme)) {
      document.documentElement.style.setProperty(varName, varValue);
    }
  }
}

async function saveTheme(themeName) {
  const settings = await db.misc.get('settings') || {};
  await db.misc.put({ key: 'settings', ...settings, theme: themeName });
}

export { loadSavedTheme, saveTheme };

export async function showSettings() {
  let prompt2 = window.prompt2;
  if (!prompt2 && window.root?.getPrompt2) {
    prompt2 = window.root.getPrompt2();
    window.prompt2 = prompt2;
  }

  if (!prompt2) {
    console.error('Settings not available. The prompt2 plugin may not have loaded yet.');
    return;
  }

  let currentTheme = 'Dark Slate';
  const currentBgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
  for (const [themeName, themeVars] of Object.entries(THEMES)) {
    if (themeVars['--bg-primary'] === currentBgColor) {
      currentTheme = themeName;
      break;
    }
  }

  const settings = await db.misc.get('settings') || {};

  const movieTvContainer = document.createElement('div');
  movieTvContainer.className = 'movieTvBox';

  const movieTvTitle = document.createElement('div');
  movieTvTitle.className = 'movieTvBox-title';
  movieTvTitle.textContent = 'Movie and TV Show Management';
  movieTvContainer.appendChild(movieTvTitle);

  const movieTvDesc = document.createElement('div');
  movieTvDesc.className = 'movieTvBox-description';
  movieTvDesc.textContent = 'Store your movie and TV show collections, and use AI to search and manage them.';
  movieTvContainer.appendChild(movieTvDesc);

  const githubLabel = document.createElement('div');
  githubLabel.className = 'movieTvBox-label';
  githubLabel.textContent = 'GitHub Gists API Key (PAT)';
  movieTvContainer.appendChild(githubLabel);

  const githubInput = document.createElement('input');
  githubInput.className = 'movieTvBox-input';
  githubInput.type = 'text';
  githubInput.placeholder = 'Get from https://github.com/settings/tokens (gist scope)';
  githubInput.value = settings.github_pat || '';
  githubInput.style.width = '90%';
  movieTvContainer.appendChild(githubInput);

  const ttsContainer = document.createElement('div');
  ttsContainer.className = 'movieTvBox';

  const ttsTitle = document.createElement('div');
  ttsTitle.className = 'movieTvBox-title';
  ttsTitle.textContent = 'Text-to-Speech (Edge TTS)';
  ttsContainer.appendChild(ttsTitle);

  const ttsDesc = document.createElement('div');
  ttsDesc.className = 'movieTvBox-description';
  ttsDesc.textContent = 'Voice: Microsoft Christopher (Neural) — powered by Edge TTS';
  ttsContainer.appendChild(ttsDesc);

  const ttsAutoLabel = document.createElement('label');
  ttsAutoLabel.className = 'movieTvBox-label';
  ttsAutoLabel.style.marginTop = '1rem';
  ttsAutoLabel.style.display = 'block';
  ttsAutoLabel.style.cursor = 'pointer';
  const ttsAutoCheckbox = document.createElement('input');
  ttsAutoCheckbox.type = 'checkbox';
  ttsAutoCheckbox.checked = settings.tts_auto_speak !== false;
  ttsAutoCheckbox.style.marginRight = '0.5rem';
  ttsAutoLabel.appendChild(ttsAutoCheckbox);
  ttsAutoLabel.appendChild(document.createTextNode('Automatically speak AI replies'));
  ttsContainer.appendChild(ttsAutoLabel);

  const announceLabel = document.createElement('label');
  announceLabel.className = 'movieTvBox-label';
  announceLabel.style.marginTop = '0.5rem';
  announceLabel.style.display = 'block';
  announceLabel.style.cursor = 'pointer';
  const announceCheckbox = document.createElement('input');
  announceCheckbox.type = 'checkbox';
  announceCheckbox.checked = settings.announce_tool_use !== false;
  announceCheckbox.style.marginRight = '0.5rem';
  announceLabel.appendChild(announceCheckbox);
  announceLabel.appendChild(document.createTextNode('Announce before looking something up (weather, movie list, etc.)'));
  ttsContainer.appendChild(announceLabel);

  const result = await prompt2({
    theme: {
      type: 'select',
      label: 'Theme',
      defaultValue: currentTheme,
      options: Object.keys(THEMES).map(name => ({
        value: name,
        content: name
      }))
    },
    movieTvSection: {
      type: 'none',
      html: movieTvContainer
    },
    ttsSection: {
      type: 'none',
      html: ttsContainer
    }
  }, {
    submitButtonText: 'Apply',
    cancelButtonText: 'Cancel'
  });

  if (result) {
    if (result.theme) {
      const selectedTheme = THEMES[result.theme];
      if (selectedTheme) {
        for (const [varName, varValue] of Object.entries(selectedTheme)) {
          document.documentElement.style.setProperty(varName, varValue);
        }
        await saveTheme(result.theme);
      }
    }
    const newGithubPat = githubInput.value.trim();
    settings.github_pat = newGithubPat || '';
    settings.tts_auto_speak = ttsAutoCheckbox.checked;
    settings.announce_tool_use = announceCheckbox.checked;
    await db.misc.put({
      key: 'settings',
      ...settings
    });
  }
}
