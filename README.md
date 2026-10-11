# Conventions MCP Cloudflare Worker

This is the server half of Conventions MCP. It stores durable rules in one
Cloudflare D1 database, indexes them in Vectorize, and serves MCP tools from a
Worker. Install the [local client](https://github.com/FedgeNo/conventions-mcp-cloudflare-client)
after deploying this server; the client supplies authentication, project
headers, and agent hooks.

Both MCP handshakes advertise the instruction to call `list_rules` before any other tool and again after a context reset. Clients that include server instructions in model requests receive this requirement even without the local hooks. Reconnect existing clients after deploying an instruction change so they receive the updated handshake.

Each deployment has one database and one bearer token. Anyone given that token
can access the rules in that deployment; it does not provide separate user
accounts or private databases per token. Set up your own deployment for your
own rules.

## Deploy your own server

You need Node.js and npm, a Cloudflare account with Workers, D1, Vectorize,
and Workers AI available, and a POSIX shell for the token commands below.

1. Clone this repository, install its dependencies, and sign in to Cloudflare:

   ```sh
   git clone https://github.com/FedgeNo/conventions-mcp-cloudflare-worker.git
   cd conventions-mcp-cloudflare-worker
   npm ci
   npx wrangler login
   ```

2. Create your own D1 database and Vectorize index:

   ```sh
   npx wrangler d1 create conventions-mcp
   npx wrangler vectorize create conventions-mcp --dimensions=768 --metric=cosine
   ```

   In `wrangler.jsonc`, replace `d1_databases[0].database_id` with the UUID
   returned for **your** database. Keep the `DB`, `VECTORIZE`, and `AI`
   binding names. If you choose different resource names, also change
   `database_name` and `index_name` to match. The checked-in database ID is
   for an existing installation and must not be used for yours. Keep your
   deployment-specific configuration and credentials out of commits.

3. Apply the schema to your D1 database:

   ```sh
   npx wrangler d1 migrations apply conventions-mcp --remote
   ```

4. Generate a private token file for the client and install the same value
   as the Worker secret. These commands assume the server checkout and client
   are on the same machine:

   ```sh
   install -d -m 700 "$HOME/.config/conventions-mcp-cloudflare"
   umask 077
   openssl rand -hex 32 | tr -d '\n' > "$HOME/.config/conventions-mcp-cloudflare/token"
   npx wrangler secret put MCP_AUTH_TOKEN < "$HOME/.config/conventions-mcp-cloudflare/token"
   ```

   Run the `wrangler` command from this repository. It creates or updates
   the Worker deployment. If the client runs on another machine, copy the
   token securely to the same private path there. Keep it out of Git.

5. Deploy the current code and note the Worker URL printed by Wrangler:

   ```sh
   npx wrangler deploy
   ```

   The MCP endpoint is that URL followed by `/mcp`. Continue with the
   [client installation guide](https://github.com/FedgeNo/conventions-mcp-cloudflare-client#install).

## Local development

After configuring the bindings, apply the migrations locally and run Wrangler:

```sh
npx wrangler d1 migrations apply conventions-mcp --local
npm run dev
```

The local endpoint is the URL printed by Wrangler followed by `/mcp`. For
local authentication, put `MCP_AUTH_TOKEN=your-test-token` in an untracked
`.dev.vars` file and use the same value in the client token file. Do not use
the production token in a development file.

## Project scope

The client sends `X-Conventions-Project` with the absolute working directory
and `X-Conventions-Machine` with the machine hostname. The Worker combines
them as `<machine>:<absolute-path>` to identify project-scoped rules. Global
rules and matching project rules are returned together by `list_rules`.
