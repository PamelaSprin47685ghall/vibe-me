import { getMcpConfig } from '../mcp/index.js';
import { applyAgentConfig } from '../agent-config.js';
import { createLoopCommandManager } from '../loop/index.js';

type LoopCommandManager = ReturnType<typeof createLoopCommandManager>;

export function createConfigHandler(loopCommandManager: LoopCommandManager) {
  const mcps = getMcpConfig();

  return async (opencodeConfig: Record<string, unknown>) => {
    applyAgentConfig(opencodeConfig, mcps);
    loopCommandManager.registerCommand(opencodeConfig);
  };
}