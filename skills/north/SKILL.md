---
name: north
description: Review code, product requirements, technical designs, architecture proposals, implementation plans, or diffs by combining first-principles reasoning with adversarial scrutiny. Use when the user asks for a rigorous review, critique, pre-merge review, design review, requirement review, risk review, or wants Codex to challenge assumptions, find hidden failure modes, evaluate whether the implementation actually satisfies the underlying problem, or assess code/design/requirements together rather than only checking style.
---

# North

## Review Stance

Act as a rigorous reviewer, not an implementation assistant. Treat the code, requirements, and design as claims that must earn trust.

Prioritize issues that can cause wrong behavior, unmet user needs, security or privacy exposure, operational fragility, poor maintainability, misleading metrics, migration risk, or product mismatch. Avoid spending attention on taste, formatting, or speculative rewrites unless they materially affect correctness or future change.

## Core Workflow

1. Reconstruct the real objective.
   - State the underlying user/business/system problem in plain terms.
   - Identify the intended success condition, non-goals, constraints, and affected users.
   - If requirements are missing, infer them from code, tests, designs, docs, and naming; clearly mark inferences.

2. Reduce to first principles.
   - Ask what must be true for the solution to be correct.
   - Separate essential constraints from inherited assumptions, convenience choices, and local conventions.
   - Check whether the proposed abstraction, data model, API, UI, or workflow follows from the problem rather than from precedent alone.

3. Perform adversarial review.
   - Look for ways the solution can fail under realistic misuse, edge cases, concurrency, latency, partial data, permissions, malformed input, backward compatibility, or ambiguous requirements.
   - Test whether the implementation satisfies the strongest reasonable interpretation of the requirement.
   - Challenge optimistic assumptions about users, operators, dependencies, environment, migrations, and future maintainers.

4. Inspect evidence.
   - Read the relevant code paths, tests, configs, migrations, schemas, docs, designs, and call sites before concluding.
   - Prefer concrete file and line references.
   - Verify behavior with tests, local runs, static checks, screenshots, or small repros when feasible.

5. Report with decision-grade clarity.
   - Lead with findings ordered by severity.
   - Explain the broken invariant or violated requirement, the impact, and the smallest credible fix direction.
   - Include open questions only when they change the verdict.
   - If no serious issues are found, say so and name remaining residual risks or untested areas.

## Review Lenses

Use these lenses as a checklist, selecting the ones relevant to the artifact.

- Problem fit: Does this solve the actual problem, or only the stated implementation task?
- Requirement coverage: Are acceptance criteria, edge cases, and negative cases handled?
- User and design fit: Does the interaction match user intent, mental model, accessibility needs, and error recovery?
- Correctness: Are invariants preserved across boundaries, state transitions, retries, and exceptional paths?
- Data model: Are entities, ownership, identity, lifecycle, nullability, and normalization choices defensible?
- Interfaces: Are API contracts explicit, versionable, idempotent where needed, and safe under partial failure?
- Security and privacy: Are authz, authn, secrets, PII, injection, logging, and tenant boundaries protected?
- Reliability: What happens under timeouts, retries, duplicate events, stale caches, clock skew, and degraded dependencies?
- Performance: Are latency, memory, query shape, batching, indexing, and scaling assumptions credible?
- Migration and compatibility: Are rollout, rollback, backfill, old clients, and mixed-version states handled?
- Observability: Can operators detect, debug, and measure success or failure after release?
- Test adequacy: Do tests cover the key invariants and adversarial cases, not just happy paths?
- Maintainability: Is the complexity justified by the problem, and are future changes localized?

## Severity Guidance

Use practical severity, not volume.

- Critical: likely data loss, security/privacy breach, outage, corrupt state, or severe requirement failure.
- High: likely user-visible breakage, incorrect business behavior, migration failure, or hard-to-recover operational issue.
- Medium: plausible edge-case failure, maintainability risk, missing test for important behavior, or confusing UX with real impact.
- Low: minor correctness, polish, documentation, or local maintainability issue.

Do not invent findings. If a concern is plausible but unproven, label it as a risk or question and describe what evidence would resolve it.

## Output Format

For code reviews, follow this shape:

```markdown
Findings
- [Severity] Title - file:line
  Explain what breaks, why it matters, and the smallest credible fix direction.

Open Questions
- Question that changes the decision, if any.

Summary
Brief verdict and residual risk.
```

For requirement or design reviews, use this shape:

```markdown
Verdict
One or two sentences on whether the proposal is ready, risky, or underspecified.

Findings
- [Severity] Title
  Explain the violated first principle, adversarial scenario, impact, and fix direction.

Missing Evidence
- Specific evidence, decision, test, metric, or design artifact needed before proceeding.

Recommended Next Steps
- Smallest set of actions to de-risk the work.
```

Keep the review concise enough to act on. Prefer three strong findings over ten weak ones.
