import { db } from './db.js';
import { state, dom } from './state.js';
import { speakText, maybeAutoSpeak } from './speech.js';
import { setFaceEmotion, resetInactivityTimer } from './face.js';
import { getSystemTimeContext } from './utils.js';

let _getAIResponseStream = null;

export function setAIResponseHandler(fn) {
  _getAIResponseStream = fn;
}

export async function loadThreads() {
  const threads = await db.threads.orderBy('lastActive').reverse().toArray();
  dom.threadSelect.innerHTML = '<option value="">+ New Thread</option>';
  threads.forEach(thread => {
    const option = document.createElement('option');
    option.value = thread.uuid;
    option.textContent = thread.name || 'Thread';
    dom.threadSelect.appendChild(option);
  });
}

export async function addInterimMessage(text) {
  if (!text || !state.currentThreadUuid) return;
  state.lastInterimMessageId = await db.messages.add({
    threadUuid: state.currentThreadUuid,
    role: 'ai',
    text,
    emotion: 'normal',
    timestamp: Date.now()
  });
  state.lastInterimMessageText = text;
  await loadMessages(state.currentThreadUuid);
  dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
  maybeAutoSpeak(text, 'normal', 'med');
}

export async function finalizeToolLoopResult(toolResult, emotion, intensity) {
  if (state.lastInterimMessageId) {
    const needsRerender = state.lastInterimMessageText !== toolResult;
    await db.messages.update(state.lastInterimMessageId, { emotion, text: toolResult });
    if (needsRerender) {
      await loadMessages(state.currentThreadUuid);
      dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
    }
    return { emotion, intensity, text: toolResult, alreadySaved: true };
  }
  await db.messages.add({
    threadUuid: state.currentThreadUuid,
    role: 'ai',
    text: toolResult,
    emotion,
    timestamp: Date.now()
  });
  await loadMessages(state.currentThreadUuid);
  dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
  maybeAutoSpeak(toolResult, emotion, intensity);
  return { emotion, intensity, text: toolResult, alreadySaved: true };
}

export async function loadMessages(threadUuid) {
  if (!threadUuid) {
    dom.chatHistory.textContent = '';
    dom.chatHistory.classList.add('empty');
    dom.resubmitContainer.innerHTML = '';
    return;
  }

  const messages = await db.messages.where('threadUuid').equals(threadUuid).toArray();
  dom.chatHistory.textContent = '';
  dom.chatHistory.classList.remove('empty');

  messages.forEach(msg => {
    const messageEl = createMessageElement(msg);
    dom.chatHistory.appendChild(messageEl);
  });

  const lastMessage = messages[messages.length - 1];
  dom.resubmitContainer.innerHTML = '';
  if (lastMessage && lastMessage.role === 'user' && !dom.sendBtn.disabled) {
    const btn = document.createElement('button');
    btn.id = 'resubmitBtn';
    btn.textContent = 'Resend';
    btn.onclick = resubmitResponse;
    dom.resubmitContainer.appendChild(btn);
  }

  dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
}

export async function resubmitResponse() {
  if (!state.currentThreadUuid || state.isWaitingForResponse) return;

  resetInactivityTimer();

  const messages = await db.messages.where('threadUuid').equals(state.currentThreadUuid).toArray();
  const lastMessage = messages[messages.length - 1];

  if (lastMessage && lastMessage.role === 'user') {
    state.isWaitingForResponse = true;
    dom.sendBtn.disabled = true;
    dom.resubmitContainer.innerHTML = '';

    try {
      const aiStreamResponse = await _getAIResponseStream(lastMessage.text);

      if (aiStreamResponse) {
        const { emotion, intensity, text: responseText } = aiStreamResponse;
        await setFaceEmotion(emotion, intensity);
        maybeAutoSpeak(responseText, emotion, intensity);
        await loadMessages(state.currentThreadUuid);

        setTimeout(async () => {
          await setFaceEmotion('normal');
        }, 3000);
      }
    } catch (error) {
      console.error('Resubmit error:', error);
      await db.messages.add({
        threadUuid: state.currentThreadUuid,
        role: 'ai',
        text: `Error generating response: ${error.message}`,
        emotion: 'normal',
        timestamp: Date.now()
      });
      await loadMessages(state.currentThreadUuid);
    } finally {
      state.isWaitingForResponse = false;
      dom.sendBtn.disabled = false;
      state.activeSignals = null;
      state.activeStreamObj = null;
      updateStopProcessingBtn();
    }
  }
}

export function createMessageElement(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.role}`;

  const timestamp = new Date(msg.timestamp);
  const timeStr = timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const bubbleDiv = document.createElement('div');
  bubbleDiv.style.position = 'relative';
  bubbleDiv.style.display = 'block';
  bubbleDiv.style.width = '90%';

  const bubble = document.createElement('div');
  bubble.className = 'messageBubble';
  bubble.innerHTML = marked.parse(msg.text);

  const timeEl = document.createElement('div');
  timeEl.className = 'messageTimestamp';
  timeEl.textContent = timeStr;

  const toolsDiv = document.createElement('div');
  toolsDiv.className = 'messageTools';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'messageDeleteBtn';
  deleteBtn.textContent = '🗑️';
  deleteBtn.onclick = async () => {
    await db.messages.delete(msg.id);
    await loadMessages(state.currentThreadUuid);
  };

  const editBtn = document.createElement('button');
  editBtn.className = 'messageDeleteBtn';
  editBtn.textContent = '✏️';
  editBtn.onclick = async () => {
    await enterEditMode(msg, bubble, bubbleDiv, timeEl, toolsDiv);
  };

  if (msg.role === 'ai') {
    const speakBtn = document.createElement('button');
    speakBtn.className = 'messageDeleteBtn';
    speakBtn.textContent = '🔊';
    speakBtn.title = 'Speak this message';
    speakBtn.onclick = () => speakText(msg.text, msg.emotion, msg.intensity);
    toolsDiv.appendChild(speakBtn);
  }

  toolsDiv.appendChild(editBtn);
  toolsDiv.appendChild(deleteBtn);

  bubbleDiv.appendChild(bubble);
  bubbleDiv.appendChild(toolsDiv);
  bubbleDiv.appendChild(timeEl);

  div.appendChild(bubbleDiv);

  return div;
}

async function enterEditMode(msg, bubble, bubbleDiv, timeEl, toolsDiv) {
  bubble.style.display = 'none';
  toolsDiv.style.display = 'none';

  const editBox = document.createElement('textarea');
  editBox.className = 'messageEditBox';
  editBox.value = msg.text || bubble.textContent;

  const editTools = document.createElement('div');
  editTools.className = 'messageEditTools';

  const autocompleteBtn = document.createElement('button');
  autocompleteBtn.className = 'messageEditBtn';
  autocompleteBtn.textContent = '➡️ Auto-complete';
  autocompleteBtn.onclick = async () => {
    await autocompleteFromMessage(msg, editBox.value);
  };

  editTools.appendChild(autocompleteBtn);

  bubbleDiv.insertBefore(editBox, timeEl);
  bubbleDiv.insertBefore(editTools, timeEl);

  editBox.focus();
  editBox.select();

  editBox.onblur = async () => {
    if (!editTools.contains(document.activeElement)) {
      await db.messages.update(msg.id, { text: editBox.value });
      await loadMessages(state.currentThreadUuid);
    }
  };
}

async function autocompleteFromMessage(msg, editedText) {
  if (!root?.aiTextPlugin) {
    console.error('AI plugin not available');
    return;
  }

  state.isWaitingForResponse = true;
  dom.sendBtn.disabled = true;
  state.activeSignals = { stop: false };
  updateStopProcessingBtn();
  await setFaceEmotion('thinking');

  try {
    const messages = await db.messages.where('threadUuid').equals(state.currentThreadUuid).toArray();
    const recentMessageCount = Math.floor(Math.random() * 3) + 2;
    const recentMessages = messages.slice(-recentMessageCount);
    const conversationContext = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.text}`)
      .join('\n');

    let continuationText = '';
    const systemTime = getSystemTimeContext();
    const streamObj = root.aiTextPlugin({
      instruction: `${systemTime}

Here is the conversation so far:
${conversationContext}

Continue this response naturally, adding more content. Do not repeat what's already written:

${editedText}`,
      startWith: editedText,
      onChunk: (data) => {
        continuationText += data.textChunk;
      }
    });
    state.activeStreamObj = streamObj;
    const result = await streamObj;

    if (result.stopReason !== 'error') {
      const fullText = editedText + continuationText.substring(editedText.length);
      await db.messages.update(msg.id, { text: fullText });
      await loadMessages(state.currentThreadUuid);
    }
  } catch (error) {
    console.error('Auto-complete error:', error);
  } finally {
    state.isWaitingForResponse = false;
    dom.sendBtn.disabled = false;
    state.activeSignals = null;
    state.activeStreamObj = null;
    updateStopProcessingBtn();
    await setFaceEmotion('normal');
  }
}

export function updateStopProcessingBtn() {
  const btn = document.getElementById('stopProcessingBtn');
  if (!btn) return;
  btn.classList.toggle('visible', state.isWaitingForResponse);
}

export function checkMobileLayout() {
  const isMobile = window.innerWidth <= 768;
  dom.videoToggleBtn.style.display = isMobile ? 'block' : 'none';
  if (!isMobile && dom.faceContainer.classList.contains('hidden')) {
    dom.faceContainer.classList.remove('hidden');
    dom.videoToggleBtn.textContent = '⬆️';
  }
}

export function toggleVideo() {
  if (dom.faceContainer.classList.contains('hidden')) {
    dom.faceContainer.classList.remove('hidden');
    dom.videoToggleBtn.textContent = '⬆️';
  } else {
    dom.faceContainer.classList.add('hidden');
    dom.videoToggleBtn.textContent = '⬇️';
  }
}

export function setupMenuBarDropdowns() {
  const menus = document.querySelectorAll('.menuBar .menu');

  function closeAllMenus() {
    menus.forEach(m => m.classList.remove('open'));
  }

  function openMenu(menuEl) {
    closeAllMenus();
    const dropdown = menuEl.querySelector('.dropdown');
    if (!dropdown) return;
    const rect = menuEl.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom}px`;
    dropdown.style.left = `${rect.left}px`;
    menuEl.classList.add('open');
  }

  menus.forEach(menuEl => {
    if (!menuEl.querySelector('.dropdown')) return;

    menuEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menuEl.classList.contains('open')) {
        menuEl.classList.remove('open');
      } else {
        openMenu(menuEl);
      }
    });
  });

  document.addEventListener('click', closeAllMenus);
  window.addEventListener('scroll', closeAllMenus, true);
  window.addEventListener('resize', closeAllMenus);
}
