import { access, readdir } from "node:fs/promises";
import path from "node:path";

import type { Tool } from "ai";

import type { ToolConfiguration } from "./tools";
import type { AddonEventHook, AddonRegistration } from "./addonRegistry";

const ADDONS_DIR = path.resolve(__dirname, "../../../addons");

const REGISTER_FILES = ["register.ts", "register.js"] as const;

interface AddonModule {
  registration: AddonRegistration;
}

async function registerFilePath(dir: string): Promise<string | undefined> {
  for (const file of REGISTER_FILES) {
    const full = path.join(ADDONS_DIR, dir, file);
    try {
      await access(full);
      return full;
    } catch {
      // file doesn't exist, continue
    }
  }
  return undefined;
}

async function sortedAddonDirs(): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(ADDONS_DIR);
  } catch {
    return [];
  }
  const result: string[] = [];
  for (const e of entries) {
    if (await registerFilePath(e)) result.push(e);
  }
  return result.sort();
}

let cachedRegistrations: AddonRegistration[] | null = null;

async function loadRegistrations(): Promise<AddonRegistration[]> {
  if (cachedRegistrations) return cachedRegistrations;
  const dirs = await sortedAddonDirs();
  const registrations: AddonRegistration[] = [];
  for (const dir of dirs) {
    const filePath = (await registerFilePath(dir))!;
    const module = await import(filePath) as AddonModule;
    if (module.registration) registrations.push(module.registration);
  }
  cachedRegistrations = registrations;
  return registrations;
}

function flatMapRegistrations<T>(
  select: (reg: AddonRegistration) => T[] | undefined,
): Promise<T[]> {
  return loadRegistrations().then((rs) => rs.flatMap((r) => select(r) ?? []));
}

export async function loadAddonTools(config: ToolConfiguration): Promise<Record<string, Tool>> {
  const tools: Record<string, Tool> = {};
  for (const t of await flatMapRegistrations((r) => r.tools)) {
    if (t.condition && !t.condition(config)) continue;
    tools[t.name] = t.factory(config);
  }
  return tools;
}

export async function loadAddonWrappers(
  config: ToolConfiguration,
): Promise<Array<{ targetTool: string; apply: (tool: Tool) => Tool }>> {
  const wrappers: Array<{ targetTool: string; apply: (tool: Tool) => Tool }> = [];
  for (const w of await flatMapRegistrations((r) => r.wrappers)) {
    wrappers.push({ targetTool: w.targetTool, apply: (t) => w.wrapper(t, config) });
  }
  return wrappers;
}

export async function loadAddonContextInjectors(): Promise<
  Array<(projectPath: string) => Promise<string | null>>
> {
  return (await loadRegistrations())
    .filter((r) => r.contextInjector)
    .map((r) => r.contextInjector!.inject);
}

export async function loadAddonEventHooks(): Promise<AddonEventHook[]> {
  return (await loadRegistrations())
    .filter((r): r is AddonRegistration & { eventHook: AddonEventHook } => !!r.eventHook)
    .map((r) => r.eventHook);
}
