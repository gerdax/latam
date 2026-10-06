# Project instructions

## Project constraints

- Preserve the original documents, prototypes and source assets. Create new
  implementation files separately unless the user explicitly requests changes
  to the originals.
- Keep development and verification commands accurate; report any unverified
  editor, device or legacy-format checks.

## Agent orchestration

- GPT-6.1 Sol / medium is the default lead: objective, ambiguity, risk,
  architecture, decomposition, ownership, conflict resolution, integration and
  final acceptance.
- `explorer`: GPT-6 Luna / low for cheap, bounded, read-only exploration,
  reference lookup and mechanical investigation.
- `simple_worker`: GPT-6 Luna / low for mechanical edits and small, clearly
  specified fixes with explicit file ownership and straightforward verification.
  The Sol 6.1 lead inspects its edits and verification before accepting them.
- `worker`: GPT-6.1 Sol / medium for normal implementation; use supplied findings.
- `reviewer`: GPT-6.1 Sol / high for consequential independent review or difficult
  isolated diagnosis. It reports findings without edits; route fixes to an
  assigned worker.
- `expert`: GPT-6 Astra / medium for exceptionally demanding architecture or
  diagnosis: unresolved architectural choices, subtle cross-system problems,
  conflicting evidence or repeated failure of sensible Sol approaches. It gives
  read-only advice; Sol 6.1 retains integration and final acceptance.
- For difficult implementation needing Sol 6.1 / high, use an explicit
  `gpt-6.1-sol` / `high` spawn without the fixed medium worker role. For Astra /
  high, use an explicit `gpt-6-astra` / `high` spawn without the fixed medium
  expert role, retaining read-only advice. Custom role files can override spawn
  settings; do not rely on a conflicting override.

Choose the cheapest reliable model automatically; the user need not manage
routing. The escalation ladder is Luna/low -> Sol 6.1/medium -> Sol 6.1/high ->
Astra/medium -> Astra/high. Skip lower levels when the difficulty is already
clear; use Astra/high only when Astra/medium remains insufficient. Retry failed
cheap work once only with materially improved context or strategy; otherwise
escalate the blocked portion. Task size alone does not justify Astra or higher
reasoning. Return control to Sol 6.1 after resolving the difficult portion.

Delegate only when savings, bounded isolation, useful parallelism or independent
verification outweigh coordination. Tiny actions may stay with the lead. Give
each agent an objective, relevant context, constraints, owned files, expected
output and verification criteria. Use narrow briefs and concise evidence; avoid
full history forks, duplicate investigations and repeatedly loading large files.
Parallelize independent work with stable interfaces and avoid overlapping edits.
The project caps concurrent subagents at two, excluding the lead. Subagents must
not delegate further without explicit lead authorization.

If Luna is unavailable, use Sol 6.1. If Astra is unavailable, report the
limitation and continue with Sol 6.1 where feasible; surface any unresolved issue
that prevents reliable completion. Respect runtime model availability and
higher-priority instructions. Saved project model settings are defaults for
subsequent sessions, not a claim that the current chat's model has changed.

Role defaults are stored in `.codex/agents/`. If the runtime cannot select named
roles, use explicit model and reasoning settings and include the role constraints
in the brief. Never assume role files were loaded without runtime support.

## Workflow

Understand objective -> inspect relevant context -> identify ambiguity/risk ->
decompose if useful -> route bounded work -> parallelize where beneficial ->
implement -> run relevant deterministic checks -> independently review
consequential changes -> integrate -> Sol 6.1 lead accepts.

Done means requested behavior and important edge cases are covered, relevant
checks pass, no known regressions remain, and the lead has inspected the
integrated result. Scale checks and review to risk; trivial changes need no
review ceremony or irrelevant full suite. Surface product decisions, material
risks and meaningful ambiguity; handle routine routing internally. Report
verification limitations clearly. Astra review or acceptance is not mandatory.
