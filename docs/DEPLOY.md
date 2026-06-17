# LibreChat on Azure — Operator Runbook

## What this is

A fork of [danny-avila/LibreChat](https://github.com/danny-avila/LibreChat) running on a
single Azure VM, serving Anthropic / OpenAI / Google models through the **GitHub Copilot
PAT gateway** (`https://api.githubcopilot.com`). Azure provides **hosting only** — per-token
model usage is billed by GitHub Copilot, not Azure.

One PAT and a shared header set (`Editor-Version`, `Copilot-Integration-Id`) drive four
custom endpoints, each structured around the gateway API surface its models need:
**Claude** (native Anthropic `/v1/messages`), **GPT** (Responses API — gpt-5.5 + gpt-5.4),
**GPT 4o** (OpenAI-style `/chat/completions`), and **Gemini** (`/chat/completions`).

## Coordinates

| Thing | Value |
|---|---|
| Public URL | `https://librechat-ani.eastus.cloudapp.azure.com` |
| VM | `librechat-vm` in resource group `librechat-rg` (`eastus`) |
| SSH | `ssh azureuser@20.25.12.137` |
| App dir on VM | `/mnt/data/LibreChat` |
| Backup storage | account `librechatbackupsani`, container `mongo-backups` (3-day retention) |
| Fork | `reachanihere/LibreChat`, default branch `main` |

Every compose command needs **both** files — the stock compose plus the deploy override:

```bash
docker compose -f deploy-compose.yml -f docker-compose.override.yml <cmd>
```

## Daily schedule

- **02:00–08:00 Dublin: VM deallocated** (`Azure Power Schedule` workflow). Saves cost and
  resets the MSDN 120-hour continuous-run clock. Four crons cover IST/GMT; a guard step
  reads the real `Europe/Dublin` hour and only acts at 02:00 (deallocate) / 08:00 (start).
- **23:30 Dublin: nightly Mongo backup** (`librechat-backup.timer` systemd unit on the VM)
  → gzip archive uploaded to Blob via the VM's managed identity. Blob lifecycle policy
  expires archives older than 3 days.

## GitHub Actions workflows

| Workflow | Trigger | Does |
|---|---|---|
| `Azure CI` | push / PR to `main` | validates `librechat.yaml`, compose merge, shellcheck |
| `Azure Pipeline` | push to `main` + manual | detect code changes → (conditional) build & push `ghcr.io/reachanihere/librechat-api` → SSH to VM → `git reset --hard origin/main` → pin image SHA → pull → `up -d` → **force-recreate api** → smoke-check `/api/config` |
| `Azure Power Schedule` | 4 daily crons + manual | deallocate/start the VM on the Dublin schedule |

This is a **hard fork** frozen at `v0.8.7-rc1` — there is no upstream-sync automation; changes come only from our own commits to `main`.

Manual runs (the workflow must exist on `main`):

```bash
gh workflow run "Azure Pipeline"        --repo reachanihere/LibreChat
gh workflow run "Azure Power Schedule"  --repo reachanihere/LibreChat -f action=start
gh workflow run "Azure Power Schedule"  --repo reachanihere/LibreChat -f action=deallocate
```

## Deploying a change

Push to `main` → `Azure Pipeline` ships it automatically. To watch:

```bash
gh run list --workflow "Azure Pipeline" --limit 1 --repo reachanihere/LibreChat
```

> **Why the deploy force-recreates the api container.** `librechat.yaml` is a *single-file*
> bind mount. `git reset --hard` rewrites it as a **new inode**; a running container stays
> bound to the old (now-unlinked) inode, and `docker compose up -d` sees no spec change to
> trigger a recreate — so a config-only edit would silently never reach the app. The deploy
> therefore ends with `up -d --force-recreate --no-deps api`. If you ever edit the YAML
> directly on the VM, recreate api the same way for it to take effect:
>
> ```bash
> cd /mnt/data/LibreChat
> docker compose -f deploy-compose.yml -f docker-compose.override.yml up -d --force-recreate --no-deps api
> ```

## Model and parameter config (`librechat.yaml`)

- **Add / remove a model:** edit the `models.default` list for the relevant endpoint, commit,
  push. Validate a new model against the gateway first:

  ```bash
  curl https://api.githubcopilot.com/chat/completions \
    -H "Authorization: Bearer $COPILOT_PAT" \
    -H 'Editor-Version: vscode/1.95.0' -H 'Copilot-Integration-Id: vscode-chat' \
    -d '{"model":"<id>","messages":[{"role":"user","content":"OK"}],"max_completion_tokens":50}'
  ```

- **Per-conversation settings** (reasoning effort, max tokens, top_p, temperature, verbosity,
  web search) are exposed automatically by the custom-endpoint parameter panel — no config
  needed. Do **not** pin `reasoning_effort` via `addParams`: that overrides the user's pick
  unconditionally and makes the UI control a dead slider.

- **Gateway quirks baked into the config:**
  - **Claude** uses `provider: anthropic` (native `/v1/messages`) and pins an
    `Authorization: Bearer ${COPILOT_PAT}` header — see the PDF subsection below for why.
  - **GPT** (gpt-5.5 + gpt-5.4) sets `addParams: { useResponsesApi: true }` to use the
    Responses API. gpt-5.5 is Responses-only, so this is the only way to reach it; gpt-5.4
    rides the same surface. `titleModel` is gpt-5.4 because gpt-5.5 isn't suited to title calls.
  - **GPT 4o** (gpt-4o / gpt-4o-mini) stays on `/chat/completions` and drops `max_tokens`
    (the gateway wants `max_completion_tokens`). These reject the Responses API, which is why
    they're a separate endpoint from gpt-5.x.
  - `reasoning_effort` is left at its built-in default (`unset`) so gpt-4o/gpt-4o-mini — which
    reject the param with a 400 — stay safe unless a user explicitly dials it up.
  - Integrator-restricted models (e.g. `claude-opus-4.7-1m-internal`) are intentionally omitted —
    custom endpoints can't call them.

- **Context windows are pinned per-model via `tokenConfig`.** Each endpoint has a `tokenConfig`
  block mapping every model to its real gateway context window. This is **not optional polish** —
  the number drives when LibreChat truncates/summarizes a conversation, so a wrong value either
  caps usable context early or overflows the gateway. Two failure modes it fixes:
  - **Under-report (dot/hyphen trap):** LibreChat's built-in token map keys models with hyphens
    (`claude-opus-4-8`) but the gateway IDs use dots (`claude-opus-4.8`). Its substring matcher
    misses and falls back to 200k, so a 1M model showed `180.5k` in the UI. The 1M models
    (`claude-opus-4.8/4.7/4.6`, `claude-sonnet-4.6`, `gpt-5.4`@1.05M, `gemini-3.1-pro-preview`,
    `gemini-3.5-flash`) all hit this.
  - **Over-report (inverse trap):** the gateway caps `gemini-2.5-pro` at **128k**, but the
    built-in map assumes Gemini's native 1M+, which would over-fill the context and get a hard
    reject. Pinning forces the gateway's real 128k.

  An exact-keyed `tokenConfig` entry short-circuits the broken matcher (the runtime does an exact
  `tokensMap[model]` lookup before pattern-matching). `prompt`/`completion` are required by the
  schema but set to `0` here because usage is flat-rate via Copilot, not billed per token. **When
  you add a model, add its `tokenConfig` entry too** — pull the real limit from the gateway:

  ```bash
  curl -s https://api.githubcopilot.com/models -H "Authorization: Bearer $COPILOT_PAT" \
    -H 'Editor-Version: vscode/1.95.0' -H 'Copilot-Integration-Id: vscode-chat' \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print({m['id']:(m.get('capabilities',{}).get('limits',{})) for m in d['data']})"
  ```

- **Image + PDF support is gated per-model by the gateway API surface.** Images work on every
  vision model. **Native PDF** (the model actually reads the document) only works on the API
  surfaces that accept PDF blocks, and the gateway exposes those per-model:

  | Models | Native PDF | API surface / config |
  |---|---|---|
  | Claude ×6 | ✅ | `/v1/messages` — endpoint sets `provider: anthropic` |
  | gpt-5.5, gpt-5.4 | ✅ | `/responses` — endpoint sets `addParams: { useResponsesApi: true }` |
  | gpt-4o, gpt-4o-mini, Gemini ×3 | ❌ | `/chat/completions` — gateway rejects PDF; **images only** |

  The five right-column models **cannot** read PDFs through this gateway — it rejects PDF blocks
  on `/chat/completions` and refuses the Responses API for them. There is intentionally **no RAG
  fallback** (that would need a header-injecting proxy in front of the gateway, since rag_api
  can't send `Copilot-Integration-Id`). Attaching a PDF to one of those models is a no-op.

  > **The `Authorization: Bearer` line on the Claude endpoint is load-bearing — don't remove it.**
  > `provider: anthropic` routes Claude through the Anthropic SDK, which authenticates with an
  > `x-api-key` header. The Copilot gateway **requires `Authorization: Bearer`** and returns
  > `400 missing required Authorization header` for `x-api-key` alone. The endpoint's `headers`
  > block pins `Authorization: "Bearer ${COPILOT_PAT}"` (it merges into the client's headers and
  > wins); without it **every Claude call fails**. If Claude suddenly 400s after a config change,
  > check this header first.



Registration is **disabled** (`ALLOW_REGISTRATION=false`); accounts are created manually.
Run the scripts directly in the api container:

```bash
ssh azureuser@20.25.12.137
docker exec -it LibreChat-API node /app/config/create-user.js <email> <name> <username>
# add a 4th positional arg to set a password non-interactively (less secure);
# add --email-verified=false to require email verification.
```

Other operations (same `docker exec ... node /app/config/<script>.js` form):

| Action | Script |
|---|---|
| List users | `list-users.js` |
| Invite user | `invite-user.js <email>` |
| Ban user | `ban-user.js <email>` |
| Delete user | `delete-user.js <email>` |
| User stats | `user-stats.js` |

## Backups

- **Manual backup now:** `bash /mnt/data/LibreChat/scripts/backup-mongo.sh librechatbackupsani`
- **List archives:**

  ```bash
  az storage blob list --account-name librechatbackupsani -c mongo-backups \
    --auth-mode login -o table
  ```

- **Restore** (download the archive, then stream it into mongorestore):

  ```bash
  az storage blob download --account-name librechatbackupsani -c mongo-backups \
    --name librechat-<ts>.archive.gz --file /tmp/restore.gz --auth-mode login
  docker exec -i chat-mongodb sh -c 'mongorestore --drop --gzip --archive' < /tmp/restore.gz
  ```

## Secrets

GitHub repo → Settings → Secrets → Actions (7):
`AZURE_CREDENTIALS`, `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, `AZ_RG`, `AZ_VM`, `AZ_STORAGE`.

The **Copilot PAT** lives **only** in the VM's `/mnt/data/LibreChat/.env` as `COPILOT_PAT`
(file is `chmod 600`, git-ignored). It is never committed and never a GitHub secret. To rotate:
generate a new PAT, update `.env`, recreate api (`--force-recreate --no-deps api`), confirm a
live model call works, then revoke the old PAT.

## VPN egress (NordVPN)

Model calls can be routed out through a NordVPN exit IP via a [gluetun](https://github.com/qdm12/gluetun)
sidecar (`LibreChat-VPN`), toggled without a redeploy. The sidecar sits behind a compose `vpn`
profile, so normal deploys never start or stop it.

```bash
ssh azureuser@20.25.12.137 'cd /mnt/data/LibreChat && bash scripts/vpn.sh on'      # route egress via NordVPN
ssh azureuser@20.25.12.137 'cd /mnt/data/LibreChat && bash scripts/vpn.sh off'     # back to direct egress
ssh azureuser@20.25.12.137 'cd /mnt/data/LibreChat && bash scripts/vpn.sh status'  # print /vpn-status JSON
```

`on` starts gluetun, waits for it to report healthy, sets `PROXY=http://gluetun:8888` in `.env`,
and force-recreates api. `off` clears `PROXY`, recreates api, and stops gluetun. Because `.env` is
VM-local and survives `git reset --hard`, **the chosen mode persists across deploys**. `NO_PROXY`
in `deploy-compose.yml` already excludes Mongo/Meili/rag, so only LLM calls and the `/vpn-status`
geo-IP check traverse the tunnel.

### Stays on by default across restarts

Once VPN is on, it is the default state through every restart path — no manual re-toggle needed:

- **VM reboot / Azure deallocate→start** (the 02:00–08:00 Dublin power schedule): gluetun runs with
  `restart: unless-stopped` and api with `restart: always`, so the Docker daemon brings both back
  automatically, with `PROXY` still in api's environment.
- **Code deploy** (the `Azure Pipeline`): the profile-gated `vpn` services aren't touched by a plain
  `up -d`, so the deploy explicitly checks `.env` — when `PROXY=http://gluetun:8888` is set it brings
  gluetun back up and waits for health *before* recreating api, then asserts `/vpn-status` reports
  `connected:true` and **fails the deploy** if it doesn't. A silently-broken proxy can't leave the
  server quietly egressing direct.

To make the server default to *direct* egress again, run `bash scripts/vpn.sh off` (it clears
`PROXY` from `.env`, so subsequent restarts and deploys stay off).

The same egress is surfaced by **`GET /vpn-status`** (top-level, unauthenticated) and a badge in
the chat header: it fetches a geo-IP service through the *same* undici dispatcher attached to every
model call, so `connected:true` + a Nord IP means model traffic is genuinely tunnelled. With VPN
off it reports `connected:false` and the Azure egress IP.

NordVPN service credentials live **only** in the VM `.env` as `NORD_USER` / `NORD_PASSWORD`
(`chmod 600`, git-ignored); set `NORD_COUNTRY` to pin an exit country (optional).

> **Copilot abuse-detection caveat.** Routing Copilot-gateway traffic through a shared VPN exit IP
> can trip GitHub's abuse heuristics. This is opt-in and experimental — if model calls start
> failing, `bash scripts/vpn.sh off` restores direct egress instantly (no redeploy).

## Health checks

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://librechat-ani.eastus.cloudapp.azure.com/api/config   # expect 200
curl -s https://librechat-ani.eastus.cloudapp.azure.com/vpn-status                                    # egress IP + country
ssh azureuser@20.25.12.137 \
  'cd /mnt/data/LibreChat && docker compose -f deploy-compose.yml -f docker-compose.override.yml ps'
az storage blob list --account-name librechatbackupsani -c mongo-backups --auth-mode login -o table
```

Expected containers: `LibreChat-API`, `LibreChat-Caddy`, `chat-mongodb`, `chat-meilisearch`,
`librechat-rag_api-1`, `librechat-vectordb-1` (plus `LibreChat-VPN` only when the `vpn` profile is active).
