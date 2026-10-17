# Product guide

ShowCrafter helps users plan a firework show using catalogue products, an editable
cue timeline, optional music and a browser replay. It also supports retailer
assortments and catalogue administration. It is a planning tool. Physical firing,
licensing, site approval and professional safety decisions sit outside the app.

## Accounts and navigation

Public visitors can browse the public catalogue/library and enter an assortment
experience using its QR link. Signed-in users can manage their shows and account.
My Store appears in the signed-in navigation; management actions still depend on
effective permissions. Admin navigation and operations require the relevant grants.

Use Sign up to create an account, confirm the email when requested and sign in.
Use Forgot password for recovery. If the account is unavailable or suspended,
contact the receiving administrator. Local demonstration credentials are listed
in [Local setup](local-setup.md); they are not hosted credentials.

## Home, My shows and Explore

- **Home** is the signed-in entry point for starting or reopening work.
- **My shows** lists your saved shows. Open a show to review its plan and outputs.
- **Explore** (`/library`) contains published templates. Inspect the example and
  start from an appropriate template rather than treating its timings as a finished
  physical firing plan.
- **Catalogue** lists available products, their details and previews. A catalogue
  product is the item selected or purchased; its renderer design is the visual
  approximation used in replay.

The clean local setup includes editable example shows and reusable catalogue
content. A fresh hosted bootstrap includes approved reusable content, but not
previous users' shows, accounts or credit balances.

## Create a show

1. Open **New show** (`/shows/new`). Work through the guided brief, including mood,
   style, duration, budget, allowed firework types and site width.
2. Add a soundtrack if needed, or continue without music. Upload a file you are
   entitled to use, or use Jamendo when the integration is configured.
3. Allow music analysis to finish and inspect any error before proceeding.
   Analysis extracts timing and structure for choreography; it does not establish
   musical or performance quality by itself.
4. Review the final choices and press **Generate**. This is the action that creates
   the show and plans catalogue-backed cues.
5. Wait for completion. Review the resulting show, timeline, replay and shopping
   list before using its exports.

Fast generation uses the local catalogue-aware planner. LLM mode and supported
refinement paths require OpenRouter. Music analysis requires the independently
deployed analyser. A provider failure or insufficient credits should be resolved
before trying repeated chargeable operations.

## Show workspace and timeline

The show detail route is `/shows/<id>`. Its related views are:

| View          | Purpose                                  | What to review                                                             |
| ------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Timeline      | Inspect and edit cue timing and sequence | Start times, duration, overlap, positions and available catalogue products |
| Preview       | Play the browser simulation              | Pacing, palette, density, site layout and soundtrack alignment             |
| Shopping list | Derive quantities from planned cues      | Product identity, quantities, pricing and unmapped products                |
| Show guide    | Review the readable plan                 | Show sequence, notes and practical handover information                    |

Make a small cue change, wait for the UI to finish saving and reopen the show to
confirm persistence. Catalogue changes and template choices can affect the look
of subsequent previews. Preview performance depends on the browser, GPU and
show density; include the client's actual device in acceptance testing.

## Exports and Finale 3D

Use the show's export controls and the **Exports** section for available outputs.
For Finale firing scripts, review the unmatched-product warning before continuing.
A catalogue product without `finale_product_id` exports a blank product ID and
`No Finale 3D equivalent` in its firing note. The app does not invent a match.

A multishot is exported as one purchased product. Its own Finale mapping determines
whether it is matched, even if its child fireworks have mappings. Ask an
administrator to correct a mapping only when a real equivalent is known.

Open a representative export in the client's Finale 3D installation and inspect
the actual result before acceptance. Successful file download is not proof of a
correct Finale import. [The Finale reference](../finale.md) also describes the
admin multishot inventory CSV/VDL syntax and restrictions.

## My Store and public assortment QR journeys

My Store provides Overview, Assortments, Credits and Test show experiences. The
assortment catalogue is shared in the current model; do not assume separate
private retailer tenants merely because the shell says My Store.

1. With the appropriate management permission, create or open an assortment.
2. Add the intended catalogue products and their quantities, then save the bundle.
3. Review its active/public availability and QR/link controls.
4. Open the QR link on a phone in a signed-out browser. The public entry route is
   `/a/<token>`; shoppers do not need a signed-in application account.
5. Generate a show and regenerate it. Confirm the output stays within the bundle's
   products and quantities. Treat a disabled/revoked assortment link as unavailable.

Production public generation needs working durable rate limits and any providers
used by the journey. A phone cannot reach a laptop's `localhost`; use the intended
HTTPS deployment for the mobile QR acceptance check.

Overview's active assortment count and recent assortment activity use real data.
The credit balance, shows-today figures, average credits and chart are illustrative.
**Credits top-up is a preview and does not bill or create a retailer credit account.**
The application's real AI credit ledger is per user. Do not use the store preview
figures as trading or billing reports.

## Administration

Admin has several separately permission-checked sections. Use a development
installation to practise editing before changing the live catalogue.

| Section       | What it manages                              | Recommended walkthrough                                             |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Overview      | Operational summaries and generation status  | Open Generation and locate stalled-job recovery                     |
| Users         | Application accounts and access state        | Inspect an intended account and its effective access                |
| Roles         | Permission grants                            | Review who can manage users, catalogue and imports                  |
| Suppliers     | Supplier records and inventory relationships | Check the supplier connected to a catalogue product                 |
| Catalogue     | Purchasable products and metadata            | Edit a test product, preview it and check its Finale mapping        |
| Effects       | Reusable effect definitions                  | Inspect a template/design and its visual behaviour                  |
| Fireworks     | Individual firework designs                  | Review design, colours, timing and preview                          |
| Multishots    | Compositions of timed shots                  | Review shot order, angles, duration and inventory CSV import/export |
| Assortments   | Fixed bundles and QR access                  | Review products, quantities and public availability                 |
| Explore shows | Published show presets                       | Inspect a preset, cover and publication status                      |
| Imports       | Video reconstruction runs and review         | Submit a permitted test clip and inspect candidate results          |
| Prompts       | AI prompt configuration and generation mode  | Compare fast/LLM configuration before enabling provider usage       |

`/admin/renderer-preview` is an admin browser tool for renderer playback and poster
checks. `/admin/ui-kit` is a developer-facing control showcase rather than a client
business workflow.

Video import measures uploaded footage, asks an OpenRouter model to choose
renderer templates and fits candidates against measurements using CPU simulation.
Review fitted and unfitted candidates before publication. A completed import job
does not mean the reconstruction is an exact physical product or automatically
approved catalogue content.

## Settings, credits and supporting pages

Personal details, Notifications, Billing, Usage and Security are grouped under
Settings. Review each setting's on-screen behaviour during acceptance. Billing
currently presents Free as the available plan; Pro and Ultra are unavailable and
there is no purchase/upgrade flow. Provider bills are paid through the provider
accounts, independently of this page.

The app also has Safety, public product/marketing pages, legal/licence information,
contact and status pages. Review the legal and business copy against the client's
intended deployment and ownership. A status page is not a substitute for checking
provider logs and the actual affected journey.

## Known limitations to explain at handover

| Area                   | Current boundary                                           | Acceptance action                                           |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Simulation             | Catalogue templates and colours approximate appearance     | Review representative products and dense shows              |
| Real-world operation   | No firing hardware control or professional site approval   | Client retains operational review                           |
| Finale                 | Some catalogue products have no equivalent mapping         | Open the file externally and accept/correct warnings        |
| Retail operations      | Shared assortments; illustrative analytics/top-up UI       | Agree whether further tenant/billing work is required       |
| Paid plans             | Pro/Ultra cannot be purchased                              | Do not present pricing pages as a live checkout             |
| Optional providers     | Require separate credentials, deployment and usage budget  | Test each enabled integration on the receiving host         |
| Browser/device quality | Automated tests do not establish actual GPU/mobile quality | Record device, browser and observed result                  |
| Music/provider quality | Historical Notion notes reported a Jamendo regression      | Re-test Jamendo and music output; record any current defect |

Record any additional observed defect, owner, impact and agreed resolution in
[the walkthrough](walkthrough.md). Do not carry an old defect or successful test
forward as a confirmed current result without checking it.
