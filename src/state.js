export const state = {
  currentThreadUuid: null,
  isWaitingForResponse: false,
  activeSignals: null,
  activeStreamObj: null,
  inactivityTimerId: null,
  lastActivityTime: Date.now(),
  currentInactivityMode: null,
  isPlayingInactivityVideo: false,
  nextInactivityVideoTimeout: null,
  lastInterimMessageId: null,
  lastInterimMessageText: null,
};

export const faceVideo = document.getElementById('faceVideo');
export const threadSelect = document.getElementById('threadSelect');
export const chatHistory = document.getElementById('chatHistory');
export const messageInput = document.getElementById('messageInput');
export const sendBtn = document.getElementById('sendBtn');
export const resubmitContainer = document.getElementById('resubmitContainer');
export const settingsBtn = document.getElementById('settingsBtn');
export const switchThreadBtn = document.getElementById('switchThreadBtn');
export const newThreadBtn = document.getElementById('newThreadBtn');
export const deleteThreadBtn = document.getElementById('deleteThreadBtn');
export const backupThreadBtn = document.getElementById('backupThreadBtn');
export const restoreThreadBtn = document.getElementById('restoreThreadBtn');
export const videoToggleBtn = document.getElementById('videoToggleBtn');
export const faceContainer = document.getElementById('faceContainer');
export const testBoredBtn = document.getElementById('testBoredBtn');
export const testSleepyBtn = document.getElementById('testSleepyBtn');
export const testSleepBtn = document.getElementById('testSleepBtn');
export const testNormalBtn = document.getElementById('testNormalBtn');

export const dom = {
  faceVideo, threadSelect, chatHistory, messageInput, sendBtn,
  resubmitContainer, settingsBtn, switchThreadBtn, newThreadBtn,
  deleteThreadBtn, backupThreadBtn, restoreThreadBtn, videoToggleBtn,
  faceContainer, testBoredBtn, testSleepyBtn, testSleepBtn, testNormalBtn
};
