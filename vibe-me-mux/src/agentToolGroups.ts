import { TOOL_NAME } from "./agentToolConstants.js";

export const MUTATION_TOOLS: readonly string[] = [
  TOOL_NAME.write,
  TOOL_NAME.fileEditReplaceString,
  TOOL_NAME.fileEditInsert,
  TOOL_NAME.attachFile,
];

export const EXECUTION_TOOLS: readonly string[] = [
  TOOL_NAME.runner,
  TOOL_NAME.runnerWait,
  TOOL_NAME.runnerAbort,
];

export const WEB_TOOLS: readonly string[] = [
  TOOL_NAME.webFetch,
  TOOL_NAME.webSearch,
  TOOL_NAME.websearch,
  TOOL_NAME.webfetch,
];

export const FUZZY_TOOLS: readonly string[] = [TOOL_NAME.fuzzyFind, TOOL_NAME.fuzzyGrep];

export const DELEGATION_TOOLS: readonly string[] = [
  TOOL_NAME.editor,
  TOOL_NAME.greper,
  TOOL_NAME.reverie,
  TOOL_NAME.browser,
  TOOL_NAME.submitReview,
];

export const ORCHESTRATION_TOOLS: readonly string[] = [
  TOOL_NAME.askUserQuestion,
  TOOL_NAME.proposePlan,
  TOOL_NAME.todoRead,
  TOOL_NAME.todoWrite,
  TOOL_NAME.advisor,
  TOOL_NAME.notify,
  TOOL_NAME.getGoal,
  TOOL_NAME.completeGoal,
  TOOL_NAME.reviewPaneUpdate,
  TOOL_NAME.reviewPaneGet,
];

export const BASH_FAMILY_TOOLS: readonly string[] = [
  TOOL_NAME.bash,
  TOOL_NAME.bashOutput,
  TOOL_NAME.bashBackgroundList,
  TOOL_NAME.bashBackgroundTerminate,
];

export const DESKTOP_INTERACTION_TOOLS: readonly string[] = [
  TOOL_NAME.analyticsQuery,
  TOOL_NAME.desktopScreenshot,
  TOOL_NAME.desktopMoveMouse,
  TOOL_NAME.desktopClick,
  TOOL_NAME.desktopDoubleClick,
  TOOL_NAME.desktopDrag,
  TOOL_NAME.desktopScroll,
  TOOL_NAME.desktopType,
  TOOL_NAME.desktopKeyPress,
];

export const MUX_ADMIN_TOOLS: readonly string[] = [
  TOOL_NAME.agentSkillRead,
  TOOL_NAME.agentSkillReadFile,
  TOOL_NAME.agentSkillList,
  TOOL_NAME.agentSkillWrite,
  TOOL_NAME.agentSkillDelete,
  TOOL_NAME.skillsCatalogSearch,
  TOOL_NAME.skillsCatalogRead,
  TOOL_NAME.muxAgentsRead,
  TOOL_NAME.muxAgentsWrite,
  TOOL_NAME.muxConfigRead,
  TOOL_NAME.muxConfigWrite,
];

export const RUNNER_DISABLED_FILE_TOOLS: readonly string[] = [
  TOOL_NAME.fileRead,
  TOOL_NAME.fileEditReplaceString,
  TOOL_NAME.fileEditInsert,
  TOOL_NAME.write,
  TOOL_NAME.attachFile,
];
