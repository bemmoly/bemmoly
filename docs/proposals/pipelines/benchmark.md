# Bemmoly Pipelines: market benchmark (October 2026)

Checked 16 October 2026 against product-design.html and architecture.html (draft 2). The build renames System/Service to Group/Application; this note uses the draft's words. Vendor docs are the main source. **[u]** marks anything I could not confirm from a primary source, or that comes from secondary sites or memory.

## 1. Comparison table

Abbreviations: OSS = open source, SH = self-hosted, AR = automatic rollback.

| Product | Catalog / ownership | Envs and promotion | Approvals, gates, policy | Progressive delivery, AR | Runners and speed | Multi-cloud | DX highlight | Pricing | OSS |
|---|---|---|---|---|---|---|---|---|---|
| **GitHub Actions** | CODEOWNERS only | Environments with scoped vars and secrets; no promotion object | Reviewers, wait timers, custom protection-rule Apps (preview) | None | Hosted or SH; ARC; scale-set client (preview, Feb 2026) | Scripted | Marketplace, reusable workflows, merge queue, re-run failed jobs, cron with time zone (2026) | Per minute; hosted −39% on 1 Jan 2026; self-hosted $0.002/min fee **postponed** | Runner |
| **GitLab** | Groups | Environments, review apps | Approvals, deploy freezes, resource groups, outdated-deploy guard; **release evidence** | Rollback = re-run an old pipeline; Deploy Boards deprecated (14.5) | SH runners | Scripted | Merge trains, CI/CD components **[u]**, Duo Root Cause Analysis | Premium $29/user/mo | Core |
| **Jenkins** | None | Plugins | Input step | Plugins | SH agents | Scripted | Pipeline Graph View replaces Blue Ocean (2026) | Free | Yes |
| **CircleCI** | None | Contexts **[u]** | Approval jobs | None | Cloud or SH runners | Scripted | Rerun failed tests only, rerun with SSH, timing splits, Chunk AI flaky fixes (beta) | Credits; from $15/mo | No |
| **Buildkite** | Clusters | None | Block/input steps | None | Your agents, plus hosted at $0.004/vCPU-min | Scripted | Dynamic pipelines; Test Engine (flaky, quarantine, splitting, owners) | $30/active user/mo | Agent |
| **Harness** | Services, IDP | Env groups, GitOps | **OPA/Rego** policy sets; freezes | **Continuous Verification**: ML on metrics and **logs**, AR | Delegates; Test, Cache and Build Intelligence | Strong | Broadest enterprise set | Per service license (1 per 20 instances); unpublished | Partly |
| **Argo CD + Rollouts** | Apps, projects | No cross-app promotion | RBAC, sync windows **[u]** | AnalysisTemplates; abort and reset to 0% | Pull agent | Kubernetes | Live sync, health and drift tree | Free | Yes |
| **Kargo** | Projects | **Warehouse → Freight → Stages**, auto-promote, `MatchUpstream`, promotion steps | Freight approval per stage, windows | Verification via AnalysisTemplates | Pull | Kubernetes | Drag-to-promote freight view | OSS plus Akuity | Yes |
| **Spinnaker** | Apps | Pipelines | Manual judgment, windows | **Kayenta**: score 0–100 → pass / **marginal (human)** / fail | n/a | Strong | Heavy; Harness bought Armory's assets **[u date]** | Free | Yes |
| **Cloud Deploy** | None | Pipelines → targets; automation: auto-promote, advance canary, **repair (retry then rollback)** | Approvals via Pub/Sub; **deploy policies** with a **policy-overrider role** | Canary phases, verify | Cloud Build | GCP | Skaffold | Per pipeline **[u]** | No |
| **AWS CodePipeline** | None | Stages | **Stage conditions**: CloudWatch alarm, deploy-window cron, Lambda; **override** | Rollback result; CodeDeploy alarm AR **[u]** | CodeBuild | AWS | Console | Per pipeline **[u]** | No |
| **Octopus** | Projects, **tenants** | **Lifecycles** (phases, auto-deploy, optional, retention per phase) | Manual steps, ITSM, global freezes | Limited | Tentacles, workers | Strong, plus Argo CD (Oct 2025) | **Runbooks** for day-2 ops | Server $2,080 / $15,600 a year | No |
| **Codefresh GitOps** | Products over Argo | Promotion flows across Argo instances (Mar 2025) | Promotion policies | Rollouts | Pull | Kubernetes | Environments dashboard | From $4,170/yr | Partly |
| **Vercel** | Projects | Preview → prod | Protection | **Rolling releases** and **instant rollback** | Managed | No | Preview URL per PR | Seat plus usage | No |
| **Render / Railway / Northflank** | Projects | Previews from a blueprint or env clone; Northflank release flows in Git | Basic | Rollback | Managed; Northflank BYOC | Northflank | Full-stack PR environments with TTL | Usage | No |
| **Backstage / Port / Cortex** | **Catalog, scorecards, initiatives** | Display | Port holds deploys on scorecard gaps | n/a | n/a | n/a | Failed rule → fix action or PR | Port $30–40/seat | Backstage |
| **Dagger** | n/a | n/a | n/a | n/a | Function caching (0.19.4 **[u]**) | Any | **Same pipeline locally and in CI**; cache-hit traces | Cloud $50/mo **[u]** | Yes |
| **Depot / Blacksmith / Namespace** | n/a | n/a | n/a | n/a | Drop-in runners, colocated cache, layer cache, **SSH into a job**, test analytics | n/a | One-line swap | Per minute | No |
| **Graphite / Trunk queue** | n/a | n/a | Checks | n/a | n/a | n/a | Stack-aware queue, batching with bisection | Per seat | No |
| **LaunchDarkly** | Flags | Flag rollouts | Flag approvals | **Guarded rollouts**: sequential test, AR, forced rollback on SRM or low traffic | n/a | n/a | Release separate from deploy | Usage **[u]** | No |
| **Datadog / Trunk tests** | Test owners | n/a | n/a | n/a | n/a | n/a | **Quarantine** by failure rate; "attempt to fix" | ≈$20/committer **[u]** | No |
| **Sleuth / LinearB / DX** | Teams | Deploy tracking | gitStream PR rules | n/a | n/a | n/a | DORA, DX Core 4 | Per dev | No |

## 2. Features we have not planned, ranked for a 500-engineer company

Effort: S ≈ under 2 weeks, M ≈ 2–6 weeks, L ≈ over 6 weeks, for one stream.

1. **Flaky-test management with quarantine.** *What:* track each test's history across runs. A test marked flaky keeps running, but its failure no longer fails the run. It gets an owner. *Best:* [Trunk](https://trunk.io/flaky-tests), [Datadog](https://docs.datadoghq.com/tests/flaky_management/), [Buildkite Test Engine](https://buildkite.com/docs/test-engine). *Why:* at 75,000 jobs a day, flakes are the biggest daily tax on engineers. We already compute "failed 3 of 50 on main" but do nothing with it. *Recommendation:* **Phase 2, M.** Store per-test results, not just timings. Add quarantine by policy, with failure rate over 7 days. The owner comes from the catalog. Works in Bring your CI through the JUnit we already ingest.
2. **Alarm-based automatic rollback, earlier than full canary analysis.** *What:* roll back when an existing alert fires within N minutes of a deploy. *Best:* [CodePipeline stage conditions](https://docs.aws.amazon.com/codepipeline/latest/userguide/stage-conditions.html), [Cloud Deploy repairRollout](https://docs.cloud.google.com/deploy/docs/automation). *Why:* we have no automatic rollback until phase 3, behind Vercel, AWS and Google. *Recommendation:* **Phase 2, S–M.** A gate and a watch on "alert X is firing", or "error rate above threshold", with a configurable bake time. Keep the statistical canary for phase 3.
3. **Runbooks and day-2 actions.** *What:* parameterised, audited operations per service and environment: restart, scale, run a migration, flush a cache, rotate a secret. *Best:* [Octopus Runbooks](https://octopus.com/docs/runbooks), Port self-service actions. *Why:* the SRE persona today has only rollback. They reuse deployer identity, policy and audit. *Recommendation:* **Phase 2, M.** On the Service screen, under the same CEL policies.
4. **Ephemeral preview environments.** *What:* one environment per pull request with a URL, destroyed on merge or after idling. *Best:* [Vercel](https://vercel.com/docs/rolling-releases), [Render](https://render.com/docs/preview-environments), [Railway](https://docs.railway.com/guides/preview-deployments-with-pr-environments), [Northflank](https://northflank.com/docs/v1/application/release/pipeline/create-and-manage-previews). *Why:* developers' favourite feature. We already plan Cloud Run tagged revision URLs, so a stateless preview is nearly free. *Recommendation:* **move from phase 3 to phase 2, M,** for stateless container services. Add TTLs. Previews with databases stay in phase 3.
5. **Remote build cache and step-level caching as a service.** *What:* a Bazel REAPI, Gradle, Turborepo or Nx-compatible remote cache, plus content-addressed step caching. *Best:* [Depot](https://depot.dev/docs), [Harness Build Intelligence](https://developer.harness.io/docs/continuous-integration/use-ci/build-and-upload-artifacts/build-intelligence), [Nx](https://nx.dev/docs/guides/tasks--caching/self-hosted-caching) (self-hosted needs a Powerpack licence), Dagger. *Why:* the main speed lever after affected-service detection. The plan names it but does not design it. *Recommendation:* **Phase 2, M.** Offer cache endpoints backed by the per-pool bucket.
6. **Re-run with SSH or a debug shell.** *What:* re-run a failed job and keep the runner open for an interactive shell. *Best:* CircleCI rerun-with-SSH, [Blacksmith](https://docs.blacksmith.sh/introduction/quickstart), GitLab web terminal. *Why:* it ends push-and-pray debugging. Outbound-only runners need a relay through the control plane. *Recommendation:* **Phase 2, M.** Browser terminal plus `bp ssh`. Time-boxed and audited. Never on Tier 0 pools.
7. **Production readiness scorecards as gates.** *What:* rules per tier (has on-call, runbook, SLO, alerts, owner, a recent deploy, template not out of date), scored Bronze, Silver or Gold. *Best:* [Port](https://docs.port.io/solutions/engineering-intelligence/use-cases/standards-and-scorecards/production-readiness), [Cortex](https://www.cortex.io/products/scorecard). *Why:* "No owner blocks Prod" is already a scorecard rule. Scorecards generalise it. *Recommendation:* **Phase 2, M.** Scorecard rules are CEL over catalog facts. A failing rule offers a fix PR, using the campaign machinery.
8. **Basic matrix builds, manual inputs, cron.** *What:* `matrix:`; run with typed inputs from the UI or `bp run --input`; scheduled runs with a time zone. *Best:* GitHub Actions (IANA time zone for cron added in 2026). *Why:* table stakes, and the first complaint from teams leaving GitHub Actions. *Recommendation:* **Adopt now (phase 1 schema), S.**
9. **Feature-flag integration.** *What:* ingest flag changes into What changed?, gate on a flag state, coordinate a deploy with a flag ramp. *Best:* [LaunchDarkly guarded rollouts](https://launchdarkly.com/docs/home/releases/creating-guarded-rollouts). *Why:* many incidents are flag flips. Without them, What changed? is incomplete. *Recommendation:* **Phase 2, S** for an OpenFeature/webhook event ingest. **Phase 3, M** for coordinated plans.
10. **Failure fingerprinting and AI triage.** *What:* group failures by normalised error signature across runs ("this failure hit 14 services since 09:10"), then explain it with AI and propose a fix PR. *Best:* [GitLab Duo RCA](https://docs.gitlab.com/releases/17/17_3), [GitHub Agentic Workflows "CI Doctor"](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/) (technical preview, Feb 2026), [CircleCI Chunk](https://circleci.com/docs/guides/test/fix-flaky-tests). *Why:* fleet-wide breakages (a bad base image, a registry outage) are common at 1,000 services. *Recommendation:* fingerprinting in **phase 2, M** (no AI needed). AI explanation in phase 3 is behind the market. Pull it into phase 2 if the AI module is ready.
11. **Cost per run, pipeline, team and service.** Nobody does this well. Datadog sells savings, not a per-run figure. **Phase 2, S.** Runner seconds × machine price from the provider's Cost interface, on every run and rolled up in Capacity.
12. **DORA early, in today's definitions** (Octopus Enterprise, Sleuth, DX). DORA now says "failed deployment recovery time" and adds rework rate **[u]**. **Phase 2, S.** The events are already recorded.
13. **Signing and SLSA L3 from our builder.** [GitHub attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) give Build L2, and L3 only through reusable workflows. **Phase 2, M.** Keyless Sigstore signing with our OIDC issuer from isolated runners, verified at deploy.
14. **Merge queue batching and bisection** (Graphite, Trunk). **Skip or phase 3.** Rely on GitHub's queue and feed it flaky data.
15. **GitOps sync status and drift.** See §3.2. **Phase 2, M.**
16. **Retention by class** (Octopus sets it per lifecycle phase). **Phase 1, S.** Keep Prod deploy logs and evidence for years and pull-request logs for 14 days, not a flat 30 days.
17. **Log-based verification** ([Harness CV](https://developer.harness.io/docs/continuous-delivery/verify/verify-deployments-with-the-verify-step) log clustering). **Phase 3, L.** Start with "new error signature only in the canary", using item 10.
18. **Tenants** (Octopus). **Phase 3**, only if single-tenant SaaS customers ask.
19. **Mobile store releases** ([Runway](https://runway.team/use-case/release-trains)). **Skip.** Offer a fastlane step.

Already planned and at or above market: environment-scoped secrets, reusable templates and fleet campaigns, pipeline visualisation (StageGraph), deploy freezes, release evidence (change records), monorepo affected builds, test splitting, superseding, fair share.

## 3. Where our plan is weaker or misaligned

1. **No automatic rollback until phase 3, and a naive verdict when it arrives.** "Two failing samples in a row" has no minimum sample size and no middle verdict. Kayenta returns success, **marginal → human** or failure. LaunchDarkly rolls back when there is too little traffic to judge. *Change:* alarm-based AR in phase 2 (§2 item 2). Make phase 3 use a scored judge with three outcomes, minimum-sample rules, and a stated behaviour when metrics are missing. Today "waiting" could stall a rollout forever.
2. **Push-only deploys, no GitOps mode, and runtime drift deferred.** The Kubernetes market (Argo, Kargo, Codefresh, and Octopus since Oct 2025) runs on Git-as-desired-state with live sync and health. Companies with 500 engineers often run Argo CD already. *Change:* add an `argocd`/GitOps target, where deploying commits to an environment repository and health comes from Argo. Show "running differs from released" (drift) on the Service screen from `describe(env)` in phase 2, not just the nightly landing-zone scan.
3. **Freeze and override semantics are underspecified.** Cloud Deploy has a `policyOverrider` role, and CodePipeline lets you override a condition. Both log the override. Our `deny_if: freeze.active` could block a rollback during a freeze. *Change:* rollbacks and runbooks marked `emergency` are exempt by default. Add a first-class **override with a reason**, bound to a role, recorded in the change record and announced.
4. **Policy in CEL only.** CEL is the right default for explanations, but security teams at this size often have Rego libraries (Harness uses OPA). *Change:* bring the planned "custom webhook gate" forward to phase 1 or 2, so external OPA or ServiceNow can decide. GitHub's custom protection rules prove the pattern.
5. **Logs are not searchable across runs.** Fine for cost, but it blocks fingerprinting, flaky analytics and "where else did this fail". *Change:* index error lines and test failures only, a small fraction of the 40 GB a day.
6. **Bring your CI trusts only GitHub OIDC.** GitLab (`id_tokens`), Buildkite and CircleCI all issue OIDC tokens **[u: Buildkite and CircleCI from memory]**. *Change:* add a generic OIDC trust rule per issuer in phase 1 (S), so Jenkins is the only token-based case.
7. **No local run.** Dagger's main argument is "the same pipeline on a laptop". *Change:* `bp run --local` executes the resolved pipeline with the local container runtime (phase 2, M).
8. **Insights, previews and AI are all phase 3.** That is where the visible "wow" lives, while phase 3 is also the AWS phase. *Change:* move DORA basics, stateless previews and fingerprinting to phase 2.
9. **Release = image plus config means config-only changes need a new release.** Kargo's Freight bundles several origins (image, manifests, chart) and promotes them together or separately. *Change:* allow a release to be a new config revision on an existing image digest, shown as such on the Promote screen.
10. **Pricing promise vs market (strength, keep it).** At 500 engineers, Buildkite Pro alone is about $180k a year before compute. Harness CD is per service. Octopus Enterprise Server is $15.6k a year plus add-ons. GitHub backed off charging for self-hosted minutes. "OSS, no subscription" is a real wedge. Do not sell caching or test analytics as paid tiers.

## 4. Wow factor we could own

- **Time travel for the whole company.** Nobody ships an organisation-wide, rewindable release map. Argo, Codefresh and Octopus show the present per app or environment. Keep it at the centre of the launch.
- **Undo anything from one timeline.** Deploys, config, flags, access grants and infrastructure, each with its own rollback. No product unifies flag and deploy rollback.
- **A verifiable change record.** Sign approvals, gate results and canary verdicts as in-toto attestations on the image digest, and verify them at deploy time ("this Prod image was approved by these two people under policy v14"). Build provenance is common. Signed approval provenance appears to be absent from the market **[u]**.
- **"Why?" everywhere,** including flaky ("quarantined since 3 Oct, owned by Payments") and cost ("$0.42, 3 min saved by cache").
- **Agent-aware delivery.** Policies can distinguish agent-authored changes (stricter gates, never self-approved). MCP can open promotions but never approve them. This fits 2026 agentic workflows, and no CD tool models it yet **[u]**.
- **Bundled and free.** Remote cache, test analytics, flaky quarantine, DORA and previews, all self-hosted with no seat price. Each one is a paid product elsewhere.
- **Blast-radius preview on Promote.** Callers from `dependsOn`, current traffic, and the last incident linked to this service, shown before you approve.

## 5. Sources (accessed 16 Oct 2026)

- GitHub Actions pricing update (Dec 2025, self-hosted fee postponed): https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/
- GitHub Actions 2026 security roadmap: https://github.blog/news-insights/product-news/whats-coming-to-our-github-actions-2026-security-roadmap/
- GitHub workflow execution protections GA (17 Sep 2026): https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/
- GitHub custom deployment protection rules: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/create-custom-protection-rules
- GitHub artifact attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- GitHub Agentic Workflows (Feb 2026): https://github.blog/ai-and-ml/github-copilot/automate-repository-tasks-with-github-agentic-workflows/
- GitLab deployment safety: https://docs.gitlab.com/ci/environments/deployment_safety/
- GitLab release evidence: https://docs.gitlab.com/user/project/releases/release_evidence/
- GitLab Deploy Boards (deprecated): https://docs.gitlab.com/user/project/deploy_boards/
- GitLab 17.3 (Duo RCA): https://docs.gitlab.com/releases/17/17_3
- GitLab pricing: https://about.gitlab.com/pricing/
- Jenkins Pipeline Graph View (Apr 2026): https://www.jenkins.io/blog/2026/04/06/plugin-of-the-month/
- CircleCI rerun failed tests: https://circleci.com/docs/guides/test/rerun-failed-tests/
- CircleCI Chunk flaky fixes: https://circleci.com/docs/guides/test/fix-flaky-tests
- CircleCI pricing: https://circleci.com/pricing/
- Buildkite Test Engine: https://buildkite.com/docs/test-engine
- Buildkite pricing: https://buildkite.com/pricing
- Harness Continuous Verification: https://developer.harness.io/docs/continuous-delivery/verify/verify-deployments-with-the-verify-step
- Harness policy as code: https://developer.harness.io/docs/continuous-delivery/x-platform-cd-features/advanced/cd-governance/harness-governance-overview
- Harness CI Intelligence: https://developer.harness.io/docs/continuous-integration/use-ci/harness-ci-intelligence
- Harness CD licensing: https://developer.harness.io/docs/continuous-delivery/get-started/service-licensing-for-cd
- Harness/Armory: https://robots.net/news/harness-acquires-assets-of-continuous-deployment-service-armory/
- Argo Rollouts analysis: https://argo-rollouts.readthedocs.io/en/release-1.4/features/analysis/
- Kargo concepts: https://docs.kargo.io/user-guide/core-concepts/
- Kargo stages: https://docs.kargo.io/user-guide/how-to-guides/working-with-stages
- Spinnaker canary judge: https://spinnaker.io/docs/guides/user/canary/judge
- Google Cloud Deploy overview: https://docs.cloud.google.com/deploy/docs/overview
- Cloud Deploy automation: https://docs.cloud.google.com/deploy/docs/automation
- Cloud Deploy deploy policies: https://docs.cloud.google.com/deploy/docs/deploy-policy
- AWS CodePipeline stage conditions: https://docs.aws.amazon.com/codepipeline/latest/userguide/stage-conditions.html
- Octopus lifecycles: https://octopus.com/docs/releases/lifecycles
- Octopus tenants: https://octopus.com/docs/projects/tenants
- Octopus Argo CD (Oct 2025): https://octopus.com/news/argo-cd-in-octopus-now-available
- Octopus pricing: https://octopus.com/pricing
- Codefresh GitOps Cloud (Mar 2025): https://codefresh.io/blog/introducing-codefresh-gitops-cloud
- Vercel rolling releases: https://vercel.com/docs/rolling-releases
- Vercel instant rollback: https://vercel.com/docs/instant-rollback
- Render previews: https://render.com/docs/preview-environments
- Railway PR environments: https://docs.railway.com/guides/preview-deployments-with-pr-environments
- Northflank release: https://northflank.com/docs/v1/application/release
- Port production readiness: https://docs.port.io/solutions/engineering-intelligence/use-cases/standards-and-scorecards/production-readiness
- Port pricing: https://www.port.io/pricing
- Cortex scorecards: https://www.cortex.io/products/scorecard
- Backstage 1.55 (InfoQ, Oct 2026): https://infoq.com/news/2026/10/backstage-1-55-task-recovery
- Dagger caching: https://docs.dagger.io/manuals/administrator/413929/caching
- Depot docs: https://depot.dev/docs
- Blacksmith quickstart: https://docs.blacksmith.sh/introduction/quickstart
- Namespace docs: https://namespace.so/docs
- Nx self-hosted cache: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching
- Graphite merge queue optimisations: https://graphite.com/docs/merge-queue-optimizations
- LaunchDarkly guarded rollouts: https://launchdarkly.com/docs/home/releases/creating-guarded-rollouts
- LaunchDarkly regression detection: https://launchdarkly.com/docs/eu-docs/home/releases/regression-detection
- Trunk flaky tests: https://trunk.io/flaky-tests
- Datadog flaky test management: https://docs.datadoghq.com/tests/flaky_management/
- DX Core 4: https://docs.getdx.com/dx-core-4/
- Sleuth deployments: https://help.sleuth.io/modeling-your-deployments/code-deployments
- Runway release trains: https://runway.team/use-case/release-trains
- Secondary (pricing estimates, DORA changes): https://www.spendhound.com/marketplace/harness-pricing, https://cicdpipelinecost.com/depot-pricing, https://typoapp.io/blog/dora-metrics-trackers
