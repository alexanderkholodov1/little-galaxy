# Galaxy plan of record

This repository owns the independent game currently called **Collective Galaxy**. Its final
memorable name will be chosen in the dedicated design session. `galaxy` is the repository name;
`/galaxy` in older documents is a prototype path, not the final public URL.

**M0 approved with corrections, 2026-10-09:** complete planning and commit it here. Priority is
galaxy first, portfolio second. The small, production-quality first experience is approved.
Application implementation has not started; M1 is the next boundary.

**Required entry:** fair QR → game directly → visitor enters a name → sees/explores the galaxy
and accesses other actions → can choose to create. Creation is optional. A profile visit is not
required. A person discovering the portfolio separately can also follow its project link.

The public URL is intended to be `alexanderkholodov.web.app/<game-name>`, with the name and
exact path still pending. No new hostname or public name is authorized by M0.

| Document | Purpose |
| --- | --- |
| [10-construction-proposal.md](10-construction-proposal.md) | Corrected M0 plan, engineering targets and explicitly provisional sketches |
| [08-decisions.md](08-decisions.md) | Current decisions, precedence and open design topics |
| [06-roadmap.md](06-roadmap.md) | Game-only milestones without calendar-day assignments |
| [00-context.md](00-context.md) | Fair context and historical submitted application |
| [01-product-spec.md](01-product-spec.md) | Earlier feature baseline, corrected entry and design-session boundaries |
| [02-architecture.md](02-architecture.md) | Game architecture and integration responsibilities |
| [03-data-and-security.md](03-data-and-security.md) | Data/rules baseline and questions to validate |
| [05-live-deploys-and-ops.md](05-live-deploys-and-ops.md) | Recovery, compatibility and testing |
| [07-operator-checklist.md](07-operator-checklist.md) | Game-only external dependencies |
| [09-sources.md](09-sources.md) | Engineering references |
| [90-idea-backlog.md](90-idea-backlog.md) | Open, non-exhaustive ideas |
| [CHANGELOG.md](CHANGELOG.md) | Plan provenance and changes |

Current operator corrections in 08 take precedence over earlier defaults or historical wording.
The interaction table in 10 is a provisional sketch-proposal, not approved design, an exhaustive
feature list or a restriction on new ideas. Hold the dedicated session before settling behavior.

## Excluded work

The assistant is **entirely excluded**: no investigation, spike, design, scaffold, dependency or
implementation. Its old document is preserved unmodified in [the archive](../archive/README.md),
outside the active plan. Old application promises do not reactivate it.

## Repository boundary and plan changes

Portfolio owns its profile/content, branding and project hosting contract in
[its own plan](../../../portfolio/docs/plan/README.md). It will host many projects. Keep
game-specific implementation, issues and decisions here; exchange versioned public contracts
and release artifacts rather than importing each other's source.

Relative links assume sibling local checkouts. The other repository is
[alexanderkholodov1/portfolio](https://github.com/alexanderkholodov1/portfolio).

Apply direct operator corrections and record them. Implementation-level improvements can be
made with a stated reason. Propose material product, security or architecture changes before
implementing them unless already instructed. No calendar-day allocation; the operator retains
the October 21 delivery deadline and owns scheduling. Design remains open to additions.
