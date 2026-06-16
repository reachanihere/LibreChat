# LibreChat on Azure — Operator Runbook

## What this is

A fork of [danny-avila/LibreChat](https://github.com/danny-avila/LibreChat) running on a
single Azure VM, serving Anthropic / OpenAI / Google models through the **GitHub Copilot
PAT gateway** (`https://api.githubcopilot.com`). Azure provides **hosting only** — per-token
model usage is billed by GitHub Copilot, not Azure.

One PAT and a shared header set (`Editor-Version`, `Copilot-Integration-Id`) drive three
custom endpoints (Claude / GPT / Gemini), each a thin menu over the same gateway.

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
| `Azure Deploy` | push to `main` + manual | SSH to VM → `git reset --hard origin/main` → pull images → `up -d` → **force-recreate api** → smoke-check `/api/config` |
| `Azure Upstream Sync` | Mondays 06:17 UTC + manual | merges `danny-avila/LibreChat@main` into a `upstream-sync/<sha>` branch, opens/updates a PR |
| `Azure Power Schedule` | 4 daily crons + manual | deallocate/start the VM on the Dublin schedule |

Manual runs (the workflow must exist on `main`):

```bash
gh workflow run "Azure Deploy"          --repo reachanihere/LibreChat
gh workflow run "Azure Power Schedule"  --repo reachanihere/LibreChat -f action=start
gh workflow run "Azure Power Schedule"  --repo reachanihere/LibreChat -f action=deallocate
gh workflow run "Azure Upstream Sync"   --repo reachanihere/LibreChat
```

## Deploying a change

Push to `main` → `Azure Deploy` ships it automatically. To watch:

```bash
gh run list --workflow "Azure Deploy" --limit 1 --repo reachanihere/LibreChat
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
  - Claude drops `frequency_penalty` / `presence_penalty` (gateway rejects them).
  - GPT drops `max_tokens` (gpt-5.4 needs `max_completion_tokens`; dropping lets gpt-5.4 and
    the gpt-4o family share one endpoint).
  - `reasoning_effort` is left at its built-in default (`unset`) so gpt-4o/gpt-4o-mini — which
    reject the param with a 400 — stay safe unless a user explicitly dials it up.
  - Responses-API-only models (gpt-5.5, gpt-5.4-mini, gpt-5.3-codex) and integrator-restricted
    ones (claude-opus-4.7-1m-internal) are intentionally omitted — custom endpoints can't call them.

## User management

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

## Updating from upstream

A PR titled `Upstream sync: ...` opens every Monday. Review the diff — pay attention to
`librechat.yaml`, `deploy-compose.yml`, and `.env` keys — then merge. The merge to `main`
auto-deploys. If the PR body warns of committed conflicts, resolve them before merging.

## Health checks

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://librechat-ani.eastus.cloudapp.azure.com/api/config   # expect 200
ssh azureuser@20.25.12.137 \
  'cd /mnt/data/LibreChat && docker compose -f deploy-compose.yml -f docker-compose.override.yml ps'
az storage blob list --account-name librechatbackupsani -c mongo-backups --auth-mode login -o table
```

Expected containers: `LibreChat-API`, `LibreChat-Caddy`, `chat-mongodb`, `chat-meilisearch`,
`librechat-rag_api-1`, `librechat-vectordb-1`.
