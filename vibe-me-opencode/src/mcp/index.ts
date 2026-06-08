import type { McpConfig } from './types.js';
import { getStealthBrowserMcpLocalConfig } from 'engine/mcp';

export { type LocalMcpConfig, type McpConfig, type RemoteMcpConfig } from './types.js';

export function getMcpConfig(): Record<string, McpConfig> {
  return { 'stealth-browser-mcp': getStealthBrowserMcpLocalConfig() };
}
