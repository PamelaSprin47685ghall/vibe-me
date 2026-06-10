import { buildCapitalsContext } from './format.js';

export interface CapitalsContextHook {
  handleSystemTransform: (input: { sessionID?: string }, output: { system: string[] }) => Promise<void>;
}

export function createCapsContextHook(projectRoot: string): CapitalsContextHook {
  return {
    async handleSystemTransform(_input: { sessionID?: string }, output: { system: string[] }) {
      const context = await buildCapitalsContext(projectRoot);
      if (!context) return;
      const marker = '<caps-context';
      if (output.system.some((s) => typeof s === 'string' && s.includes(marker))) return;
      output.system.unshift(context);
    },
  };
}