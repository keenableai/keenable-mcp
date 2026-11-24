// Rules for a pull request description (pull_request_template.md next to this
// file) and for the notes of a release. Pure functions, pinned down by
// test/pr-body.test.mjs.
//
// Canonical copy: keenableai/ci-workflows/pr-description/. Public repos cannot
// use actions from this internal repo, so they carry a verbatim copy of this
// file, pr-body.d.mts (its types) and check-pr-body.mjs. Change them here
// first, then re-copy.

export const NO_BEHAVIOR_CHANGE_LABEL = "no-behavior-change";

const PR_SECTIONS = [
  {
    heading: "Why",
    minChars: 40,
    hint: "Say who this is for (a named customer or agent segment) and what problem they have, with a link to what shows it.",
  },
  {
    heading: "Hypothesis",
    minChars: 0,
    behavior: true,
    hint: "Write \"We believe <change> for <who> will result in <outcome>\", then a \"We'll know we're right when …\" line and a \"We'll know we're wrong when …\" line.",
  },
  {
    heading: "Evidence",
    minChars: 20,
    hint: "Say what you ran and what it showed, with links: an eval run, agents run on base and head, a second model's review, real calls and their output.",
  },
  {
    heading: "Risk and rollback",
    minChars: 20,
    hint: "Say what could break outside the diff and how to undo it.",
  },
  {
    heading: "Follow-up",
    minChars: 20,
    behavior: true,
    hint: "Say where you will look once it ships (a Grafana dashboard, a PostHog insight, a scheduled eval) and when. \"None, because …\" is an answer.",
  },
];

// A merge to main can be reverted. A release reaches every user and cannot be
// taken back, so a stable release carries its own evidence and rollback plan.
const RELEASE_SECTIONS = [
  {
    heading: "What changes for users",
    minChars: 40,
    hint: "Say what users and their agents will see differently: methods, options, tools, descriptions, errors, install steps.",
  },
  {
    heading: "Evidence",
    minChars: 20,
    needsLink: true,
    hint: "Link what shows this version is safe to give everyone: the eval run on the old and new version, the prerelease that ran first, a smoke test of the built package.",
  },
  {
    heading: "Rollback",
    minChars: 20,
    hint: "Say how users get back to the previous version (a dist-tag move, a yanked version, a pin) and what a rollback cannot undo.",
  },
];

const EMPTY_ANSWERS = new Set(["", "-", "n/a", "na", "none", "tbd", "todo", "wip", "."]);
const TEMPLATE_PLACEHOLDERS = ["<change>", "<who>", "<outcome>", "<metric"];
const LINEAR_KEY = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;
const URL = /https?:\/\/\S+/;

export function stripComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?(-->|$)/g, "");
}

// Level-2 headings split the description; deeper headings stay inside their
// section. Headings match case-insensitively by prefix, so "## Why / customer"
// still counts as Why.
export function parseSections(markdown) {
  const sections = new Map();
  let current = null;
  let inFence = false;
  for (const line of stripComments(markdown).replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = inFence ? null : /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current !== null) sections.get(current).push(line);
  }
  return new Map([...sections].map(([name, lines]) => [name, lines.join("\n").trim()]));
}

function findSection(sections, heading) {
  const wanted = heading.toLowerCase();
  for (const [name, text] of sections) {
    if (name === wanted || [" ", "/", ":"].some((sep) => name.startsWith(`${wanted}${sep}`))) return text;
  }
  return undefined;
}

function isEmptyAnswer(text) {
  return EMPTY_ANSWERS.has(text.trim().toLowerCase().replace(/[.!]+$/, ""));
}

function hasClause(text, phrase) {
  const match = new RegExp(`${phrase}\\b[\\s:,-]*(.*)`, "i").exec(text);
  return Boolean(match && match[1].trim().length >= 10);
}

// One pattern per line: "dir/" matches everything under dir, "*" matches
// within one path segment, "**" across segments. Blank lines and "#" comments
// are ignored.
export function compilePathPatterns(spec) {
  return String(spec ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const source = line
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "\u0000")
        .replace(/\*/g, "[^/]*")
        .replace(/\u0000/g, ".*");
      return new RegExp(`^${source}${line.endsWith("/") ? "" : "$"}`);
    });
}

function checkSectionList(sections, specs, errors) {
  for (const section of specs) {
    const text = findSection(sections, section.heading);
    if (text === undefined) {
      errors.push(`Missing the "## ${section.heading}" section. ${section.hint}`);
      continue;
    }
    if (isEmptyAnswer(text) || text.length < section.minChars) {
      errors.push(`"## ${section.heading}" is empty or too short. ${section.hint}`);
      continue;
    }
    const placeholder = TEMPLATE_PLACEHOLDERS.find((p) => text.includes(p));
    if (placeholder) {
      errors.push(`"## ${section.heading}" still contains the template placeholder ${placeholder}. ${section.hint}`);
    }
    if (section.needsLink && !URL.test(text)) {
      errors.push(`"## ${section.heading}" must link a run or its output. ${section.hint}`);
    }
  }
}

// Returns { errors, notices }. Errors fail the check; notices are advice.
// agentFacingPaths: the repo's patterns (see compilePathPatterns) for files
// whose change reaches agents or API clients directly; those PRs must link a
// run in Evidence.
export function checkPrBody({ body = "", title = "", branch = "", labels = [], files = [], agentFacingPaths = "" }) {
  const errors = [];
  const notices = [];
  const sections = parseSections(body ?? "");
  const noBehaviorChange = labels.includes(NO_BEHAVIOR_CHANGE_LABEL);
  const patterns = compilePathPatterns(agentFacingPaths);
  const agentFacing = files.filter((file) => patterns.some((p) => p.test(file)));

  checkSectionList(sections, PR_SECTIONS.filter((s) => !(noBehaviorChange && s.behavior)), errors);

  const hypothesis = findSection(sections, "Hypothesis");
  if (!noBehaviorChange && hypothesis !== undefined && !isEmptyAnswer(hypothesis)) {
    if (!hasClause(hypothesis, "right when")) {
      errors.push(`"## Hypothesis" needs a "We'll know we're right when …" line naming a metric and a threshold.`);
    }
    if (!hasClause(hypothesis, "wrong when")) {
      errors.push(`"## Hypothesis" needs a "We'll know we're wrong when …" line: the result that would make us revert. If nothing behaves differently, add the ${NO_BEHAVIOR_CHANGE_LABEL} label instead.`);
    }
  }

  const evidence = findSection(sections, "Evidence");
  if (agentFacing.length > 0 && evidence !== undefined && !URL.test(evidence)) {
    const shown = agentFacing.slice(0, 5).join(", ") + (agentFacing.length > 5 ? ", …" : "");
    errors.push(`This PR changes what agents or API clients get directly (${shown}). "## Evidence" must link the run that shows the effect, for example the eval run on base and head.`);
  }

  if (!LINEAR_KEY.test(`${title}\n${branch}\n${body ?? ""}`)) {
    notices.push("No Linear issue key (such as KEE-123) in the title, branch or description. Link one if the work has an issue.");
  }

  return { errors, notices };
}

// Notes of a release. A stable release needs every section; a prerelease
// reaches only opted-in users and needs only "What changes for users".
export function checkReleaseNotes({ body = "", prerelease = false }) {
  const errors = [];
  checkSectionList(parseSections(body ?? ""), prerelease ? RELEASE_SECTIONS.slice(0, 1) : RELEASE_SECTIONS, errors);
  return { errors, notices: [] };
}
