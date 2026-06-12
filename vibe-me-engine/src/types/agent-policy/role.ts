import { Result, ok, err } from '../general.js';

export type Orchestrator = { readonly _tag: 'Orchestrator' };
export type EditorRole = { readonly _tag: 'Editor' };
export type ReviewerRole = { readonly _tag: 'Reviewer' };
export type GreperRole = { readonly _tag: 'Greper' };
export type BrowserRole = { readonly _tag: 'Browser' };
export type ReverieRole = { readonly _tag: 'Reverie' };
export type AgentRole =
  | Orchestrator
  | EditorRole
  | ReviewerRole
  | GreperRole
  | BrowserRole
  | ReverieRole;

export const orchestrator: Orchestrator = { _tag: 'Orchestrator' };
export const editorRole: EditorRole = { _tag: 'Editor' };
export const reviewerRole: ReviewerRole = { _tag: 'Reviewer' };
export const greperRole: GreperRole = { _tag: 'Greper' };
export const browserRole: BrowserRole = { _tag: 'Browser' };
export const reverieRole: ReverieRole = { _tag: 'Reverie' };

export function agentRoleFromString(value: string): Result<AgentRole, string> {
  switch (value) {
    case 'orchestrator': return ok(orchestrator);
    case 'editor': return ok(editorRole);
    case 'reviewer': return ok(reviewerRole);
    case 'greper': return ok(greperRole);
    case 'browser': return ok(browserRole);
    case 'reverie': return ok(reverieRole);
    default: return err(`Invalid AgentRole: "${value}"`);
  }
}

export function agentRoleToString(role: AgentRole): string {
  switch (role._tag) {
    case 'Orchestrator': return 'orchestrator';
    case 'Editor': return 'editor';
    case 'Reviewer': return 'reviewer';
    case 'Greper': return 'greper';
    case 'Browser': return 'browser';
    case 'Reverie': return 'reverie';
  }
}

export function matchAgentRole<R>(
  role: AgentRole,
  patterns: {
    readonly Orchestrator: (value: Orchestrator) => R;
    readonly Editor: (value: EditorRole) => R;
    readonly Reviewer: (value: ReviewerRole) => R;
    readonly Greper: (value: GreperRole) => R;
    readonly Browser: (value: BrowserRole) => R;
    readonly Reverie: (value: ReverieRole) => R;
  },
): R {
  switch (role._tag) {
    case 'Orchestrator': return patterns.Orchestrator(role);
    case 'Editor': return patterns.Editor(role);
    case 'Reviewer': return patterns.Reviewer(role);
    case 'Greper': return patterns.Greper(role);
    case 'Browser': return patterns.Browser(role);
    case 'Reverie': return patterns.Reverie(role);
  }
}

export const AGENT_ROLES: readonly AgentRole[] = [
  orchestrator,
  editorRole,
  reviewerRole,
  greperRole,
  browserRole,
  reverieRole,
] as const;
