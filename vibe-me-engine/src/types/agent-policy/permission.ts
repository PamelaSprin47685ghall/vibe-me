import { Result, ok, err } from '../general.js';

export type Allow = { readonly _tag: 'Allow' };
export type Deny = { readonly _tag: 'Deny' };
export type ToolPermission = Allow | Deny;

export const allow: Allow = { _tag: 'Allow' };
export const deny: Deny = { _tag: 'Deny' };

export function toolPermissionFromString(value: string): Result<ToolPermission, string> {
  switch (value) {
    case 'allow': return ok(allow);
    case 'deny': return ok(deny);
    default: return err(`Invalid ToolPermission: "${value}"`);
  }
}

export function toolPermissionToString(permission: ToolPermission): string {
  switch (permission._tag) {
    case 'Allow': return 'allow';
    case 'Deny': return 'deny';
  }
}

export function matchToolPermission<R>(
  permission: ToolPermission,
  patterns: { readonly Allow: () => R; readonly Deny: () => R },
): R {
  switch (permission._tag) {
    case 'Allow': return patterns.Allow();
    case 'Deny': return patterns.Deny();
  }
}
