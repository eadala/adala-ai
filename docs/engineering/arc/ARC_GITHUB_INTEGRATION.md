# ARC GitHub Integration

## Adapter

`GithubReadAdapter` (`artifacts/arc-server/src/adapters/github.ts`)

## Methods

- `getRepository` — full_name, default_branch, allow_auto_merge  
- `getBranchProtection` — protected, required checks, enforcement  
- `listOpenPullRequests`  
- `getCommitStatus` — check-runs  

## Auth

Optional `ARC_GITHUB_TOKEN` / `GITHUB_TOKEN` on **server only**.  
Without token: public API when allowed, else fixture with state **UNVERIFIED**.

## Endpoints

- `GET /api/arc/github/repository`  
- `GET /api/arc/github/branches/:branch/protection`  
- `GET /api/arc/github/pulls`  

## Limits

- Webhooks list may 403 — not implemented as fabricate.  
- No write APIs (comments, merges, status posts).
