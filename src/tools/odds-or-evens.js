import { state } from '../state.js';
import { db } from '../db.js';
import { addInterimMessage } from '../ui.js';
import { getSystemTimeContext } from '../utils.js';

export async function executeOddsOrEvensToolLoop(userMessage, conversationContext) {
  const tools = {
    flip_odds_or_evens: {
      description: 'Randomly decides "odds" or "evens" for a yes/no-style question. Call this once to get the decision, then respond in character reacting to that result.',
      args: '(no args)',
      fn: async () => JSON.stringify({ result: Math.random() < 0.5 ? 'odds' : 'evens' })
    }
  };

  const historyBlock = conversationContext
    ? `Here is the conversation so far:\n${conversationContext}\n\n`
    : '';
  const toolLoop = window.root.buildAiToolLoop();

  try {
    const announceSettings = await db.misc.get('settings') || {};
    const result = await toolLoop.runToolLoop({
      instruction: `${getSystemTimeContext()}\n\nThe user is playing "odds or evens" to decide something. Call flip_odds_or_evens exactly once to get the result, then reply in character: state "Odds!" or "Evens!" (matching the tool result) followed by a brief, natural in-character reaction to what that means for their question.\n\n${historyBlock}User: ${userMessage}`,
      tools,
      maxRounds: 3,
      onRespond: addInterimMessage,
      forceInitialRespond: announceSettings.announce_tool_use !== false,
      signals: state.activeSignals
    });
    return result.answer || 'No response generated';
  } catch (error) {
    console.error('Odds/evens tool loop error:', error);
    return `Error flipping odds or evens: ${error.message}`;
  }
}
