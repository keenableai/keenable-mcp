// Types for pr-body.mjs, for TypeScript callers (for example a release script
// that checks its notes before opening the release PR).

export const NO_BEHAVIOR_CHANGE_LABEL: "no-behavior-change";

export interface CheckResult {
  errors: string[];
  notices: string[];
}

export function stripComments(markdown: string): string;
export function parseSections(markdown: string): Map<string, string>;
export function compilePathPatterns(spec: string | null | undefined): RegExp[];

export function checkPrBody(input: {
  body?: string | null;
  title?: string;
  branch?: string;
  labels?: readonly string[];
  files?: readonly string[];
  agentFacingPaths?: string;
}): CheckResult;

export function checkReleaseNotes(input: { body?: string | null; prerelease?: boolean }): CheckResult;
