import { db, generateUUID } from './db.js';
import { state, dom } from './state.js';
import {
  RUCKUS_PERSONALITY, FACE_EMOTIONS, TIME_GAP_MENTION_THRESHOLD
} from './config.js';
import { setFaceEmotion, resetInactivityTimer } from './face.js';
import { maybeAutoSpeak } from './speech.js';
import {
  loadMessages, loadThreads, addInterimMessage, finalizeToolLoopResult,
  updateStopProcessingBtn, setAIResponseHandler
} from './ui.js';
import { getSystemTimeContext, formatTimeGap } from './utils.js';
import { processSlashCommand } from './commands.js';
import { executeWeatherToolLoop } from './tools/weather.js';
import { executeMovieTvToolLoop } from './tools/movie-tv.js';
import { executeOddsOrEvensToolLoop } from './tools/odds-or-evens.js';
import { executeRollDiceToolLoop } from './tools/dice.js';
import { executePickOneToolLoop } from './tools/pick-one.js';

export function stopAIProcessing() {
  if (state.activeSignals) state.activeSignals.stop = true;
  if (state.activeStreamObj && typeof state.activeStreamObj.stop === 'function') state.activeStreamObj.stop();
}

export async function generateThreadName(threadUuid) {
  const messages = await db.messages.where('threadUuid').equals(threadUuid).limit(3).toArray();
  if (messages.length === 0) return 'New Thread';

  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'New Thread';

  const text = firstUserMessage.text.substring(0, 100);

  try {
    const systemTime = getSystemTimeContext();
    const result = await window.root.aiTextPlugin({
      instruction: `${systemTime}\n\nGenerate a very short (2-5 words) thread name based on this message. Return ONLY the name, nothing else:\n\n"${text}"`,
      startWith: ''
    });

    if (result.stopReason !== 'error' && result.generatedText) {
      return result.generatedText.trim().substring(0, 50);
    }
  } catch (e) {
    console.error('Failed to generate thread name:', e);
  }

  return text.substring(0, 50);
}

export async function getAIResponseStream(userMessage) {
  if (!window.root?.aiTextPlugin) {
    throw new Error('AI plugin not available');
  }

  state.activeSignals = { stop: false };
  state.activeStreamObj = null;
  updateStopProcessingBtn();

  const personalityText = RUCKUS_PERSONALITY;

  const messages = await db.messages.where('threadUuid').equals(state.currentThreadUuid).toArray();
  const lastMsg = messages[messages.length - 1];
  const history = (lastMsg && lastMsg.role === 'user' && lastMsg.text === userMessage)
    ? messages.slice(0, -1)
    : messages;
  const recentMessageCount = Math.floor(Math.random() * 3) + 2;
  const recentMessages = history.slice(-recentMessageCount);
  const conversationContext = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.text}`)
    .join('\n');

  let systemTime = getSystemTimeContext();
  const lastMsg2 = history[history.length - 1];
  const threadRecord = await db.threads.get(state.currentThreadUuid);
  const freshGapMs = (lastMsg2 && lastMsg2.timestamp) ? (Date.now() - lastMsg2.timestamp) : 0;

  if (freshGapMs >= TIME_GAP_MENTION_THRESHOLD) {
    const gapText = formatTimeGap(freshGapMs);
    systemTime += `\nTime Gap: The user just returned after being away for about ${gapText}. If it fits your personality, briefly acknowledge the gap (e.g. a casual "welcome back") without overdoing it — don't mention it in every reply, just this first one back.`;
    await db.threads.update(state.currentThreadUuid, { lastGapText: gapText, lastGapAt: Date.now() });
  } else if (threadRecord?.lastGapText && threadRecord.lastGapAt
             && (Date.now() - threadRecord.lastGapAt) < TIME_GAP_MENTION_THRESHOLD) {
    systemTime += `\nFor reference if asked (don't bring it up unprompted): the user's last notable absence was about ${threadRecord.lastGapText}, before they returned.`;
  }

  const validEmotions = Object.keys(FACE_EMOTIONS);
  const routerPrompt = `${systemTime}

IMPORTANT:
* Keep your responses short and concise — aim for 1-3 sentences max, Don't say in 3 sentences what could be said in ONE.
* Be brief and witty.
* Sound effects or stage directions like *beep*, *gasp*, or *whirr* are off-limits!! — speak only in plain dialogue.

${personalityText}

Here is the conversation so far:
${conversationContext}

User: ${userMessage}

Analyze the user's message above and determine:
1. WEATHER: Is the user asking about weather, temperature, rainfall, wind, or atmospheric conditions? (yes/no)
2. ENTERTAINMENT: Is the user asking to view, search, or manage their movie list or TV show list? (yes/no)
3. ODDS_OR_EVENS: Is the user asking you to play "odds or evens" to decide something (e.g. "odds or evens if X will happen")? (yes/no)
4. ROLL_DICE: Is the user asking you to roll dice, e.g. "roll 3d20" or "roll a d6"? (yes/no)
5. PICK_ONE: Is the user saying "Pick one!" (or similar) and listing options for you to randomly choose between? (yes/no)
6. EMOTION: What emotion should you express in response? Choose exactly ONE of: ${validEmotions.join(', ')}
7. INTENSITY: How intensely should you feel it? Choose exactly ONE of: low, med, high

Respond with ONLY this exact JSON on one line, no other text:
RESPONSE:{"WEATHER":"yes/no","ENTERTAINMENT":"yes/no","ODDS_OR_EVENS":"yes/no","ROLL_DICE":"yes/no","PICK_ONE":"yes/no","EMOTION":"emotion","INTENSITY":"low/med/high"}`;

  const routerResult = await window.root.aiTextPlugin({
    instruction: routerPrompt,
    startWith: 'RESPONSE:'
  });

  if (routerResult.stopReason === 'error') {
    throw new Error('AI plugin failed to route/determine emotion');
  }

  let wantsWeather = false;
  let wantsEntertainment = false;
  let wantsOddsOrEvens = false;
  let wantsRollDice = false;
  let wantsPickOne = false;
  let emotion = 'normal';
  let intensity = 'med';

  const rawResponse = routerResult.generatedText.trim();
  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  let parsed = null;
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Router JSON parse failed, falling back to keyword scan:', e);
    }
  }

  if (parsed) {
    wantsWeather = String(parsed.WEATHER).trim().toLowerCase() === 'yes';
    wantsEntertainment = String(parsed.ENTERTAINMENT).trim().toLowerCase() === 'yes';
    wantsOddsOrEvens = String(parsed.ODDS_OR_EVENS).trim().toLowerCase() === 'yes';
    wantsRollDice = String(parsed.ROLL_DICE).trim().toLowerCase() === 'yes';
    wantsPickOne = String(parsed.PICK_ONE).trim().toLowerCase() === 'yes';
    const parsedEmotion = String(parsed.EMOTION || '').trim().toLowerCase();
    const parsedIntensity = String(parsed.INTENSITY || '').trim().toLowerCase();
    if (validEmotions.includes(parsedEmotion)) emotion = parsedEmotion;
    if (['low', 'med', 'high'].includes(parsedIntensity)) intensity = parsedIntensity;
  } else {
    const lowerRaw = rawResponse.toLowerCase();
    wantsWeather = /weather["\s:]+yes/.test(lowerRaw);
    wantsEntertainment = /entertainment["\s:]+yes/.test(lowerRaw);
    wantsOddsOrEvens = /odds_or_evens["\s:]+yes/.test(lowerRaw);
    wantsRollDice = /roll_dice["\s:]+yes/.test(lowerRaw);
    wantsPickOne = /pick_one["\s:]+yes/.test(lowerRaw);
    for (const validEmotion of validEmotions) {
      if (lowerRaw.includes(validEmotion)) { emotion = validEmotion; break; }
    }
    if (lowerRaw.includes('high')) intensity = 'high';
    else if (lowerRaw.includes('low')) intensity = 'low';
  }

  if (wantsEntertainment) {
    await setFaceEmotion('researching', 'med');
    state.lastInterimMessageId = null;
    state.lastInterimMessageText = null;
    const toolResult = await executeMovieTvToolLoop(userMessage, conversationContext);
    return await finalizeToolLoopResult(toolResult, 'researching', 'med');
  }

  if (wantsOddsOrEvens) {
    await setFaceEmotion('researching', 'med');
    state.lastInterimMessageId = null;
    state.lastInterimMessageText = null;
    const toolResult = await executeOddsOrEvensToolLoop(userMessage, conversationContext);
    return await finalizeToolLoopResult(toolResult, 'researching', 'med');
  }

  if (wantsPickOne) {
    await setFaceEmotion('researching', 'med');
    state.lastInterimMessageId = null;
    state.lastInterimMessageText = null;
    const toolResult = await executePickOneToolLoop(userMessage, conversationContext);
    return await finalizeToolLoopResult(toolResult, 'researching', 'med');
  }

  if (wantsRollDice) {
    await setFaceEmotion('researching', 'med');
    state.lastInterimMessageId = null;
    state.lastInterimMessageText = null;
    const toolResult = await executeRollDiceToolLoop(userMessage, conversationContext);
    return await finalizeToolLoopResult(toolResult, 'researching', 'med');
  }

  if (wantsWeather) {
    await setFaceEmotion('researching', 'med');
    state.lastInterimMessageId = null;
    state.lastInterimMessageText = null;
    const toolResult = await executeWeatherToolLoop(userMessage, conversationContext);
    return await finalizeToolLoopResult(toolResult, 'researching', 'med');
  }

  await setFaceEmotion(emotion, intensity);

  const messageId = await db.messages.add({
    threadUuid: state.currentThreadUuid,
    role: 'ai',
    text: '',
    emotion: emotion,
    timestamp: Date.now()
  });

  await loadMessages(state.currentThreadUuid);
  const messageElements = dom.chatHistory.querySelectorAll('.message.ai');
  const latestMessageEl = messageElements[messageElements.length - 1];
  const bubbleEl = latestMessageEl?.querySelector('.messageBubble');

  const responsePrompt = `${systemTime}

${personalityText}

You are feeling: ${emotion.toUpperCase()} (intensity: ${intensity.toUpperCase()})
Make sure your response reflects this emotion and intensity level.

Your reply is read aloud by text-to-speech, so keep the spoken part natural, conversational sentences. If you need to present a big block of information that should NOT be spoken aloud (a list of options, data, stats, steps, etc.), put ONLY that part into a markdown table — tables are skipped by the voice and shown as text only.

Here is the conversation so far:
${conversationContext}

User: ${userMessage}

Now provide your response reflecting your ${emotion} emotion at ${intensity} intensity (no extra formatting, just your natural response):`;

  let collectedText = '';
  let lastUpdateTime = Date.now();

  const streamObj = window.root.aiTextPlugin({
    instruction: responsePrompt,
    stopSequences: [],
    onChunk: (data) => {
      collectedText += data.textChunk;

      if (bubbleEl) {
        bubbleEl.innerHTML = marked.parse(collectedText);
      }

      dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;

      const now = Date.now();
      if (now - lastUpdateTime > 500) {
        db.messages.update(messageId, { text: collectedText, emotion });
        lastUpdateTime = now;
      }
    },
    onFinish: async (data) => {
      await db.messages.update(messageId, { text: collectedText, emotion });
    }
  });

  state.activeStreamObj = streamObj;
  updateStopProcessingBtn();
  const result = await streamObj;

  if (result.stopReason === 'error') {
    throw new Error('AI plugin failed to generate response');
  }

  return {
    emotion,
    intensity,
    text: collectedText,
    messageId
  };
}

export async function sendMessage() {
  const text = dom.messageInput.value.trim();
  if (!text || state.isWaitingForResponse) return;

  resetInactivityTimer();

  const commandResult = await processSlashCommand(text);
  if (commandResult) {
    dom.messageInput.value = '';

    const resultText = commandResult.error || commandResult.info || commandResult.success || 'Unknown result';

    await db.messages.add({
      threadUuid: state.currentThreadUuid || 'system',
      role: 'system',
      text: resultText,
      timestamp: Date.now()
    });

    await loadMessages(state.currentThreadUuid);

    await setFaceEmotion('thinking');
    setTimeout(async () => {
      await setFaceEmotion('normal');
    }, 3000);

    return;
  }

  let threadUuid = state.currentThreadUuid;
  if (!threadUuid) {
    threadUuid = generateUUID();
    const thread = {
      uuid: threadUuid,
      name: 'New Thread',
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    await db.threads.add(thread);
    state.currentThreadUuid = threadUuid;
    await loadThreads();
    dom.threadSelect.value = threadUuid;
  } else {
    await db.threads.update(threadUuid, { lastActive: Date.now() });
  }

  await db.messages.add({
    threadUuid,
    role: 'user',
    text,
    timestamp: Date.now()
  });

  dom.messageInput.value = '';
  await loadMessages(threadUuid);

  state.isWaitingForResponse = true;
  dom.sendBtn.disabled = true;
  await setFaceEmotion('thinking');

  try {
    const aiStreamResponse = await getAIResponseStream(text);

    if (aiStreamResponse) {
      const { emotion, intensity, text: responseText, messageId, alreadySaved } = aiStreamResponse;

      if (!alreadySaved) {
        await loadMessages(threadUuid);
      }
      await loadThreads();

      setTimeout(() => {
        dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
      }, 100);

      await setFaceEmotion(emotion, intensity);

      if (!alreadySaved) {
        maybeAutoSpeak(responseText, emotion, intensity);
      }

      const thread = await db.threads.get(threadUuid);
      if (thread.name === 'New Thread') {
        const generatedName = await generateThreadName(threadUuid);
        await db.threads.update(threadUuid, { name: generatedName, lastActive: Date.now() });
        await loadThreads();
      }

      setTimeout(async () => {
        await setFaceEmotion('normal');
      }, 3000);
    }
  } catch (error) {
    console.error('AI response error:', error);
    await db.messages.add({
      threadUuid,
      role: 'ai',
      text: `Sorry, I encountered an error: ${error.message}`,
      emotion: 'concerned',
      timestamp: Date.now()
    });
    await loadMessages(threadUuid);
    setFaceEmotion('normal');
  } finally {
    state.isWaitingForResponse = false;
    dom.sendBtn.disabled = false;
    state.activeSignals = null;
    state.activeStreamObj = null;
    updateStopProcessingBtn();
  }
}

setAIResponseHandler(getAIResponseStream);
