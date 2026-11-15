import { db } from './db.js';
import { EDGE_TTS_URL, EMOTION_SPEECH_SETTINGS } from './config.js';

let edgeTtsAudio = null;
let edgeTtsSpeaking = false;
let edgeTtsAbort = null;

export function updateStopSpeakingBtn() {
  const btn = document.getElementById('stopSpeakingBtn');
  if (!btn) return;
  btn.classList.toggle('visible', edgeTtsSpeaking);
}

export function stopSpeaking() {
  if (edgeTtsAbort) {
    edgeTtsAbort.abort();
    edgeTtsAbort = null;
  }
  if (edgeTtsAudio) {
    edgeTtsAudio.pause();
    edgeTtsAudio.src = '';
    edgeTtsAudio = null;
  }
  edgeTtsSpeaking = false;
  updateStopSpeakingBtn();
}

export function textForSpeech(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' (code omitted) ')
    .replace(/^\|.*\|[ \t]*$/gm, '')
    .replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function speechSettingsForEmotion(emotion, intensity) {
  const base = EMOTION_SPEECH_SETTINGS[emotion] || EMOTION_SPEECH_SETTINGS.normal;
  const scale = intensity === 'high' ? 1.54 : intensity === 'low' ? 0.55 : 1.1;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  return {
    rate: clamp(1.0 + (base.rate - 1.0) * scale, 0.5, 2.0),
    pitch: clamp(1.0 + (base.pitch - 1.0) * scale, 0.0, 2.0)
  };
}

export async function speakText(text, emotion, intensity) {
  if (!text) return;
  const speechText = textForSpeech(text);
  if (!speechText) return;

  const { rate, pitch } = speechSettingsForEmotion(emotion, intensity);
  stopSpeaking();

  const ratePercent = Math.round((rate - 1.0) * 100);
  const pitchHz = Math.round((pitch - 1.0) * 50);

  const controller = new AbortController();
  edgeTtsAbort = controller;

  try {
    const resp = await fetch(EDGE_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: speechText,
        rate: `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`,
        pitch: `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`,
      }),
      signal: controller.signal
    });

    if (!resp.ok) {
      console.error('Edge TTS error:', resp.status, await resp.text());
      return;
    }

    const blob = await resp.blob();
    if (controller.signal.aborted) return;

    const url = URL.createObjectURL(blob);
    edgeTtsAudio = new Audio(url);
    edgeTtsSpeaking = true;
    updateStopSpeakingBtn();

    edgeTtsAudio.onended = () => {
      edgeTtsSpeaking = false;
      URL.revokeObjectURL(url);
      edgeTtsAudio = null;
      updateStopSpeakingBtn();
    };
    edgeTtsAudio.onerror = () => {
      edgeTtsSpeaking = false;
      URL.revokeObjectURL(url);
      edgeTtsAudio = null;
      updateStopSpeakingBtn();
    };

    edgeTtsAudio.play();
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Edge TTS fetch failed:', err);
    edgeTtsSpeaking = false;
    updateStopSpeakingBtn();
  }
}

export async function maybeAutoSpeak(text, emotion, intensity) {
  const settings = await db.misc.get('settings') || {};
  if (settings.tts_auto_speak === false) return;
  speakText(text, emotion, intensity);
}
