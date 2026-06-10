import { AGENT_POLICIES } from "engine/agent-policy";
import {
  TOOL_NAME,
  TOOL_PATTERN,
  MUTATION_TOOLS,
  EXECUTION_TOOLS,
  WEB_TOOLS,
  FUZZY_TOOLS,
  DELEGATION_TOOLS,
  ORCHESTRATION_TOOLS,
  BASH_FAMILY_TOOLS,
  DESKTOP_INTERACTION_TOOLS,
  MUX_ADMIN_TOOLS,
  RUNNER_DISABLED_FILE_TOOLS,
} from "./agent-tool-defs.js";
import type { MuxAgentName, SubAgentRole, MuxAgentToolPolicies, MuxPluginToolPolicy } from "./agent-tool-defs.js";

export type { MuxAgentName, SubAgentRole, MuxAgentToolPolicies } from "./agent-tool-defs.js";

export type ToolSelector = string | readonly string[];

export const selectTools = (...selectors: readonly ToolSelector[]): string[] => selectors.flatMap((selector) => (
  typeof selector === "string" ? [selector] : [...selector]
));

export function toolPolicy(
  addSelectors: readonly ToolSelector[],
  removeSelectors: readonly ToolSelector[],
): MuxPluginToolPolicy {
  return {
    add: selectTools(...addSelectors),
    remove: selectTools(...removeSelectors),
  };
}

export const execPolicies = {
  main: toolPolicy(
    [
      TOOL_NAME.fileRead,
      TOOL_NAME.greper,
      TOOL_NAME.reverie,
      TOOL_NAME.submitReview,
      WEB_TOOLS,
      TOOL_NAME.browser,
      TOOL_NAME.glob,
      TOOL_NAME.askUserQuestion,
      TOOL_NAME.proposePlan,
      TOOL_NAME.todoRead,
      TOOL_NAME.todoWrite,
      TOOL_NAME.fuzzyFind,
      TOOL_NAME.editor,
    ],
    [
      TOOL_NAME.bash,
      TOOL_NAME.grep,
      TOOL_NAME.fuzzyGrep,
      TOOL_PATTERN.stealthBrowserMcpFamily,
      TOOL_NAME.task,
      TOOL_NAME.runnerWait,
      TOOL_NAME.runnerAbort,
      TOOL_NAME.write,
      TOOL_NAME.fileEditReplaceString,
      TOOL_NAME.fileEditInsert,
      TOOL_NAME.attachFile,
    ],
  ),
  editor: toolPolicy(
    [
      TOOL_NAME.fileRead,
      MUTATION_TOOLS,
      TOOL_NAME.glob,
      TOOL_NAME.todoRead,
      TOOL_NAME.todoWrite,
    ],
    [
      TOOL_NAME.bash,
      TOOL_NAME.grep,
      FUZZY_TOOLS,
      TOOL_PATTERN.stealthBrowserMcpFamily,
      TOOL_NAME.task,
      DELEGATION_TOOLS,
      EXECUTION_TOOLS,
      WEB_TOOLS,
      TOOL_NAME.proposePlan,
      TOOL_NAME.askUserQuestion,
      TOOL_NAME.fileEditInsert,
    ],
  ),
};

export const explorePolicies = {
  main: toolPolicy(
    [
      TOOL_NAME.fileRead,
      TOOL_NAME.glob,
      TOOL_NAME.greper,
      FUZZY_TOOLS,
      TOOL_NAME.runner,
      TOOL_NAME.browser,
      TOOL_PATTERN.stealthBrowserMcpFamily,
    ],
    [
      TOOL_NAME.bash,
      TOOL_NAME.grep,
      MUTATION_TOOLS,
      TOOL_NAME.reverie,
      TOOL_NAME.submitReview,
      TOOL_NAME.runnerWait,
      TOOL_NAME.runnerAbort,
      WEB_TOOLS,
      TOOL_NAME.task,
      TOOL_PATTERN.desktopFamily,
      TOOL_NAME.proposePlan,
      TOOL_NAME.todoRead,
      TOOL_NAME.todoWrite,
      TOOL_NAME.askUserQuestion,
    ],
  ),
  greper: toolPolicy(
    [
      TOOL_NAME.fileRead,
      TOOL_NAME.glob,
      FUZZY_TOOLS,
      TOOL_NAME.runner,
    ],
    [
      TOOL_NAME.bash,
      TOOL_NAME.grep,
      MUTATION_TOOLS,
      TOOL_NAME.greper,
      TOOL_NAME.reverie,
      TOOL_NAME.browser,
      TOOL_NAME.submitReview,
      TOOL_NAME.runnerWait,
      TOOL_NAME.runnerAbort,
      WEB_TOOLS,
      TOOL_NAME.task,
      TOOL_PATTERN.desktopFamily,
      TOOL_PATTERN.stealthBrowserMcpFamily,
      TOOL_NAME.proposePlan,
      TOOL_NAME.todoRead,
      TOOL_NAME.todoWrite,
      TOOL_NAME.askUserQuestion,
    ],
  ),
  browser: toolPolicy(
    [
      TOOL_NAME.fileRead,
      TOOL_PATTERN.stealthBrowserMcpFamily,
    ],
    [
      TOOL_NAME.bash,
      TOOL_NAME.grep,
      FUZZY_TOOLS,
      TOOL_PATTERN.desktopFamily,
      TOOL_NAME.task,
      MUTATION_TOOLS,
      DELEGATION_TOOLS,
      EXECUTION_TOOLS,
      WEB_TOOLS,
      ORCHESTRATION_TOOLS,
      DESKTOP_INTERACTION_TOOLS,
      MUX_ADMIN_TOOLS,
      TOOL_NAME.glob,
      TOOL_NAME.greper,
    ],
  ),
  reverie: toolPolicy(
    [],
    [
      TOOL_NAME.bash,
      TOOL_NAME.grep,
      FUZZY_TOOLS,
      TOOL_PATTERN.stealthBrowserMcpFamily,
      TOOL_PATTERN.desktopFamily,
      TOOL_NAME.task,
      MUTATION_TOOLS,
      DELEGATION_TOOLS,
      EXECUTION_TOOLS,
      WEB_TOOLS,
      ORCHESTRATION_TOOLS,
      DESKTOP_INTERACTION_TOOLS,
      MUX_ADMIN_TOOLS,
      TOOL_NAME.fileRead,
      TOOL_NAME.glob,
      TOOL_NAME.greper,
    ],
  ),
  reviewer: toolPolicy(
    [
      TOOL_NAME.fileRead,
      TOOL_NAME.glob,
    ],
    [
      TOOL_NAME.bash,
      TOOL_NAME.grep,
      FUZZY_TOOLS,
      TOOL_PATTERN.stealthBrowserMcpFamily,
      TOOL_PATTERN.desktopFamily,
      TOOL_NAME.task,
      MUTATION_TOOLS,
      DELEGATION_TOOLS,
      EXECUTION_TOOLS,
      WEB_TOOLS,
      ORCHESTRATION_TOOLS,
      DESKTOP_INTERACTION_TOOLS,
      MUX_ADMIN_TOOLS,
      TOOL_NAME.greper,
    ],
  ),
  runner: toolPolicy(
    [TOOL_NAME.runnerWait, TOOL_NAME.runnerAbort],
    [
      TOOL_NAME.bash,
      TOOL_NAME.grep,
      FUZZY_TOOLS,
      TOOL_PATTERN.stealthBrowserMcpFamily,
      TOOL_PATTERN.desktopFamily,
      TOOL_NAME.task,
      MUTATION_TOOLS,
      DELEGATION_TOOLS,
      TOOL_NAME.runner,
      WEB_TOOLS,
      ORCHESTRATION_TOOLS,
      DESKTOP_INTERACTION_TOOLS,
      MUX_ADMIN_TOOLS,
    ],
  ),
};

export function buildAgentToolPolicies(): MuxAgentToolPolicies {
  return { exec: execPolicies, explore: explorePolicies };
}

export const EDITOR_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.editor.disabledTools;

export const GREPER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.greper.disabledTools;

export const RUNNER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = selectTools(
  TOOL_NAME.runner,
  RUNNER_DISABLED_FILE_TOOLS,
  TOOL_NAME.glob,
  FUZZY_TOOLS,
  DELEGATION_TOOLS,
  WEB_TOOLS,
  ORCHESTRATION_TOOLS,
  BASH_FAMILY_TOOLS,
  DESKTOP_INTERACTION_TOOLS,
  MUX_ADMIN_TOOLS,
);

export const BROWSER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.browser.disabledTools;

export const REVERIE_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.reverie.disabledTools;

export const REVIEWER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.reviewer.disabledTools;

export function getPluginToolPolicy(
  agentId: string,
  role?: string,
): MuxPluginToolPolicy | undefined {
  const policies = buildAgentToolPolicies()[agentId as MuxAgentName];
  if (!policies) return undefined;
  if (role && role in policies) return policies[role as SubAgentRole];
  return policies.main;
}
