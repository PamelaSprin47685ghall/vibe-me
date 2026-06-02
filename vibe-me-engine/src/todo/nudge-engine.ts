export interface NudgeInput {
  hasPendingTodos: boolean;
  hasRunningJob: boolean;
  isLoopActive: boolean;
  lastMessageText: string;
  entryCount: number;
  lastNudgeEntry: number;
}

export type NudgeAction = 'nudge-todo' | 'nudge-loop' | 'nudge-runner' | 'none';

const NUDGE_RULES: Array<{
  condition: (ctx: NudgeInput) => boolean;
  action: NudgeAction;
}> = [
  {
    condition: (ctx) => ctx.hasRunningJob,
    action: 'nudge-runner'
  },
  {
    condition: (ctx) => 
      ctx.hasPendingTodos && 
      !ctx.isLoopActive && 
      !ctx.lastMessageText.includes('<skip-todo-check') &&
      ctx.entryCount > ctx.lastNudgeEntry,
    action: 'nudge-todo'
  },
  {
    condition: (ctx) => 
      ctx.isLoopActive && 
      !ctx.lastMessageText.includes('<skip-loop-check') &&
      ctx.entryCount > ctx.lastNudgeEntry,
    action: 'nudge-loop'
  },
];

export function decideNudgeAction(input: NudgeInput): NudgeAction {
  for (const rule of NUDGE_RULES) {
    if (rule.condition(input)) return rule.action;
  }
  return 'none';
}

export const NUDGE_TEMPLATES = {
  'nudge-todo': 'You have pending todos. Continue working or mark them done.',
  'nudge-loop': 'Review loop is active. Submit your review or unlock.',
  'nudge-runner': 'A background job is running. Wait for completion or abort.',
} as const;
