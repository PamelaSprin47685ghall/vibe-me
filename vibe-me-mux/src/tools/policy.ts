import { getEffectivePolicyFromString } from "engine/agent-policy";
import { ok, err, type Result } from "engine";

export function deniedToolsFor(role: string): Result<readonly string[], string> {
  const policyResult = getEffectivePolicyFromString(role);
  if (policyResult._tag === 'Err') return err(policyResult.error);
  return ok(policyResult.value.deniedTools);
}
