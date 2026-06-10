import type { Plugin } from '@opencode-ai/plugin';
import { createNudgeCoordinatorHook } from '../nudge/index.js';
import { createLoopCommandManager } from '../loop/index.js';
import { getMcpConfig } from '../mcp/index.js';
import { createTools } from './tools.js';
import { createHooks } from './hooks.js';
import { createConfigHandler } from './config.js';

const KunweiPlugin: Plugin = async (ctx) => {
  const mcps = getMcpConfig();
  const nudgeHook = createNudgeCoordinatorHook(ctx);
  const loopCommandManager = createLoopCommandManager(ctx);

  return {
    name: 'kunwei',
    mcp: mcps,
    tool: createTools(ctx, nudgeHook.tool),
    ...createHooks(ctx, nudgeHook, loopCommandManager),
    config: createConfigHandler(loopCommandManager),
  };
};

export default KunweiPlugin;