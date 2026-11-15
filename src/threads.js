import { db, generateUUID } from './db.js';
import { state, dom } from './state.js';
import { loadMessages, loadThreads } from './ui.js';
import { resetInactivityTimer } from './face.js';
import { readFromGist, writeToGist } from './gist.js';

function getPrompt2() {
  let prompt2 = window.prompt2;
  if (!prompt2 && window.root?.getPrompt2) {
    prompt2 = window.root.getPrompt2();
    window.prompt2 = prompt2;
  }
  return prompt2;
}

export async function switchThread() {
  const prompt2 = getPrompt2();
  if (!prompt2) {
    console.error('Thread switcher not available.');
    return;
  }

  const threads = await db.threads.orderBy('lastActive').reverse().toArray();

  const threadSelect = document.createElement('select');
  threadSelect.style.width = '100%';
  threadSelect.style.padding = '0.5rem';
  threadSelect.style.backgroundColor = 'var(--bg-tertiary)';
  threadSelect.style.color = 'var(--text-primary)';
  threadSelect.style.border = '1px solid var(--border-color)';
  threadSelect.style.borderRadius = '4px';
  threadSelect.style.fontSize = '14px';

  const blankOption = document.createElement('option');
  blankOption.value = '';
  blankOption.textContent = '+ New Thread';
  threadSelect.appendChild(blankOption);

  threads.forEach(thread => {
    const option = document.createElement('option');
    option.value = thread.uuid;
    option.textContent = thread.name || 'Unnamed';
    threadSelect.appendChild(option);
  });

  if (state.currentThreadUuid) {
    threadSelect.value = state.currentThreadUuid;
  }

  const container = document.createElement('div');
  container.style.textAlign = 'center';
  container.appendChild(threadSelect);

  const result = await prompt2({
    message: {
      type: 'none',
      html: container
    }
  }, {
    submitButtonText: 'Switch',
    cancelButtonText: 'Cancel'
  });

  if (result) {
    const selectedUuid = threadSelect.value;
    if (selectedUuid === '') {
      await createNewThread();
    } else {
      state.currentThreadUuid = selectedUuid;
      await loadMessages(selectedUuid);
      const settings = await db.misc.get('settings') || {};
      await db.misc.put({
        key: 'settings',
        ...settings,
        lastThreadUuid: selectedUuid
      });
      resetInactivityTimer();
    }
  }
}

export async function createNewThread() {
  const threadUuid = generateUUID();
  const thread = {
    uuid: threadUuid,
    name: 'New Thread',
    createdAt: Date.now(),
    lastActive: Date.now()
  };
  await db.threads.add(thread);
  await loadThreads();
  state.currentThreadUuid = threadUuid;
  await loadMessages(threadUuid);
  resetInactivityTimer();
}

export async function deleteCurrentThread() {
  const prompt2 = getPrompt2();

  if (!state.currentThreadUuid) {
    if (prompt2) {
      await prompt2({
        message: {
          type: 'none',
          html: '<div style="text-align:center; color:var(--text-primary);">No thread selected</div>'
        }
      }, { cancelButtonText: null, submitButtonText: 'OK' });
    }
    return;
  }

  if (!prompt2) return;

  const result = await prompt2({
    message: {
      type: 'none',
      html: '<div style="text-align:center; color:var(--text-primary);">Are you sure you want to delete this thread? This cannot be undone.</div>'
    }
  }, {
    submitButtonText: 'Delete',
    cancelButtonText: 'Cancel'
  });

  if (!result) return;

  await db.messages.where('threadUuid').equals(state.currentThreadUuid).delete();
  await db.threads.delete(state.currentThreadUuid);

  state.currentThreadUuid = null;
  await loadThreads();
  dom.threadSelect.value = '';
  await loadMessages(null);
}

export async function backupThread() {
  const prompt2 = getPrompt2();

  if (!state.currentThreadUuid) {
    if (prompt2) {
      await prompt2({
        message: { type: 'none', html: '<div style="text-align:center; color:var(--text-primary);">No thread selected</div>' }
      }, { cancelButtonText: null, submitButtonText: 'OK' });
    }
    return;
  }

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    if (prompt2) {
      await prompt2({
        message: { type: 'none', html: '<div style="text-align:center; color:var(--text-primary);">GitHub PAT not configured. Go to File &gt; Settings.</div>' }
      }, { cancelButtonText: null, submitButtonText: 'OK' });
    }
    return;
  }

  try {
    const thread = await db.threads.get(state.currentThreadUuid);
    const messages = await db.messages.where('threadUuid').equals(state.currentThreadUuid).toArray();

    const backupData = {
      thread: {
        uuid: thread.uuid,
        name: thread.name,
        createdAt: thread.createdAt,
        lastActive: thread.lastActive
      },
      messages: messages,
      backupDate: new Date().toISOString()
    };

    await writeToGist(pat, 'ruckus-thread-backup.json', JSON.stringify(backupData, null, 2));

    if (prompt2) {
      await prompt2({
        message: { type: 'none', html: `<div style="text-align:center; color:var(--text-primary);">✓ Thread backed up: "${thread.name}" (${messages.length} messages)</div>` }
      }, { cancelButtonText: null, submitButtonText: 'OK' });
    }
  } catch (error) {
    console.error('Backup error:', error);
    if (prompt2) {
      await prompt2({
        message: { type: 'none', html: `<div style="text-align:center; color:var(--text-primary);">Error backing up thread: ${error.message}</div>` }
      }, { cancelButtonText: null, submitButtonText: 'OK' });
    }
  }
}

export async function restoreThread() {
  const prompt2 = getPrompt2();

  const settings = await db.misc.get('settings') || {};
  const pat = settings.github_pat;

  if (!pat) {
    if (prompt2) {
      await prompt2({
        message: { type: 'none', html: '<div style="text-align:center; color:var(--text-primary);">GitHub PAT not configured. Go to File &gt; Settings.</div>' }
      }, { cancelButtonText: null, submitButtonText: 'OK' });
    }
    return;
  }

  try {
    const backupJson = await readFromGist(pat, 'ruckus-thread-backup.json');

    if (!backupJson) {
      if (prompt2) {
        await prompt2({
          message: { type: 'none', html: '<div style="text-align:center; color:var(--text-primary);">No backup found. Backup a thread first using Thread &gt; Backup</div>' }
        }, { cancelButtonText: null, submitButtonText: 'OK' });
      }
      return;
    }

    const backupData = JSON.parse(backupJson);
    const threadData = backupData.thread;
    const threadExists = await db.threads.get(threadData.uuid);

    if (threadExists) {
      const result = await prompt2({
        message: { type: 'none', html: `<div style="text-align:center; color:var(--text-primary);">Thread "${threadData.name}" already exists. Overwrite?</div>` }
      }, { submitButtonText: 'Overwrite', cancelButtonText: 'Cancel' });
      if (!result) return;
      await db.messages.where('threadUuid').equals(threadData.uuid).delete();
      await db.threads.update(threadData.uuid, threadData);
    } else {
      await db.threads.add(threadData);
    }

    for (const msg of backupData.messages) {
      delete msg.id;
      await db.messages.add(msg);
    }

    state.currentThreadUuid = threadData.uuid;
    await loadThreads();
    dom.threadSelect.value = threadData.uuid;
    await loadMessages(threadData.uuid);

    if (prompt2) {
      await prompt2({
        message: { type: 'none', html: `<div style="text-align:center; color:var(--text-primary);">✓ Thread restored: "${threadData.name}" (${backupData.messages.length} messages)</div>` }
      }, { cancelButtonText: null, submitButtonText: 'OK' });
    }
  } catch (error) {
    console.error('Restore error:', error);
    if (prompt2) {
      await prompt2({
        message: { type: 'none', html: `<div style="text-align:center; color:var(--text-primary);">Error restoring thread: ${error.message}</div>` }
      }, { cancelButtonText: null, submitButtonText: 'OK' });
    }
  }
}
