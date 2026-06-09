import { execPolicies } from "./execPolicies.js";
import { explorePolicies } from "./explorePolicies.js";
import type { MuxAgentToolPolicies } from "../agentToolTypes.js";

export function buildAgentToolPolicies(): MuxAgentToolPolicies {
  return { exec: execPolicies, explore: explorePolicies };
}
