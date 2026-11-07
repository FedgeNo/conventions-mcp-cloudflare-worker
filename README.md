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

Authentication is required. The Worker returns HTTP 503 if `MCP_AUTH_TOKEN`
is missing or empty, and HTTP 401 if a request does not supply the matching
bearer token.

## Deploy your own server

You need Node.js and npm, a Cloudflare account with Workers, D1, Vectorize,
and Workers AI available, and a POSIX shell for the token commands below.
Use a Node.js release supported by the installed Wrangler version. Commands
below run from the server checkout. Cloudflare usage is billed to the account
you deploy into; review its service availability and usage limits first.

1. Clone this repository, install its dependencies, and sign in to Cloudflare:

   ```sh
   git clone https://github.com/FedgeNo/conventions-mcp-cloudflare-worker.git
   cd conventions-mcp-cloudflare-worker
   npm ci
   npx wrangler login
   npx wrangler whoami
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
   deployment-specific configuration and credentials out of commits. For a
   private local deployment, keep the real configuration in an ignored
   `wrangler.local.jsonc` beside `wrangler.jsonc`, and add
   `--config wrangler.local.jsonc` to every Wrangler command below. Add that
   filename to `.git/info/exclude` before creating it. Copy the template and
   replace its existing database ID before running a remote command.

3. Apply the schema to your D1 database:

   ```sh
   npx wrangler d1 migrations apply conventions-mcp --remote
   ```

4. For a new deployment, generate a private token file for the client and install the same value
   as the Worker secret. These commands assume the server checkout and client
   are on the same machine:

   ```sh
   install -d -m 700 "$HOME/.config/conventions-mcp-cloudflare"
   umask 077
   test ! -e "$HOME/.config/conventions-mcp-cloudflare/token" &&
       openssl rand -hex 32 -out "$HOME/.config/conventions-mcp-cloudflare/token"
   npx wrangler secret put MCP_AUTH_TOKEN < "$HOME/.config/conventions-mcp-cloudflare/token"
   ```

   Do not regenerate or overwrite an existing token during routine upgrades.
   Reuse the existing private token file when connecting another client to
   the same deployment. Changing the Worker secret requires updating every
   client that uses it.

   Run the `wrangler` command from this repository. It creates or updates
   the Worker deployment. If the client runs on another machine, copy the
   token securely to the same private path there. Keep it out of Git.

5. Deploy the current code and note the Worker URL printed by Wrangler:

   ```sh
   npx wrangler deploy
   ```

   The MCP endpoint is that URL followed by `/mcp`. Continue with the
   [client installation guide](https://github.com/FedgeNo/conventions-mcp-cloudflare-client#install).

6. Check that `npx wrangler secret list` lists `MCP_AUTH_TOKEN` (it does not
   reveal its value). A request without authorization should return HTTP 401:

   ```sh
   curl -i https://YOUR_WORKER_HOSTNAME/mcp
   ```

   Replace the hostname with your deployment's hostname. Then connect the
   client and call `list_rules` to verify an authenticated MCP request.
   HTTP 503 means the Worker secret is missing or empty; HTTP 401 from the
   configured client means its authorization is missing or does not match.

For unattended deployments, provide your own Cloudflare API token through
`CLOUDFLARE_API_TOKEN` in a private environment or secret store. This deployment
credential is separate from the client bearer token and must never be stored
in the repository. Routine code upgrades use `npm ci` and `npx wrangler deploy`;
apply new migrations when provided, and preserve the existing secret and bindings.

## Local development

After configuring the bindings, apply the migrations locally and run Wrangler:

```sh
npx wrangler d1 migrations apply conventions-mcp --local
npm run dev
```

The local endpoint is the URL printed by Wrangler followed by `/mcp`. For
local authentication, put `MCP_AUTH_TOKEN=your-test-token` in an untracked
`.dev.vars` file. Put the same test value in a separate private client token
file and select it with `CONVENTIONS_MCP_AUTH_TOKEN_FILE` in your development
agent's environment. Do not overwrite the production client token or use the
production token in a development file.

## Project scope

The client sends `X-Conventions-Project` with the absolute working directory
and `X-Conventions-Machine` with the machine hostname. The Worker combines
them as `<machine>:<absolute-path>` to identify project-scoped rules. Global
rules and matching project rules are returned together by `list_rules`.
