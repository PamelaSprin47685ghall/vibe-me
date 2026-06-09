import { getStealthBrowserMcpCommand } from "engine/mcp";

export function getMcpServers(): Readonly<Record<string, string>> {
  return {
    "stealth-browser-mcp": getStealthBrowserMcpCommand(),
  };
}
