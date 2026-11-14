# Docker Build Evidence

## Command

```bash
sudo dockerd ... # local daemon (no registry)
sudo docker build --no-cache -t adala-ai:reliability-gate-009 -f Dockerfile .
```

## Results

- Exit code: **0**
- Image ID: `sha256:d79879d0f66a7f5069377ee812ec3ceaf68ca2ff0ed4b5d610d611e06c918319`
- Tag: `adala-ai:reliability-gate-009`
- Install mode: `pnpm install --frozen-lockfile` (Dockerfile step)
- Frontend + API compile completed in builder stage
- Non-root `USER adala` in production stage
- Registry push: **NOT PERFORMED**

## Container lifecycle

| Step | Result |
|------|--------|
| Startup | Listening; `/api/healthz` 200, `/api/startupz` 200, `/api/readyz` 200 |
| Kill + restart | healthz/readyz 200 after restart |
| Graceful `docker stop` | Exit code **0** |
| Bad DATABASE_URL | healthz 200, readyz **503** |
| Recovered DATABASE_URL | readyz **200** |

Artifacts: `evidence/docker-build.log`, `evidence/docker-image.json`, `evidence/container-lifecycle.json`
