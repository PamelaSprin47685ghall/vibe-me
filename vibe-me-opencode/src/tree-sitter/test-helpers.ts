import type { PluginInput } from "@opencode-ai/plugin";

export function createMockCtx(directory: string): PluginInput {
  return {
    directory,
    worktree: directory,
    client: {} as PluginInput["client"],
    project: {} as PluginInput["project"],
    serverUrl: new URL("http://localhost:3000"),
    $: {} as PluginInput["$"],
    experimental_workspace: {} as PluginInput["experimental_workspace"],
  };
}

export function createOutput(output: string) {
  return { title: "edit", output, metadata: {} };
}
