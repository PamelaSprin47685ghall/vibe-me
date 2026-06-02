import type { SchemaFactory, ToolDefinition, PluginToolArgs, EditorToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import { delegateToSubAgent } from "./delegate";

export function createEditorTool<S>(
  deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    intent: f.string(
      "Natural-language description of the code changes to make",
    ),
  });

  return {
    name: "editor",
    description:
      "Receive a natural-language intent for code changes and delegate to the editor agent. IMPORTANT: Do NOT assume the editor agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    schema,
    execute: async (config, args: PluginToolArgs) => {
      const { intent } = args as EditorToolArgs;
      return delegateToSubAgent(config, deps, "exec", intent, "Editor", {
        experiments: {
          toolPolicy: {
            disabledTools: [
              "bash",
              "task",
              "task_await",
              "task_list",
              "task_terminate",
              "task_apply_git_patch",
            ],
          },
        },
      });
    },
  };
}
