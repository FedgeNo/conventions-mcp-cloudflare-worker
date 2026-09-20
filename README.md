# conventions-mcp-cloudflare

Cloudflare-native remote companion to `conventions-mcp`.

It preserves the same durable-rule model and MCP tool names while using:

- Workers for stateless Streamable HTTP MCP transport;
- D1 for authoritative thought records;
- Workers AI for embedding generation;
- Vectorize for semantic search.

This is intentionally a separate implementation. The local project remains
the reference for hooks, stdio transport, SQLite, and local embeddings.

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
project identifier as `<machine>:<path-id>`, preventing equal paths on two
machines from sharing rules.

## Deployment

```sh
npx wrangler d1 migrations apply conventions-mcp --remote
npx wrangler deploy
```

The first version is stateless at the MCP protocol layer. Durable rule data is
stored in D1 and vectors in Vectorize, so a Durable Object is not needed merely
to preserve memory. Add one only if a client requirement introduces session
state, stream replay, or coordination.
