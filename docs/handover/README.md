# ShowCrafter client handover

Start here if you are taking over ShowCrafter. These guides are for Robert Foti,
ICON Pyrotechnics International and the developer maintaining the project.

Prepared on 17 October 2026 from the checked-out repository and the Notion handover
pages listed below. This is an operating guide, not a record that ownership,
production deployment or client acceptance has already been completed. Record
those results in the [walkthrough and acceptance record](walkthrough.md).

## Choose your starting point

| You want to...                                    | Read                                             |
| ------------------------------------------------- | ------------------------------------------------ |
| Understand the product and each workspace         | [Product guide](product-guide.md)                |
| Run a copy on Mac, Windows or Linux               | [Local setup](local-setup.md)                    |
| Know which accounts to create and how to sign in  | [Accounts and ownership](accounts-and-access.md) |
| Configure database keys and optional integrations | [Configuration](configuration.md)                |
| Understand the code, data and service boundaries  | [Technical overview](technical-overview.md)      |
| Put the application on the client's hosting       | [Deployment](deployment.md)                      |
| Maintain it, diagnose problems or recover jobs    | [Operations and troubleshooting](operations.md)  |
| Run the handover meeting and record acceptance    | [Walkthrough and acceptance](walkthrough.md)     |

Robert can start with the product guide and walkthrough. The receiving developer
should follow local setup, accounts, configuration and deployment in that order.
All terminal commands assume the repository root unless another directory is shown.
Replace example project references, domains and account IDs with the agreed values.

## Three ways to use the project

| Mode                              | Needed                                                             | What it gives you                                                       |
| --------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Use the hosted website            | Browser and an application account, or a public assortment QR link | The features configured on that deployment                              |
| Develop locally                   | Git, Node 24, pnpm 12.3.4 and Docker                               | Local Supabase, reusable catalogue, sample shows and synthetic accounts |
| Own and host the full application | GitHub, Vercel, Supabase and accounts for enabled integrations     | Independent releases, service administration and billing                |

Python and FFmpeg are additional tools for working on the Python services. They
are not prerequisites for the basic local web demonstration. A developer's laptop
does not need to remain running for Vercel, Supabase and Modal deployments to work.

## Existing technical references

Keep these alongside the client guides. They contain the detailed implementation
rules and database procedures:

- [Architecture](../architecture.md)
- [Development and checks](../development.md)
- [Database, snapshot and migrations](../database.md)
- [Renderer catalogue](../renderer-catalogue.md)
- [Finale 3D export contract](../finale.md)
- [Music choreography](../music-choreography-integration.md)
- [Music analyser](../../services/music-analyser/README.md)
- [Video reconstruction worker](../../services/firework-import-worker/README.md)

## Sources and maintenance

The Notion material has been adapted into practical guides rather than copied
verbatim. Planning, evaluation and incomplete transfer items are preserved in the
walkthrough. Notion remains unchanged.

| Notion source                                                                               | Markdown destination                                           |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Handover & Delivery](https://www.notion.so/3f7cd8a5bf0881cb8316c13070a20fd1)               | This index and walkthrough                                     |
| [Product & Technical Documentation](https://www.notion.so/3f7cd8a5bf08817aab10f1a572d00fe2) | Product, technical, setup, configuration and operations guides |
| [Ownership & Access Transfer](https://www.notion.so/3f7cd8a5bf08814d9d8ff77a1c06378a)       | Accounts and deployment                                        |
| [Delivery Plan & Checklist](https://www.notion.so/3f7cd8a5bf088141aa04c66278bbfaf8)         | Walkthrough and acceptance record                              |
| [Stakeholder Handover & Evaluation](https://www.notion.so/3f7cd8a5bf088104af2dd9e21e72e4bf) | Meeting agenda, feedback and closure                           |
| [Sprint 6 Stakeholder Handover](https://www.notion.so/3bfcd8a5bf08819ab9faea0f114d2006)     | Product journeys, limitations and acceptance checks            |

Historical Notion release SHAs, test results and renderer descriptions are not a
statement about the current delivery. Repository commands, manifests, routes,
worker entry points and CI were used to reconcile technical instructions. The
current import worker uses CPU simulation and does not require Playwright
Chromium. The analyser delivers queued results through the web callback rather
than receiving a Supabase service-role key.

After changing a feature or provider, update its guide and the related reference.
Before acceptance, record the exact release and run the instructions on the
receiving machine. Cross-platform installation and live provider journeys remain
acceptance checks until actual results are entered.
