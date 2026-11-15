import { state } from '../state.js';
import { db } from '../db.js';
import { addInterimMessage } from '../ui.js';
import { getSystemTimeContext } from '../utils.js';

export async function executeRollDiceToolLoop(userMessage, conversationContext) {
  const tools = {
    roll_dice: {
      description: 'Rolls the given number of dice, each with the given number of sides, e.g. quantity=3, sides=20 for "3d20". Call this once per distinct dice notation in the user\'s message.',
      args: '{"quantity": number of dice to roll (1-100), "sides": number of sides per die (2-1000)}',
      fn: async (args) => {
        const quantity = Math.max(1, Math.min(100, Math.round(Number(args.quantity) || 1)));
        const sides = Math.max(2, Math.min(1000, Math.round(Number(args.sides) || 6)));
        const rolls = Array.from({ length: quantity }, () => 1 + Math.floor(Math.random() * sides));
        const total = rolls.reduce((sum, r) => sum + r, 0);
        return JSON.stringify({ notation: `${quantity}d${sides}`, rolls, total });
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
      instruction: `${getSystemTimeContext()}\n\nThe user wants dice rolled. Dice notation is NdM — N is the quantity (left of the "d"), M is the number of sides per die (right of the "d"), e.g. "3d20" means roll 3 twenty-sided dice. Parse the notation(s) from the user's message and call roll_dice with the matching quantity/sides for each one, then reply in character reporting the individual rolls and total(s).\n\n${historyBlock}User: ${userMessage}`,
      tools,
      maxRounds: 5,
      onRespond: addInterimMessage,
      forceInitialRespond: announceSettings.announce_tool_use !== false,
      signals: state.activeSignals
    });
    return result.answer || 'No response generated';
  } catch (error) {
    console.error('Roll dice tool loop error:', error);
    return `Error rolling dice: ${error.message}`;
  }
}
