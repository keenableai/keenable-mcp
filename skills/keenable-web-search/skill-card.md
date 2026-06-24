## Description: <br>
Live web search and clean page extraction via the Keenable MCP server. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[keenable](https://clawhub.ai/keenable) <br>

### License/Terms of Use: <br>
MIT <br>


## Use Case: <br>
Developers and agents use this skill to configure and use Keenable MCP tools for natural-language web search and clean markdown page extraction — finding current, citable information beyond the model's training data and reading specific pages on demand. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: Search queries and fetched URLs are sent to the Keenable MCP server and may contain sensitive or personal context. <br>
Mitigation: Avoid sending secrets or unnecessary personal data in queries; review fetched content before relying on it. <br>
Risk: A Keenable API key in MCP configuration can expose elevated rate limits or account privileges if shared. <br>
Mitigation: Treat the Keenable API key as a sensitive credential, send it only via the `X-API-Key` header, and verify the MCP URL (`https://api.keenable.ai/mcp`) before installation. <br>


## Reference(s): <br>
- [Keenable MCP server](https://api.keenable.ai/mcp) <br>
- [Keenable website](https://keenable.ai) <br>


## Skill Output: <br>
**Output Type(s):** [guidance, markdown, shell commands, configuration, API calls] <br>
**Output Format:** [Markdown with inline shell commands, JSON configuration examples, and MCP tool-call examples] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [Search returns ranked results with titles, URLs, and snippets; page fetch returns clean markdown content, optionally length-capped.] <br>

## Skill Version(s): <br>
1.0.0 (source: release evidence) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any retrieved content before relying on it, and apply their organization's safety, security, and compliance requirements before deployment. <br>
