import { db, openDbWithRecovery } from './db.js';
import { state, dom } from './state.js';
import { loadSavedTheme, showSettings } from './settings.js';
import { loadThreads, loadMessages, checkMobileLayout, toggleVideo, setupMenuBarDropdowns } from './ui.js';
import {
  setFaceEmotion, preloadAllVideos, resetInactivityTimer,
  testJumpToBoredMode, testJumpToSleepyMode,
  testJumpToSleepMode, testJumpToNormalMode
} from './face.js';
import { stopSpeaking } from './speech.js';
import { sendMessage, stopAIProcessing } from './ai.js';
import {
  switchThread, createNewThread, deleteCurrentThread,
  backupThread, restoreThread
} from './threads.js';

function setupEventListeners() {
  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  dom.sendBtn.addEventListener('click', sendMessage);
  document.getElementById('stopSpeakingBtn').addEventListener('click', stopSpeaking);
  document.getElementById('stopProcessingBtn').addEventListener('click', stopAIProcessing);
  dom.settingsBtn.addEventListener('click', showSettings);
  dom.switchThreadBtn.addEventListener('click', switchThread);
  dom.newThreadBtn.addEventListener('click', createNewThread);
  dom.deleteThreadBtn.addEventListener('click', deleteCurrentThread);
  dom.backupThreadBtn.addEventListener('click', backupThread);
  dom.restoreThreadBtn.addEventListener('click', restoreThread);
  dom.videoToggleBtn.addEventListener('click', toggleVideo);
  dom.testBoredBtn.addEventListener('click', testJumpToBoredMode);
  dom.testSleepyBtn.addEventListener('click', testJumpToSleepyMode);
  dom.testSleepBtn.addEventListener('click', testJumpToSleepMode);
  dom.testNormalBtn.addEventListener('click', testJumpToNormalMode);

  checkMobileLayout();
  window.addEventListener('resize', checkMobileLayout);

  setupMenuBarDropdowns();
}

async function initApp() {
  await openDbWithRecovery();
  await loadSavedTheme();
  await loadThreads();
  setupEventListeners();
  await setFaceEmotion('normal');

  preloadAllVideos().catch(err => console.error('Video preload failed:', err));

  const settings = await db.misc.get('settings') || {};
  if (settings.lastThreadUuid) {
    const threadExists = await db.threads.get(settings.lastThreadUuid);
    if (threadExists) {
      state.currentThreadUuid = settings.lastThreadUuid;
      dom.threadSelect.value = settings.lastThreadUuid;
      await loadMessages(settings.lastThreadUuid);
    }
  }

  let m = root.createAppMain();
  window.prompt2 = m.getPrompt2();

  resetInactivityTimer();
}

initApp();
