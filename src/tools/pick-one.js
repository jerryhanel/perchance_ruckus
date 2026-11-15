import { state } from '../state.js';
import { db } from '../db.js';
import { addInterimMessage } from '../ui.js';
import { getSystemTimeContext } from '../utils.js';

export async function executePickOneToolLoop(userMessage, conversationContext) {
  const tools = {
    pick_one: {
      description: 'Randomly picks one option from a list. Call this once with the full list of options parsed from the user\'s message.',
      args: '{"options": array of option strings (2 or more)}',
      fn: async (args) => {
        const options = Array.isArray(args.options) ? args.options.map(String).filter(Boolean) : [];
        if (options.length === 0) return JSON.stringify({ error: 'No options provided' });
        const picked = options[Math.floor(Math.random() * options.length)];
        return JSON.stringify({ options, picked });
      }
    }
  };

  const historyBlock = conversationContext
    ? `Here is the conversation so far:\n${conversationContext}\n\n`
    : '';
  const toolLoop = window.root.buildAiToolLoop();

  try {
    const announceSettings = await db.misc.get('settings') || {};
    const result = await toolLoop.runToolLoop({
      instruction: `${getSystemTimeContext()}\n\nThe user said "Pick one!" and listed some options for you to choose between at random. Parse the distinct options out of their message and call pick_one with that full list, then reply in character stating the picked option followed by a brief, natural in-character reaction to it.\n\n${historyBlock}User: ${userMessage}`,
      tools,
      maxRounds: 3,
      onRespond: addInterimMessage,
      forceInitialRespond: announceSettings.announce_tool_use !== false,
      signals: state.activeSignals
    });
    return result.answer || 'No response generated';
  } catch (error) {
    console.error('Pick one tool loop error:', error);
    return `Error picking an option: ${error.message}`;
  }
}
