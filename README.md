# conventions-mcp-cloudflare

Cloudflare-native Conventions MCP server.

It preserves the same durable-rule model and MCP tool names while using:

- Workers for stateless Streamable HTTP MCP transport;
- D1 for authoritative thought records;
- Workers AI for embedding generation;
- Vectorize for semantic search.

This implementation is self-contained: its local client uses the Worker as
the MCP server, with D1 as authoritative storage and Vectorize as the search
index.

## Local setup

```sh
npm install
npx wrangler d1 create conventions-mcp
npx wrangler vectorize create conventions-mcp --dimensions=768 --metric=cosine
# Put the returned D1 id in wrangler.jsonc.
npx wrangler d1 migrations apply conventions-mcp --local
npm run dev
```

Set the production bearer token with `npx wrangler secret put MCP_AUTH_TOKEN`.
Never put it in `wrangler.jsonc` or source control.

The MCP endpoint is `/mcp`. Project-scoped clients must send both headers:
`X-Conventions-Project` contains the absolute project path and
`X-Conventions-Machine` contains the machine name. The Worker derives the
project identifier as `<machine>:<absolute-path>`, preserving the complete
directory string so slashes and hyphens cannot become ambiguous.

## Deployment

```sh
npx wrangler d1 migrations apply conventions-mcp --remote
npx wrangler deploy
```

The first version is stateless at the MCP protocol layer. Durable rule data is
stored in D1 and vectors in Vectorize, so a Durable Object is not needed merely
to preserve memory. Add one only if a client requirement introduces session
state, stream replay, or coordination.
