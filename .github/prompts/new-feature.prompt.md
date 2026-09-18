---
description: "Orchestrate a new blipmap feature end-to-end, from planning through build and QA verification. Use when adding significant new functionality to blipmap."
agent: orchestrator
argument-hint: "Describe the feature to add (e.g. 'add photo attachments to Patches')"
---

Build the requested blipmap feature using the full engineering workflow:

1. **Classify** the task complexity. If trivial, implement directly. If complex, continue.
2. **Investigate** — spawn parallel Explore subagents for independent domain questions (data model, GIS patterns, affected components).
3. **Plan** — delegate to the `planner` agent with investigation findings. Planner produces a sequenced implementation plan.
4. **Implement** — delegate to `feature-builder` (full-stack), `component-author` (Lit only), or `gis-analyst` (spatial only) as appropriate.
5. **Review** — delegate to the `reviewer` agent. If it finds errors, return to implementation for repair.
6. **Verify** — delegate to the `qa` agent: type-check, tests, build, browser smoke. Fix any failures.
7. **Done** — confirm all acceptance criteria are met. A feature with failing tests or a broken build is not done.
