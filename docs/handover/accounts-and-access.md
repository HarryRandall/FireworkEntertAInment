# Accounts, authentication and ownership

The client should own the operational accounts and billing. The developer should
have their own invited access. An application administrator is separate from a
Vercel, Supabase or GitHub owner.

## Account register

Create or transfer only the providers used by the agreed installation. Record the
actual workspace/project identifier and billing contact at handover. Never put
passwords, API keys, recovery codes or access tokens in this register.

| Account                   | Needed when                                       | Access to establish                                              | Receiving owner / project / billing |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| GitHub                    | Maintaining source and CI                         | Repository, Actions and production environment administration    | Pending                             |
| Vercel                    | Hosting the web application                       | Project settings, environment variables, deployments and domains | Pending                             |
| Supabase                  | Hosted data, Auth and Storage                     | Project/database administration, Auth, Storage and backup access | Pending                             |
| Modal                     | Music analysis or hosted video import             | Correct workspace, deployed apps, secrets, logs and billing      | Pending                             |
| OpenRouter                | LLM generation/refinement or video interpretation | API key with agreed budget and model access                      | Pending                             |
| Jamendo developer account | Music search/import                               | Registered application client ID and applicable usage rights     | Pending                             |
| Upstash Redis             | Production recovery/public QR rate limits         | REST endpoint, REST token, database and billing access           | Pending                             |
| Domain registrar / DNS    | Custom domain                                     | DNS records, renewal and recovery contacts                       | Pending                             |
| Email/SMTP provider       | Hosted confirmation and recovery email            | Verified sending domain, SMTP credentials and delivery logs      | Pending                             |
| ShowCrafter account       | Signed-in app use and administration              | Verified email, active account and intended role                 | Pending                             |
| Finale 3D                 | External export acceptance                        | Client's installation and licence                                | Pending                             |

Use separate development and production resources. A basic local demonstration
needs none of these hosted API accounts beyond access to obtain the source.

## GitHub

1. Robert creates or identifies the receiving GitHub account/organisation.
2. Agree whether to fork the repository as proposed in Notion or transfer it.
   Preserve the accepted tag, history, release assets and any needed issue records.
3. Invite the developer and confirm they can clone and read Actions results.
4. Authenticate HTTPS Git using a credential manager or GitHub CLI. GitHub CLI's
   [browser login flow](https://cli.github.com/manual/gh_auth_login) is:

   ```bash
   gh auth login
   gh auth setup-git
   gh auth status
   ```

   Choose GitHub.com and HTTPS, then complete browser authentication. Do not use
   the GitHub account password as a Git password. An existing SSH setup is also valid.

5. Configure production environment secrets and variables in the receiving repo.
   Forking does not establish those credentials or prove deployment access.

## Supabase

Create a client-owned organisation/project or agree an existing-project transfer.
Invite the developer with enough access for their maintenance responsibilities.
For hosted CLI operations, use the repository's installed CLI:

```bash
pnpm exec supabase login
pnpm exec supabase projects list
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
```

The login uses a Supabase personal access token. Obtain it from the developer's
own account and enter it through the CLI's interactive flow. Project linking may
also require the destination database password. A CLI token, database password,
public browser key and service-role API key are different credentials.

The public/publishable and service-role keys come from the destination project's
API-key settings. Store them in the appropriate private environment, as explained
in [Configuration](configuration.md). Never use a service-role key in the browser.

## Vercel

Sign into the client's Vercel team, invite the developer and connect the receiving
GitHub repository. Confirm project settings and billing under that team.
If CLI access is needed, use the workflow's pinned CLI version:

```bash
pnpm dlx --allow-build=esbuild vercel@59.23.2 login
```

Complete the [Vercel CLI login](https://vercel.com/docs/cli/login) flow. For CI,
create a token for the intended team and store it as `VERCEL_TOKEN` in GitHub's
`production` environment. Record the team's org ID and the web project's ID.
Interactive CLI login alone does not authenticate GitHub Actions.

## Modal

Create/select the client's workspace before deploying. Install the CLI in a
separate Python environment, then complete its browser authentication:

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install modal
source .venv/bin/activate
modal setup
modal token info
```

This follows [Modal's setup guide](https://modal.com/docs/guide/getting-started).
Confirm the displayed workspace is the receiving workspace. Keep this environment
active for the Modal commands in the deployment guide. Modal builds the service
images remotely, so deploying them does not require a local Docker image build.
Create the named application secrets in that workspace before deployment.

## OpenRouter, Jamendo, Redis and email

- OpenRouter: create a client-owned account, establish billing/usage limits and
  issue a dedicated project API key. Put it on the web host for LLM generation
  and in the import worker's Modal secret for video interpretation.
- Jamendo: register the integration in the client's developer account and copy
  the application's client ID, not the account password, to `JAMENDO_CLIENT_ID`.
  Confirm the terms for the intended music use.
- Upstash: create the receiving Redis database and copy its REST URL and token
  to the web host. A generic Redis TCP connection string is not a substitute.
- Email: configure the sending domain and SMTP in hosted Supabase Auth. Verify
  real signup and recovery delivery, including the sender and destination domain.
- DNS: retain registrar access and renewals independently of the web-host login.

The earlier Notion plan mentioned a temporary OpenRouter starter key. Its delivery,
remaining balance and ownership have not been verified here. Agree a client-owned
replacement before relying on it for ongoing operation.

## First application administrator

Sign up through the receiving website, verify the email and confirm the account
is active. In Supabase Auth, identify that exact user's UUID. Then, with the CLI
linked to the intended destination:

```bash
pnpm db:admin --project-ref YOUR_PROJECT_REF --user-id VERIFIED_ACCOUNT_UUID
```

This grants the seeded administrator role to an existing verified account.
There is no special administrator email address or shared production password.
Confirm the user can enter Admin, then confirm a standard account cannot perform
admin-only actions. Use Admin > Users and Roles for subsequent authorised access
management. Local fixture accounts never establish production administrator access.

## Finish the transfer

Use a password manager's secure sharing/invitation flow for secrets. Record its
item reference, not its contents, in the private handover record. Enable account
recovery and multi-factor authentication where supported. Confirm billing and
usage alerts reach the client.

Test the receiving accounts independently before rotating shared credentials or
removing team access. Rotate keys in every consumer together, redeploy affected
services and prove the journeys still work. Agree the old environment's retirement
and the support end date in [the acceptance record](walkthrough.md).
