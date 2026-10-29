# mcp-visa-requirements

Visa Requirements MCP — passport visa rules for any nationality → destination pair

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1857+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

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

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/visa-requirements/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1857+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/visa_requirement \
  -H 'Content-Type: application/json' \
  -d '{"passport":"US","destination":"Brazil"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/visa_requirement`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-visa-requirements` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/visa-requirements/mcp` endpoint shown above. It needs network access;
there is no offline mode.

```json
{
  "mcpServers": {
    "visa-requirements": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-visa-requirements"]
    }
  }
}
```

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Visa Requirements data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
