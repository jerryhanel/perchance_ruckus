import { RUCKUS_GIST_ID } from './config.js';

export async function readFromGist(pat, fileName) {
  try {
    const response = await fetch(`https://api.github.com/gists/${RUCKUS_GIST_ID}`, {
      headers: { 'Authorization': `Bearer ${pat}` }
    });
    const gistData = await response.json();
    const file = gistData.files[fileName];
    return file ? file.content : null;
  } catch (error) {
    console.error('Error reading from gist:', error);
    return null;
  }
}

export async function writeToGist(pat, fileName, content) {
  try {
    const response = await fetch(`https://api.github.com/gists/${RUCKUS_GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files: { [fileName]: { content } } })
    });
    return response.json();
  } catch (error) {
    console.error('Error writing to gist:', error);
    return null;
  }
}
