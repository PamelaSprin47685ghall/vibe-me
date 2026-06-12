import { getEffectivePolicyFromString } from "engine/agent-policy";
import { matchResult } from "engine";

export function deniedToolsFor(role: string): readonly string[] {
  return matchResult(getEffectivePolicyFromString(role), {
    Ok: (policy) => policy.deniedTools,
    Err: (error) => {
      throw new Error(error);
    },
  });
}
