// Static copy of the hosted server's `tools/list`, served by src/discovery.js
// to catalog scanners that cannot reach the network.
//
// Keep this identical to what https://api.keenable.ai/mcp returns.
// `npm run check:discovery` (and the discovery-drift workflow) diffs it
// against the live server and fails on any difference.

export const TOOLS = [
  {
    "name": "search_web_pages",
    "description": "Search the live web. Returns ranked results with a title, a URL, and a snippet. Snippets are usually enough.\n\nExample: {\"query\": \"blog post comparing React and Vue performance\", \"published_after\": \"30d\"}",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The page, as a sentence. A blog post comparing React and Vue performance, not keywords."
        },
        "objective": {
          "type": "string",
          "maxLength": 1000,
          "description": "Omit unless the search is multi-step or ambiguous. Say what it is for and what the query leaves out. Up to 1,000 characters."
        },
        "site": {
          "type": "string",
          "description": "Omit unless you want one host, such as arxiv.org."
        },
        "published_after": {
          "type": "string",
          "description": "Omit unless age matters. 7d is the last 7 days."
        },
        "max_results": {
          "type": "integer",
          "minimum": 1,
          "maximum": 50,
          "description": "Omit unless you want other than 10. An integer from 1 to 50."
        },
        "exclude_domains": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Omit unless the user named hosts to drop, such as pinterest.com."
        }
      },
      "required": [
        "query"
      ]
    },
    "annotations": {
      "title": "Keenable Web Search",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": true
    }
  },
  {
    "name": "fetch_page_content",
    "description": "Read pages as clean markdown. Add a prompt to pull one fact from a long page.\n\nExample: {\"urls\": [\"https://nodejs.org/en/about/previous-releases\"], \"prompt\": \"Which version is the current LTS?\"}",
    "inputSchema": {
      "type": "object",
      "properties": {
        "urls": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1,
          "maxItems": 20,
          "description": "1 to 20 URLs. Without an API key, 1 to 10."
        },
        "prompt": {
          "type": "string",
          "maxLength": 2000,
          "description": "Omit unless you need one fact. On prompt_input_too_long, call again without prompt."
        },
        "max_age_hours": {
          "type": "number",
          "minimum": -1,
          "maximum": 720,
          "description": "Omit unless the page changes often. 0 reads the live page. -1 reads only the stored copy."
        },
        "url": {
          "type": "string",
          "deprecated": true,
          "description": "Deprecated. Send urls."
        },
        "live": {
          "type": "boolean",
          "deprecated": true,
          "description": "Deprecated. Send max_age_hours 0."
        }
      }
    },
    "annotations": {
      "title": "Keenable Page Reader",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": true
    }
  },
  {
    "name": "find_tools",
    "description": "Find a Keenable tool that is not in this list. Pass what you are trying to do, in a few words.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "What you are trying to do, in a few words. Example: how much credit is left."
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false
    },
    "annotations": {
      "title": "Find tools",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  },
  {
    "name": "call_tool",
    "description": "Run a tool find_tools returned. Pass its name and the arguments it described.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The tool name find_tools returned."
        },
        "arguments": {
          "type": "object",
          "description": "Omit unless the tool takes arguments. Use the names find_tools showed."
        },
        "session_id": {
          "type": "string",
          "maxLength": 128,
          "description": "Omit unless find_tools returned a session_id. Send that same value."
        }
      },
      "required": [
        "name"
      ],
      "additionalProperties": false
    },
    "annotations": {
      "title": "Call tool",
      "readOnlyHint": false,
      "destructiveHint": false,
      "idempotentHint": false,
      "openWorldHint": true
    }
  }
];
