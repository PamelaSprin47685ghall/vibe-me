import { buildCapitalsContext } from "engine/caps";
import type { ContextInjectorRegistration } from "../types/tool.js";

export function createCapsInjector(): ContextInjectorRegistration {
  return {
    inject: (projectPath: string) =>
      buildCapitalsContext(projectPath).catch(() => null),
  };
}
