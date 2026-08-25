/** Cursor URL text. Their handler rejects long or richly encoded prompts. */
export const CURSOR_FIRST_PROMPT = "Build with Scalekit";

/** Post-setup first prompt. Does not tell the agent to run setup or npx skills add. */
export const FIRST_PROMPT = `Build with Scalekit.

Load https://docs.scalekit.com/llms.txt before writing any Scalekit code. The installed authstack skill is the source of truth for APIs, SDK calls, and connection names. Credentials live in the environment, never in source.

Follow these in order. A step is done only when its check passes.

0. Ask — offer AgentKit, SaaSKit, MCP auth, SSO, or SCIM. If I am not sure, propose AgentKit with Gmail and proceed unless I pick another.
   Done: I have named a product.

1. Credentials — set these in a local .env for development, from https://app.scalekit.com → Developers → Settings → API Credentials:
   SCALEKIT_ENVIRONMENT_URL
   SCALEKIT_CLIENT_ID
   SCALEKIT_CLIENT_SECRET
   Keep .env out of git. If I paste values into this chat, use them only for that development .env and remind me to rotate them in the dashboard afterward.
   Done: all three names are set in .env. Code reads them from the environment.

2. Implement — load the installed skill and run its steps. AgentKit only: use the dashboard Connection Name exactly as written. Gmail needs no extra connection; every other connector is created first under Dashboard → AgentKit → Connections.
   Done: the skill's own checklist is complete.

3. Handoff — return that product's proof plus https://app.scalekit.com with the path below.
   Done: both are in your reply.

   - AgentKit: authorization link if the connected account is not ACTIVE; after OAuth, status ACTIVE and one successful tool/API call. Path: AgentKit → Connections
   - SaaSKit: the app login/authorize URL, plus
     npx @scalekit-sdk/dryrun --env_url=$SCALEKIT_ENVIRONMENT_URL --client_id=$SCALEKIT_CLIENT_ID --mode=fsa
     Register http://localhost:12456/auth/callback under Authentication → Redirect URIs first. Path: Authentication → Redirect URLs
   - MCP auth: MCP server URL and https://<your-domain>/.well-known/oauth-protected-resource. Curl the MCP URL for 401 + WWW-Authenticate, and curl the well-known JSON. Path: MCP servers
   - SSO: authorization URL that opens the SSO simulator — Test Organization organization_id from Organizations → Test Organization, or login_hint on @example.com / @example.org. Path: Organizations → Test Organization
   - SCIM: no auth link. Public webhook URL, plus the admin portal link (generatePortalLink or Organizations → Generate link) so IT can copy the SCIM Endpoint URL and Bearer token. Path: Webhooks and Organizations`;
