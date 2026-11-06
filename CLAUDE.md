# Keenable MCP

MCP server for live web search and clean-markdown page fetch over the Keenable web index. See `README.md` for setup and how the bridge to the hosted server works.

## Public Docs and SDK

Every user-facing change ships with its docs. A change is user-facing when it alters a tool, a tool parameter or description, the server instructions, a response shape, an install or client config, or an error message.

- **Docs:** update [keenable-external-docs](https://github.com/keenableai/keenable-external-docs) in the same change set: open a docs PR alongside this one and link it in the description.
- **SDK:** if the change touches the API surface the SDKs wrap, also update [keenable-sdk](https://github.com/keenableai/keenable-sdk) (Python, TypeScript and Go), or open an issue there when it can't land in the same change set.
- **Docs reference the SDKs.** Code examples use the official SDKs, with the HTTP API (curl) shown next to them. If the docs describe something the SDK can't do, that's an SDK gap: fix it or file an issue.
- **If it isn't in the public docs, it doesn't exist in the product.** Don't ship an undocumented user-facing feature: document it, or remove it.

## TypeScript

Write new code in TypeScript when the repository can run it. This package is plain ESM JavaScript today with no build step: `npx` runs `src/index.js` as shipped. So, until it gets a `tsc` build:

- Keep new files under `src/` and `test/` as `.js`, matching the runtime, and say in the PR that the code would be `.ts` with a build step.
- Don't add a TypeScript file that nothing compiles, and don't add `// @ts-nocheck` or JSDoc-only typing as a substitute.
- The migration is its own change: convert `src/` and `test/`, compile to `dist/`, point `bin` and `files` at `dist/`, and keep the CI matrix (Node 18/20/22, oldest accepted MCP SDK).

In the other Keenable repositories that already compile TypeScript (keenable-backend-ts, keenable-landing), new code is always `.ts`/`.tsx`.
