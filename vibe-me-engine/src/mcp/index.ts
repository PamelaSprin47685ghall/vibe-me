const STEALTH_BROWSER_MCP_REPO = 'https://github.com/vibheksoni/stealth-browser-mcp.git';
const STEALTH_BROWSER_MCP_REF = process.env.STEALTH_BROWSER_MCP_REF ?? 'master';

export function getStealthBrowserMcpCommand(): string {
  return `uvx --python 3.13 --from git+${STEALTH_BROWSER_MCP_REPO}@${STEALTH_BROWSER_MCP_REF} python -m server`;
}

export function getStealthBrowserMcpLocalConfig(): { type: 'local'; command: string[] } {
  return {
    type: 'local',
    command: ['uvx', '--python', '3.13', '--from', `git+${STEALTH_BROWSER_MCP_REPO}@${STEALTH_BROWSER_MCP_REF}`, 'python', '-m', 'server'],
  };
}
