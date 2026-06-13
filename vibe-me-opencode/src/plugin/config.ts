import { applyAgentConfig } from '../agent-config.js';
import type { createLoopCommandManager } from '../loop/index.js';
import { getMcpConfig } from '../mcp/index.js';

type LoopCommandManager = ReturnType<typeof createLoopCommandManager>;

export function createConfigHandler(loopCommandManager: LoopCommandManager) {
  const mcps = getMcpConfig();

  return async (opencodeConfig: Record<string, unknown>) => {
    const next = applyAgentConfig(opencodeConfig, mcps);
    Object.assign(opencodeConfig, next);
    loopCommandManager.registerCommand(opencodeConfig);
  };
}
