import { TOOL_NAME, TOOL_PATTERN } from "../agentToolConstants.js";
import {
  MUTATION_TOOLS,
  EXECUTION_TOOLS,
  WEB_TOOLS,
  FUZZY_TOOLS,
  DELEGATION_TOOLS,
} from "../agentToolGroups.js";
import { toolPolicy } from "../agentToolUtils.js";

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
