# Handover walkthrough and acceptance record

This file is the working record for the meeting and follow-up. Empty fields and
unchecked boxes mean pending, not passed. The Notion plan names Monday
19 October 2026 with a proposed two-hour meeting; confirm time, location and
attendance directly. No meeting or reminder is scheduled by this file.

## Prepare before the meeting

- [ ] Confirm Robert, his developer, project team attendees, time and meeting link/location.
- [ ] Send or provide this folder and the accepted release candidate for advance reading.
- [ ] Confirm receiving GitHub identity and whether the repository will be forked/transferred.
- [ ] Agree fresh catalogue installation versus retention of existing operational data.
- [ ] Prepare a small show, music with usage rights, an approved video clip and assortment QR.
- [ ] Prepare a Finale export and the client's Finale 3D installation for actual import testing.
- [ ] Complete automated checks and record results for the exact delivery commit.
- [ ] Rehearse hosted journeys and have a fallback demonstration recording available.
- [ ] Agree access transfer, running-cost review, backup and cutover responsibilities.

## Proposed two-hour agenda

| Time       | Activity                               | Expected outcome                                                      |
| ---------- | -------------------------------------- | --------------------------------------------------------------------- |
| 5 minutes  | Scope and identified release           | Shared understanding of the delivery and known limits                 |
| 15 minutes | Product guide walkthrough              | Robert can follow the main journeys                                   |
| 80 minutes | Developer setup and technical handover | Independent local setup, accounts, deployment and recovery understood |
| 10 minutes | Ownership and maintenance              | Billing, monitoring, backups and support owners agreed                |
| 10 minutes | Feedback and next steps                | Acceptance or specific outstanding actions recorded                   |

The receiving developer should type the setup/authentication steps themselves.
If image/model downloads or transfers exceed the meeting, record the remaining
step with an owner and retest date rather than marking the setup complete.

## Product demonstration order

1. Sign in, explain standard access and the separate administrator role.
2. Browse Catalogue and Explore, then open a representative product/template.
3. Create a show without music and inspect timeline, replay and shopping list.
4. Demonstrate music upload/analysis and optional Jamendo on the receiving environment.
5. Make a cue edit, save, reload and show that it persists.
6. Export to Finale, inspect unmatched warnings and open the file in Finale 3D.
7. Open an assortment QR on a signed-out phone and verify quantity-constrained generation.
8. Open Admin catalogue, imports, presets, roles and generation recovery.
9. Explain illustrative store statistics, preview top-ups and unavailable paid plans.

## Developer walkthrough order

1. Confirm repository access and the accepted release tag/commit.
2. Follow the operating-system section of [Local setup](local-setup.md).
3. Start the local stack, generate the env file and sign in with a fixture account.
4. Confirm accounts, provider projects and secure secret access using the account register.
5. Explain the web/database/Modal boundaries and renderer contract.
6. Walk through a checked release, migrations, web deployment and separate Modal deployments.
7. Locate logs and demonstrate bounded job recovery in a suitable test environment.
8. Review backup/restore, monitoring, costs and the old environment retirement plan.

## Delivery identity

| Field                                                    | Confirmed value |
| -------------------------------------------------------- | --------------- |
| Accepted release tag and full commit                     | Pending         |
| Receiving repository URL                                 | Pending         |
| Deployed web URL and Vercel build ID                     | Pending         |
| Supabase project reference and installed migration state | Pending         |
| Modal workspace and analyser deployment/endpoints        | Pending         |
| Modal importer deployment/endpoint                       | Pending         |
| Local setup OS, CPU architecture and tool versions       | Pending         |
| Attendees and meeting date/time                          | Pending         |
| Secure credential item references, no values             | Pending         |
| Client owner and maintenance developer                   | Pending         |

## Acceptance matrix

For each row record pass/fail/not applicable, tester, date, build/environment and
an evidence reference. Mark an optional integration not applicable only if its
exclusion is explicitly agreed.

| Check                            | Expected result                                                       | Result / tester / date / evidence |
| -------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| Clean local setup                | Developer installs from the guide without undocumented steps          | Pending                           |
| macOS setup, if applicable       | Local stack and replay work on receiving Mac                          | Pending                           |
| Windows/WSL setup, if applicable | Linux toolchain, Docker and browser work together                     | Pending                           |
| Linux setup, if applicable       | Docker access, local stack and replay work                            | Pending                           |
| Hosted signup/login/recovery     | Real email arrives; correct-origin links work                         | Pending                           |
| Administrator                    | Intended verified UUID can perform authorised admin actions           | Pending                           |
| Standard-user permissions        | Admin-only changes and other users' private data are refused          | Pending                           |
| Catalogue and media              | Approved content and previews load from receiving Storage             | Pending                           |
| Basic show                       | Generate, edit, save, reload and reopen work                          | Pending                           |
| Music analysis                   | Model available; dispatch/callback/cues complete; credit settles once | Pending                           |
| Jamendo, if included             | Permitted search/import and analysis work                             | Pending                           |
| LLM mode, if included            | Intended model/key works within agreed budget                         | Pending                           |
| Video import, if included        | Dispatch, fitting, review and approved publication work               | Pending                           |
| Stalled-job recovery             | Bounded recovery result and failure handling understood               | Pending                           |
| Desktop/mobile replay            | Representative and dense shows reviewed on named devices              | Pending                           |
| Finale                           | File actually opens; product mappings/warnings reviewed               | Pending                           |
| Public QR                        | Signed-out phone opens link; repeated generation respects quantities  | Pending                           |
| Receiving release                | Actions migrate then deploy intended commit; targets agree            | Pending                           |
| Backups and restoration          | Isolated restore tested; data/media/config coverage documented        | Pending                           |
| Costs and service ownership      | Client can access billing, usage and alerts for active providers      | Pending                           |
| Independent operation            | Developer can restart, diagnose and release without team credentials  | Pending                           |

Automated checks do not replace live provider, browser, Finale or stakeholder
quality acceptance. Include command/CI run references in the evidence where useful.

## Open issues and accepted limitations

Seed the register with the [product guide's known limitations](product-guide.md#known-limitations-to-explain-at-handover),
then add observed issues. Agree whether each item is fixed before delivery,
accepted as a limitation or assigned as future work.

| Issue / affected feature | Impact and workaround | Agreed outcome | Owner   | Due date / verification |
| ------------------------ | --------------------- | -------------- | ------- | ----------------------- |
| To record                | Pending               | Pending        | Pending | Pending                 |

## Ownership and ongoing support

- [ ] Receiving accounts and billing confirmed for every active provider.
- [ ] Developer can independently clone, run, deploy and inspect logs.
- [ ] Administrator, recovery mailbox and provider recovery access confirmed.
- [ ] Backups, retention, monitoring and spend alerts have named owners.
- [ ] Secret rotation and removal of outgoing team access have an agreed sequence/date.
- [ ] Domain cutover and previous environment retirement are agreed and tested.
- [ ] Documentation, release assets, demo materials and relevant issue records received.
- [ ] Maintenance responsibilities, support contact and support end date recorded.

| Agreement                                             | Details |
| ----------------------------------------------------- | ------- |
| Billing owner and operational review cadence          | Pending |
| Maintenance and incident owner                        | Pending |
| Backup/restore owner and observed recovery time       | Pending |
| Support scope, contact and end date                   | Pending |
| Old environment/access retirement date and conditions | Pending |
| Stakeholder feedback and requested corrections        | Pending |
| Robert's acknowledgement and acceptance date          | Pending |

## Follow-up and closure

The Notion plan places follow-up in Week 12. Confirm the actual date with Robert
and his developer. Check independent operation, resolve or assign reported issues,
verify corrections and record final acknowledgement. Complete the tutor and
stakeholder evaluation using the agreed course process. The Notion delivery plan
lists plan, execution and stakeholder evaluation as assessment areas; confirm
submission/evaluation arrangements with the tutor rather than treating this guide
as an assessment submission.

- [ ] Follow-up completed and receiving system still operational.
- [ ] Outstanding actions have agreed owners, dates and outcomes.
- [ ] Client feedback, accepted limitations and acknowledgement recorded.
- [ ] Stakeholder/tutor evaluation completed through the agreed process.
- [ ] Final materials accessible to the receiving team.
- [ ] Project closure and any remaining support period recorded.
