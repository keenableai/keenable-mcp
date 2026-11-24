// Rules for a pull request description (.github/pull_request_template.md) and
// for the notes of a GitHub Release that publish-npm.yml ships. Pure functions,
// so test/pr-body.test.js can pin them down. check-pr-body.mjs is the CLI that
// pr-body-lint.yml runs from the base branch and publish-npm.yml runs on the
// release.

export const NO_BEHAVIOR_CHANGE_LABEL = "no-behavior-change";

// Paths whose wording or behavior agents consume directly. A change here has to
// link the run that shows its effect, not just describe it.
export const EVAL_SENSITIVE_PATHS = [
  /^src\/tools\.js$/,
  /^src\/metadata\.js$/,
  /^skills\//,
];

const SECTIONS = [
  {
    heading: "Why",
    minChars: 40,
    hint: "Say who this is for (a named customer or agent segment) and what problem they have, with a link to what shows it.",
  },
  {
    heading: "Hypothesis",
    minChars: 0,
    hint: "Write \"We believe <change> for <who> will result in <outcome>\", then a \"We'll know we're right when …\" line and a \"We'll know we're wrong when …\" line.",
  },
  {
    heading: "Evidence",
    minChars: 20,
    hint: "Say what you ran and what it showed, with links to runs or output.",
  },
  {
    heading: "Risk and rollback",
    minChars: 20,
    hint: "Say what could break outside the diff and how to undo it.",
  },
];

// A merge to main can be reverted; a release cannot. npx users get the new
// `latest` on their next start and npm does not let a version be taken back,
// so stable release notes carry their own evidence and rollback plan.
// Prereleases go to the `next` dist-tag, which only opted-in users get.
const RELEASE_SECTIONS = [
  {
    heading: "What changes for users",
    minChars: 40,
    hint: "Say what users and their agents will see differently: tools, parameters, descriptions, errors, install steps.",
  },
  {
    heading: "Evidence",
    minChars: 20,
    needsLink: true,
    hint: "Link what shows this version is safe to give everyone: the eval run on the previous and new version, the prerelease that ran on `next`, a smoke test of the packed tarball.",
  },
  {
    heading: "Rollback",
    minChars: 20,
    hint: "Say how users get back to the previous version (for example `npm dist-tag add @keenable/mcp@<previous> latest`) and what a rollback cannot undo.",
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
    if (name === wanted || name.startsWith(`${wanted} `) || name.startsWith(`${wanted}/`) || name.startsWith(`${wanted}:`)) {
      return text;
    }
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

export function isEvalSensitive(file) {
  return EVAL_SENSITIVE_PATHS.some((pattern) => pattern.test(file));
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
export function checkPrBody({ body = "", title = "", branch = "", labels = [], files = [] }) {
  const errors = [];
  const notices = [];
  const sections = parseSections(body ?? "");
  const noBehaviorChange = labels.includes(NO_BEHAVIOR_CHANGE_LABEL);
  const sensitive = files.filter(isEvalSensitive);

  checkSectionList(
    sections,
    SECTIONS.filter((section) => !(noBehaviorChange && section.heading === "Hypothesis")),
    errors,
  );

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
  if (sensitive.length > 0 && evidence !== undefined && !URL.test(evidence)) {
    const shown = sensitive.slice(0, 5).join(", ") + (sensitive.length > 5 ? ", …" : "");
    errors.push(`This PR changes what agents read directly (${shown}). "## Evidence" must link the run that shows the effect, for example the eval run on base and head.`);
  }

  if (!LINEAR_KEY.test(`${title}\n${branch}\n${body ?? ""}`)) {
    notices.push("No Linear issue key (such as KEE-123) in the title, branch or description. Link one if the work has an issue.");
  }

  return { errors, notices };
}

// Notes of a GitHub Release. Stable releases need every section; a prerelease
// needs only "What changes for users".
export function checkReleaseNotes({ body = "", prerelease = false }) {
  const errors = [];
  const specs = prerelease ? RELEASE_SECTIONS.slice(0, 1) : RELEASE_SECTIONS;
  checkSectionList(parseSections(body ?? ""), specs, errors);
  return { errors, notices: [] };
}
