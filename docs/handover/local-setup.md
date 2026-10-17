# Local setup on Mac, Windows and Linux

This path creates an isolated development copy with local data. You do not need
production credentials, a hosted Supabase account or paid AI access to try the
catalogue, sample shows and fast generation.

## What to install

| Tool               | Required for                                  | Version or choice                   |
| ------------------ | --------------------------------------------- | ----------------------------------- |
| Browser with WebGL | Website and replay                            | Test the receiving browser and GPU  |
| Git                | Downloading and updating source               | Current supported version           |
| Node.js            | Web application and scripts                   | 24.x, declared in `.nvmrc`          |
| pnpm               | Dependency installation and commands          | 12.3.4, declared in `package.json`  |
| Docker             | Local Supabase database, Auth and Storage     | Running Linux containers            |
| Code editor        | Editing source and configuration              | Developer's choice                  |
| Python             | Optional Python service development           | 3.11, separate virtual environments |
| FFmpeg and ffprobe | Optional video worker development             | Both commands on PATH               |
| GitHub CLI         | Optional convenient repository authentication | `gh`                                |

Docker is required for this local database path. It is not required to visit the
hosted site or to use an isolated hosted development database. Supabase CLI is
already pinned in the repository; use `pnpm exec supabase`, not a global install.
See the [official Supabase local-development prerequisites](https://supabase.com/docs/guides/local-development/cli/getting-started).

## Mac

1. Install Git. Apple's command-line developer tools can be installed by running
   `xcode-select --install` in Terminal, then completing the installer.
2. Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/).
   Choose Apple Silicon for an M-series Mac or Intel for an Intel Mac. Open it
   and wait until the engine is running.
3. Install nvm using its [official installation instructions](https://github.com/nvm-sh/nvm#installing-and-updating).
   Reopen Terminal so the shell loads nvm.
4. Install your preferred editor. Continue with the shared steps below.

Python is optional at this point. If you need the services, install Python 3.11
and FFmpeg using your normal trusted installer or package manager, then verify
`python3.11 --version`, `ffmpeg -version` and `ffprobe -version`.

## Windows

Use Ubuntu under WSL 2 for the commands in this guide. This keeps Bash scripts,
virtual-environment paths and the database tooling in one Linux environment.
Native PowerShell development has not been validated by this guide.

1. Follow [Microsoft's WSL installation guide](https://learn.microsoft.com/en-us/windows/wsl/install).
   In an administrator PowerShell window, run:

   ```powershell
   wsl --install -d Ubuntu
   ```

   Restart if requested, open Ubuntu and create the Linux username and password.

2. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
   using the WSL 2 backend. Enable integration with your Ubuntu distribution in
   Docker Desktop's WSL integration settings. Start Docker Desktop.
3. In the Ubuntu terminal, install Git and basic build/download tools:

   ```bash
   sudo apt update
   sudo apt install git curl ca-certificates build-essential
   ```

4. Install [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) inside
   Ubuntu and reopen that terminal. Install Node and pnpm inside WSL too.
5. Clone into the Linux home directory, for example `~/projects`, and use an
   editor with WSL support. Run all remaining Bash commands inside Ubuntu.

Open `http://localhost:3000` in your Windows browser after starting the app.
Do not mix Windows Node, a Windows dependency directory and WSL Python in one
checkout. Windows on ARM and its container/toolchain combination require a
receiving-machine check before acceptance.

## Linux

1. Install Git, curl, CA certificates and build tools through your distribution.
   On Ubuntu/Debian, the `apt` commands in the Windows section apply.
2. Install [Docker Engine for your distribution](https://docs.docker.com/engine/install/)
   or Docker Desktop. Start the engine and configure Docker access for your user
   using the chosen installation's instructions.
3. Install [nvm](https://github.com/nvm-sh/nvm#installing-and-updating), reopen
   the terminal and continue below.

`docker info` must work in the same terminal used for pnpm. Do not run the whole
project as root to work around Docker permission errors.

## Get the code and install dependencies

Accept the repository invitation or create the agreed fork first. See
[GitHub authentication](accounts-and-access.md#github). Replace the clone URL
with the receiving repository if ownership has moved.

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/HarryRandall/FireworkEntertAInment.git
cd FireworkEntertAInment
nvm install
nvm use
corepack enable pnpm
node --version
pnpm --version
docker info
pnpm install --frozen-lockfile
```

Expected versions are Node `v24.x` and pnpm `12.3.4`. Corepack uses the root
`packageManager` declaration. If `corepack` is missing from your Node installation,
install it with `npm install --global corepack`, then rerun `corepack enable pnpm`.
Run the agreed release tag or commit supplied at handover rather than assuming a
moving branch is the accepted release.

## Create the local database and start the website

```bash
pnpm db:setup
pnpm db:env
pnpm dev
```

The first database start downloads container images and imports catalogue media.
Wait for completion. Open `http://localhost:3000`. The environment generator
creates the private `apps/web/.env.local` and refuses to replace an existing file.
For a clean checkout, it supplies local keys and disables optional providers.
Do not copy a production environment file over it.

If you set `APP_ORIGIN` locally, use `http://localhost:3000`. Clear any inherited
production `APP_ORIGIN` or `ANALYSER_DISPATCH_URL` in your shell or existing env
files before testing local authentication and analysis.

| Local account               | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `admin@showcrafter.test`    | Catalogue, permissions and admin demonstration |
| `supplier@showcrafter.test` | Seeded supplier account                        |
| `user@showcrafter.test`     | Standard account with editable sample shows    |

The password for these synthetic local accounts is `LocalShowCrafter123!`.
These credentials do not grant access to a hosted installation. Fixtures give
development credits and select fast generation so OpenRouter is unnecessary.

| Local service    | URL or port              |
| ---------------- | ------------------------ |
| Website          | `http://localhost:3000`  |
| Supabase API     | `http://127.0.0.1:55421` |
| Database         | `127.0.0.1:55422`        |
| Supabase Studio  | `http://127.0.0.1:55423` |
| Test email inbox | `http://127.0.0.1:55424` |

`pnpm db:status` can display local keys. Keep its full output out of shared tickets.

## Prove the basic setup works

1. Sign in with the standard local account and open an example show.
2. Browse Catalogue and Explore, then play a preview.
3. Create a short show without music, inspect its timeline and shopping list,
   change a cue and reload to confirm saving.
4. Sign out and sign in as the local administrator. Open the catalogue editor.
5. Confirm a standard account cannot access an admin-only operation.

Music uploads, Jamendo and video reconstruction need the additional configuration
in [Configuration](configuration.md). Hosted Modal cannot fetch audio from a
laptop's `127.0.0.1` Storage endpoint.

## Stop and restart

Stop the web server with Ctrl+C. Stop Supabase with `pnpm db:stop`; this keeps
local data. Next time start Docker, run `nvm use`, `pnpm db:start` and `pnpm dev`.
After dependency changes, run `pnpm install --frozen-lockfile` again.

`pnpm db:reset` destroys and rebuilds the local application database. Use it only
when you intend to lose local edits, then run `pnpm db:bootstrap --local` and
`pnpm db:fixtures` to restore demonstration content. Fresh snapshot verification
must run before fixtures; see [Database](../database.md).

## Optional Python development

From the repository root on Mac, Linux or WSL, with Python 3.11 installed:

```bash
python3.11 -m venv services/music-analyser/.venv
services/music-analyser/.venv/bin/python -m pip install -r services/music-analyser/requirements.txt
services/music-analyser/.venv/bin/python services/music-analyser/download_model.py
python3.11 -m venv services/firework-import-worker/.venv
services/firework-import-worker/.venv/bin/python -m pip install -r services/firework-import-worker/requirements.txt
```

The analyser model download is verified against the checked-in checksum. It can
be substantial. The current import worker needs FFmpeg, ffprobe and the Node
renderer scorer; it does not need a browser or Playwright installation.

For a local polling import worker, configure the worker credentials described in
[Configuration](configuration.md), then run `pnpm worker:firework-import` in a
second terminal. The helper loads the app env file as shell input, so use only a
trusted file with shell-compatible `KEY=value` assignments. Creating the venv
explicitly above prevents it choosing an unintended `python3` version.

Install Modal separately for deployments as described in [Accounts](accounts-and-access.md).
Neither service's requirements file installs the Modal deployment CLI.
