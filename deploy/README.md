# Deploying to AWS Lightsail

One server runs two containers: the app (the API, which also serves the
built web app) and Caddy (HTTPS). The database is Neon. Everything is
configured through `deploy/.env`, so moving to another host (e.g. Google
Cloud Run) only needs the same image and env vars.

```
browser ──HTTPS──> Caddy :443 ──> app :3000 ──> Neon (Postgres)
```

## 1. Database (Neon)

1. Create a project at neon.tech and copy its connection string
   (Dashboard > Connect). It looks like
   `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`.
2. Apply the schema from your machine (Docker provides `psql`):

   ```bash
   docker run --rm -i postgres:17-alpine psql "<neon-url>" < api/db/schema.sql
   ```

There are no migrations yet: later schema changes must be applied to Neon
by hand, the same way they're applied to the local database.

## 2. Server (Lightsail)

1. Create an instance: Linux/Unix, **OS only > Ubuntu 24.04 LTS**, the 1 GB
   RAM plan or larger (the image is built on the server).
2. **Networking**: create a static IP and attach it to the instance, then
   in the IPv4 firewall allow **HTTPS (443)** next to the default SSH (22)
   and HTTP (80) rules.
3. Domain: point an `A` record at the static IP. Without a domain, use
   `<ip-with-dashes>.sslip.io` (e.g. `3-14-15-92.sslip.io`), which resolves
   to that IP and gets a real certificate.
4. Connect (browser SSH in the Lightsail console, or
   `ssh -i <key>.pem ubuntu@<ip>`) and install Docker and some swap so the
   build doesn't run out of memory:

   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu   # then log out and back in

   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

5. Get the code. For a private repo, add a read-only deploy key: run
   `ssh-keygen -t ed25519` on the server and add `~/.ssh/id_ed25519.pub`
   in GitHub > repo Settings > Deploy keys.

   ```bash
   git clone git@github.com:josearpaiaq/farm-management.git
   cd farm-management/deploy
   cp .env.example .env && nano .env   # DOMAIN, DATABASE_URL, AUTH_SECRET…
   docker compose up -d --build
   ```

6. Open `https://<DOMAIN>`. Caddy issues the certificate on the first
   request, which can take a few seconds.

## Day to day

Run these in `farm-management/deploy` on the server.

| Task | Command |
| --- | --- |
| Deploy the latest code | `git pull && docker compose build --pull && docker compose up -d` |
| Security updates (Node base image, Caddy, OS) | `docker compose build --pull && docker compose pull caddy && docker compose up -d`, then `sudo apt update && sudo apt upgrade -y` |
| App logs (and emailed codes while Resend is off) | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Stop everything | `docker compose down` |

To verify a user's email by hand, run the script from your machine
against Neon:

```bash
cd api && DATABASE_URL='<neon-url>' pnpm verify-user <email>
```

## Try the production setup locally

```bash
docker build -t farm-management .
```

Or run the full stack with `DOMAIN=localhost` in `deploy/.env` and
`DATABASE_URL` pointing at `host.docker.internal` (Caddy then serves a
local certificate that browsers warn about).
