import { db } from './db.js';
import { state, faceVideo } from './state.js';
import {
  FACE_EMOTIONS_CORE,
  FACE_EMOTIONS_CONVERSATION,
  FACE_EMOTIONS_BORED,
  FACE_EMOTIONS_SLEEPY,
  FACE_EMOTIONS,
  INACTIVITY_THRESHOLDS
} from './config.js';

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/jerryhanel/ruckus-faces/main/';

export function getAllVideoFilenames() {
  const filenames = new Set();

  Object.values(FACE_EMOTIONS_CORE).forEach(f => filenames.add(f));
  FACE_EMOTIONS_CONVERSATION.forEach(f => filenames.add(f));
  FACE_EMOTIONS_BORED.forEach(f => filenames.add(f));
  FACE_EMOTIONS_SLEEPY.forEach(f => filenames.add(f));

  filenames.add('sleepy.mp4');
  filenames.add('sleepy-peek.mp4');
  filenames.add('snore.mp4');
  filenames.add('shake-awake.mp4');
  filenames.add('wake-up.mp4');

  Object.values(FACE_EMOTIONS).forEach(emotion => {
    if (emotion.low) emotion.low.forEach(f => filenames.add(f));
    if (emotion.med) emotion.med.forEach(f => filenames.add(f));
    if (emotion.high) emotion.high.forEach(f => filenames.add(f));
  });

  return Array.from(filenames);
}

export async function cacheVideo(filename) {
  const cached = await db.videoCache.get(filename);
  if (cached) return cached.blob;

  try {
    const response = await fetch(GITHUB_RAW_URL + filename);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    await db.videoCache.put({ filename, blob });
    console.log(`Cached: ${filename}`);
    return blob;
  } catch (error) {
    console.error(`Failed to cache ${filename}:`, error);
    return null;
  }
}

export async function getVideoBlob(filename) {
  const cached = await db.videoCache.get(filename);
  if (cached) return cached.blob;
  return cacheVideo(filename);
}

export async function preloadAllVideos() {
  const filenames = getAllVideoFilenames();
  console.log(`Preloading ${filenames.length} videos...`);
  for (const filename of filenames) {
    await cacheVideo(filename);
  }
  console.log('All videos cached!');
}

export async function setFaceEmotion(emotionName, intensity = null) {
  console.log(`📹 setFaceEmotion called: emotion=${emotionName}, intensity=${intensity}`);
  let fileName;

  if (emotionName === 'normal' || emotionName === 'thinking' || emotionName === 'waveform') {
    fileName = FACE_EMOTIONS_CORE[emotionName];
  } else if (emotionName === 'conversation') {
    fileName = FACE_EMOTIONS_CONVERSATION[Math.floor(Math.random() * FACE_EMOTIONS_CONVERSATION.length)];
  } else if (FACE_EMOTIONS[emotionName] && intensity && FACE_EMOTIONS[emotionName][intensity]) {
    const options = FACE_EMOTIONS[emotionName][intensity];
    fileName = options[Math.floor(Math.random() * options.length)];
  } else {
    fileName = `${emotionName}.mp4`;
  }

  try {
    const blob = await getVideoBlob(fileName);
    if (blob) {
      let video = faceVideo.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        video.loop = true;
        video.muted = true;
        faceVideo.appendChild(video);
      }

      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      video.currentTime = 0;
      video.loop = true;
      video.muted = true;
      faceVideo.classList.add('playing');
      await video.play().catch(err => console.error('Video play error:', err));
    } else {
      faceVideo.classList.remove('playing');
    }
  } catch (error) {
    console.error('Error playing video:', error);
    faceVideo.classList.remove('playing');
  }
}

function clearInactivityVideoState() {
  state.currentInactivityMode = null;
  state.isPlayingInactivityVideo = false;

  const video = faceVideo.querySelector('video');
  if (video) {
    video.pause();
    video.onended = null;
    video.src = '';
  }

  if (state.nextInactivityVideoTimeout) {
    clearTimeout(state.nextInactivityVideoTimeout);
    state.nextInactivityVideoTimeout = null;
  }
}

export function testJumpToBoredMode() {
  clearInactivityVideoState();
  state.lastActivityTime = Date.now() - INACTIVITY_THRESHOLDS.bored - 1000;
  checkInactivity();
}

export function testJumpToSleepyMode() {
  clearInactivityVideoState();
  state.lastActivityTime = Date.now() - INACTIVITY_THRESHOLDS.sleepy - 1000;
  checkInactivity();
}

export function testJumpToSleepMode() {
  clearInactivityVideoState();
  state.lastActivityTime = Date.now() - INACTIVITY_THRESHOLDS.sleep - 1000;
  checkInactivity();
}

export function testJumpToNormalMode() {
  resetInactivityTimer();
}

export function resetInactivityTimer() {
  state.lastActivityTime = Date.now();

  if (state.nextInactivityVideoTimeout) {
    clearTimeout(state.nextInactivityVideoTimeout);
    state.nextInactivityVideoTimeout = null;
  }

  const video = faceVideo.querySelector('video');
  if (video && state.isPlayingInactivityVideo) {
    video.pause();
    video.onended = null;
  }

  if (state.currentInactivityMode === 'sleep') {
    playWakeUp();
  } else if (state.currentInactivityMode) {
    state.currentInactivityMode = null;
    state.isPlayingInactivityVideo = false;
    setFaceEmotion('normal');
  }

  if (state.inactivityTimerId) clearInterval(state.inactivityTimerId);
  state.inactivityTimerId = setInterval(checkInactivity, 10000);
}

export function checkInactivity() {
  if (state.isWaitingForResponse || state.currentThreadUuid === null) return;

  const elapsed = Date.now() - state.lastActivityTime;

  let targetMode = null;
  if (elapsed >= INACTIVITY_THRESHOLDS.sleep) {
    targetMode = 'sleep';
  } else if (elapsed >= INACTIVITY_THRESHOLDS.sleepy) {
    targetMode = 'sleepy';
  } else if (elapsed >= INACTIVITY_THRESHOLDS.bored) {
    targetMode = 'bored';
  }

  if (targetMode && targetMode !== state.currentInactivityMode) {
    state.currentInactivityMode = targetMode;

    if (targetMode === 'sleep') {
      playFullSleepMode();
    } else if (targetMode === 'sleepy') {
      playSleepyMode();
    } else if (targetMode === 'bored') {
      playBoredMode();
    }
  }
}

async function playWakeUp() {
  state.currentInactivityMode = null;
  state.isPlayingInactivityVideo = false;
  await setFaceEmotion('normal');

  try {
    const blob = await getVideoBlob('wake-up.mp4');
    if (blob) {
      let video = faceVideo.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        faceVideo.appendChild(video);
      } else {
        video.pause();
        video.onended = null;
        video.src = '';
      }

      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      video.currentTime = 0;
      video.loop = false;
      video.muted = true;
      faceVideo.classList.add('playing');

      video.onended = () => {
        resetInactivityTimer();
      };

      await video.play().catch(err => console.error('Wake-up video play error:', err));
    }
  } catch (error) {
    console.error('Error playing wake-up video:', error);
    resetInactivityTimer();
  }
}

async function playBoredMode() {
  if (!state.currentInactivityMode || state.currentInactivityMode !== 'bored') return;

  state.isPlayingInactivityVideo = true;
  const randomBored = FACE_EMOTIONS_BORED[Math.floor(Math.random() * FACE_EMOTIONS_BORED.length)];

  try {
    const blob = await getVideoBlob(randomBored);
    if (blob) {
      let video = faceVideo.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        faceVideo.appendChild(video);
      } else {
        video.pause();
        video.onended = null;
        video.src = '';
      }

      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      video.currentTime = 0;
      video.loop = false;
      video.muted = true;
      faceVideo.classList.add('playing');

      video.onended = () => {
        if (state.currentInactivityMode === 'bored') {
          playBoredConversation();
        }
      };

      await video.play().catch(err => console.error('Bored video play error:', err));
    }
  } catch (error) {
    console.error('Error in bored mode:', error);
  }
}

async function playBoredConversation() {
  if (!state.currentInactivityMode || state.currentInactivityMode !== 'bored') return;

  const randomConversation = FACE_EMOTIONS_CONVERSATION[Math.floor(Math.random() * FACE_EMOTIONS_CONVERSATION.length)];

  try {
    const blob = await getVideoBlob(randomConversation);
    if (blob) {
      let video = faceVideo.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        faceVideo.appendChild(video);
      } else {
        video.pause();
        video.onended = null;
        video.src = '';
      }

      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      video.currentTime = 0;
      video.loop = false;
      video.muted = true;
      faceVideo.classList.add('playing');

      video.onended = () => {
        if (state.currentInactivityMode === 'bored') {
          playBoredMode();
        }
      };

      await video.play().catch(err => console.error('Conversation video play error:', err));
    }
  } catch (error) {
    console.error('Error in bored conversation:', error);
  }
}

async function playSleepyMode() {
  if (!state.currentInactivityMode || state.currentInactivityMode !== 'sleepy') return;

  state.isPlayingInactivityVideo = true;

  try {
    const blob = await getVideoBlob('shake-awake.mp4');
    if (blob) {
      let video = faceVideo.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        faceVideo.appendChild(video);
      } else {
        video.pause();
        video.onended = null;
        video.src = '';
      }

      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      video.currentTime = 0;
      video.loop = false;
      video.muted = true;
      faceVideo.classList.add('playing');

      video.onended = () => {
        if (state.currentInactivityMode === 'sleepy') {
          playSleepyVideoThenConversation();
        }
      };

      await video.play().catch(err => console.error('Shake-awake video play error:', err));
    }
  } catch (error) {
    console.error('Error in sleepy mode:', error);
  }
}

async function playSleepyVideoThenConversation() {
  if (!state.currentInactivityMode || state.currentInactivityMode !== 'sleepy') return;

  const randomSleepy = FACE_EMOTIONS_SLEEPY[Math.floor(Math.random() * FACE_EMOTIONS_SLEEPY.length)];

  try {
    const blob = await getVideoBlob(randomSleepy);
    if (blob) {
      let video = faceVideo.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        faceVideo.appendChild(video);
      } else {
        video.pause();
        video.onended = null;
        video.src = '';
      }

      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      video.currentTime = 0;
      video.loop = false;
      video.muted = true;
      faceVideo.classList.add('playing');

      video.onended = () => {
        if (state.currentInactivityMode === 'sleepy') {
          playSleepyConversation();
        }
      };

      await video.play().catch(err => console.error('Sleepy video play error:', err));
    }
  } catch (error) {
    console.error('Error playing sleepy video:', error);
  }
}

async function playSleepyConversation() {
  if (!state.currentInactivityMode || state.currentInactivityMode !== 'sleepy') return;

  const randomConversation = FACE_EMOTIONS_CONVERSATION[Math.floor(Math.random() * FACE_EMOTIONS_CONVERSATION.length)];

  try {
    const blob = await getVideoBlob(randomConversation);
    if (blob) {
      let video = faceVideo.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        faceVideo.appendChild(video);
      } else {
        video.pause();
        video.onended = null;
        video.src = '';
      }

      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      video.currentTime = 0;
      video.loop = false;
      video.muted = true;
      faceVideo.classList.add('playing');

      video.onended = () => {
        if (state.currentInactivityMode === 'sleepy') {
          playSleepyMode();
        }
      };

      await video.play().catch(err => console.error('Sleepy conversation video play error:', err));
    }
  } catch (error) {
    console.error('Error in sleepy conversation:', error);
  }
}

async function playFullSleepMode() {
  if (!state.currentInactivityMode || state.currentInactivityMode !== 'sleep') return;

  state.isPlayingInactivityVideo = true;
  const cycleVideos = ['sleepy-peek.mp4', 'snore.mp4'];
  let hasPlayedInitialSleep = false;

  async function playSleepVideo() {
    if (!state.currentInactivityMode || state.currentInactivityMode !== 'sleep') return;

    const videoFile = !hasPlayedInitialSleep ? 'sleepy.mp4' : cycleVideos[Math.floor(Math.random() * cycleVideos.length)];
    if (!hasPlayedInitialSleep) {
      hasPlayedInitialSleep = true;
    }

    try {
      const blob = await getVideoBlob(videoFile);
      if (blob) {
        let video = faceVideo.querySelector('video');
        if (!video) {
          video = document.createElement('video');
          faceVideo.appendChild(video);
        } else {
          video.pause();
          video.onended = null;
          video.src = '';
        }

        const blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        video.currentTime = 0;
        video.loop = false;
        video.muted = true;
        faceVideo.classList.add('playing');

        const advance = () => {
          video.ontimeupdate = null;
          video.onended = null;
          if (state.currentInactivityMode === 'sleep') {
            playSleepVideo();
          }
        };

        video.onended = advance;

        // sleepy.mp4 has a glitch in its last ~0.5s; cut playback short
        if (videoFile === 'sleepy.mp4') {
          const TRIM_SECONDS = 1;
          video.ontimeupdate = () => {
            if (video.duration && video.currentTime >= video.duration - TRIM_SECONDS) {
              video.pause();
              advance();
            }
          };
        }

        await video.play().catch(err => console.error('Sleep video play error:', err));
      }
    } catch (error) {
      console.error('Error in sleep mode:', error);
    }
  }

  playSleepVideo();
}
