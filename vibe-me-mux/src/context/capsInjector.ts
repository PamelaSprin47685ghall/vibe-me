import { buildCapitalsContext } from "engine/caps";
import type { ContextInjectorRegistration } from "../types/tool";

export function createCapsInjector(): ContextInjectorRegistration {
  const cache = new Map<string, Promise<string | null>>();

  return {
    inject: async (projectPath: string): Promise<string | null> => {
      const promise = cache.get(projectPath) ?? buildCapitalsContext(projectPath).catch(() => null);
      cache.set(projectPath, promise);
      return await promise;
    },
  };
}
