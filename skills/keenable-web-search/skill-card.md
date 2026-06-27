## Description: <br>
Keyless live web search via Keenable, using a bundled Python script (standard library only, no API key, no install). <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[keenable](https://clawhub.ai/keenable) <br>

### License/Terms of Use: <br>
MIT <br>


## Use Case: <br>
Agents run the bundled script to perform natural-language web search and research — finding current, citable information beyond the model's training data: news and current events, research papers, documentation, company and market research, and fact-checking, with optional site and date filters. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: Search queries are sent to the Keenable public endpoint and may contain sensitive or personal context. <br>
Mitigation: Avoid sending secrets or unnecessary personal data in queries; review returned content before relying on it. <br>
Risk: The script executes locally and makes outbound HTTP requests to `api.keenable.ai`. <br>
Mitigation: The script is standard-library-only and self-contained; review it before use and verify the endpoint host. <br>


## Reference(s): <br>
- [Keenable website](https://keenable.ai) <br>
- [Source repository](https://github.com/keenableai/keenable-mcp) <br>


## Skill Output: <br>
**Output Type(s):** [text, markdown, JSON] <br>
**Output Format:** [Formatted markdown list of results (title, URL, snippet), or raw JSON with `--json`] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [Search returns ranked results with titles, URLs, snippets, and acquisition dates.] <br>

## Skill Version(s): <br>
1.1.2 (source: release evidence) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any retrieved content before relying on it, and apply their organization's safety, security, and compliance requirements before deployment. <br>
