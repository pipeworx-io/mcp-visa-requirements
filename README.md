# mcp-visa-requirements

Visa Requirements MCP — passport visa rules for any nationality → destination pair

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `visa_requirement` | Do I need a visa? Visa requirement for one passport (nationality) traveling to one destination country — returns visa-free (with allowed stay days when known), visa on arrival, e-visa, eTA, visa required, or no admission. Covers 199×199 country pairs. Data: community-maintained Passport Index snapshot (last updated 2026-02-18) — verify with official sources before travel. Example: visa_requirement({ passport: "United States", destination: "Brazil" }) |
| `visa_free_destinations` | Where can holders of a given passport travel without a visa? Lists every destination grouped by requirement: visa-free (with allowed stay days), visa on arrival, e-visa, eTA — plus counts for visa-required and no-admission. Optional filter to a single category. Answers "visa-free countries for X passport holders". Data: Passport Index snapshot (2026-02-18). Example: visa_free_destinations({ passport: "Germany" }) |
| `visa_passport_compare` | Compare passport power: for 2-5 passports, how many destinations each can enter visa-free / on arrival / with e-visa or eTA / visa required (passport-ranking mobility comparison). With exactly 2 passports, also lists destinations where the requirements differ (up to 30). Data: Passport Index snapshot (2026-02-18). Example: visa_passport_compare({ passports: ["US", "India"] }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "visa-requirements": {
      "url": "https://gateway.pipeworx.io/visa-requirements/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Visa Requirements data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
