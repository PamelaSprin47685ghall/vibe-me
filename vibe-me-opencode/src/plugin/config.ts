import { getMcpConfig } from '../mcp/index.js';
import { applyAgentConfig } from '../agent-config.js';
import { createLoopCommandManager } from '../loop/index.js';

type LoopCommandManager = ReturnType<typeof createLoopCommandManager>;

export function createConfigHandler(loopCommandManager: LoopCommandManager) {
  const mcps = getMcpConfig();

  return async (opencodeConfig: Record<string, unknown>) => {
    // biome-ignore lint/suspicious/noExplicitAny: config matches internal any structure
    applyAgentConfig(opencodeConfig as any, mcps);
    // biome-ignore lint/suspicious/noExplicitAny: commandManager matches any config
    loopCommandManager.registerCommand(opencodeConfig as any);
  };
}