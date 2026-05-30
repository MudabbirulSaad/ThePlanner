# ThePlanner

ThePlanner turns rough product or engineering ideas into implementation-ready planning artifacts for human engineers and coding agents.

## Language

**Primary User**:
A solo founder or tech lead who needs to transform an ambiguous idea into coordinated planning artifacts for humans and coding agents.
_Avoid_: Generic user, customer, stakeholder

**Planning Graph**:
The canonical structured model of a plan, containing goals, requirements, decisions, risks, components, work items, dependencies, open questions, and review gates.
_Avoid_: Master document, source PRD, project file

**Work Item**:
An implementation-sized unit of work that can be assigned to a human or coding agent and may carry dependencies, readiness state, and review requirements.
_Avoid_: Issue, ticket, task

**AFK**:
A readiness label meaning a **Work Item** is agent-ready without further clarification because the desired outcome, context, boundaries, dependencies, and validation method are clear enough.
_Avoid_: AI-doable, automated, background task

**HITL Gate**:
A specific human decision, review, approval, clarification, credential/action, or risk acceptance required before a **Work Item** can continue safely.
_Avoid_: Human task, blocked, manual work

**Dependency Edge**:
A graph-wide relationship showing that one **Planning Graph** node relies on another before it can be considered ready, valid, or executable.
_Avoid_: Task dependency, issue link, blocker only

**Document Projection**:
A generated human-facing view of selected **Planning Graph** nodes for a specific audience and purpose.
_Avoid_: Source document, master PRD, independent spec

**Intake Brief**:
The messy starting input from the **Primary User**, which may include notes, transcripts, documents, issues, repo context, architecture notes, or other rough material.
_Avoid_: Prompt, idea, request

**Assumption**:
A statement the planner temporarily treats as true so planning can continue, but which has not been confirmed by the **Primary User** or trusted source material.
_Avoid_: Hidden inference, guess, implied requirement

**Decision**:
A committed choice among alternatives, including the question decided, selected option, rationale, status, useful rejected alternatives, and links to affected graph nodes.
_Avoid_: Assumption, preference, note

**Open Question**:
An unresolved information need that may improve the plan, reduce uncertainty, or guide future scope without necessarily blocking execution.
_Avoid_: Blocker, HITL item, unknown

**Requirement**:
A desired product or system capability, quality, or constraint that the plan intends to satisfy.
_Avoid_: Wish, feature idea, task

**Risk**:
A possible future failure or negative outcome that may affect requirements, decisions, **Work Items**, delivery confidence, safety, quality, or user trust.
_Avoid_: Blocker, issue, problem

**Blocker**:
A derived **Work Item** readiness state caused by a current condition that prevents progress.
_Avoid_: Risk, HITL Gate, standalone issue

**Component**:
A planned or existing part of the system that owns responsibilities, has boundaries, and exposes interfaces or contracts with other components.
_Avoid_: Code module only, file, folder

**Kanban Projection**:
A board view of **Work Items** grouped for human planning and execution visibility.
_Avoid_: Source board, independent tracker, canonical workflow

**Execution State**:
The lifecycle state of a **Work Item**, such as backlog, ready, in progress, review, done, cancelled, or deferred.
_Avoid_: Readiness label, AFK status, blocker cause

**Agent-eligible**:
A readiness label meaning a **Work Item** is suitable in principle for a coding agent but may still need clarification, resolved dependencies, accepted decisions, context, or validation instructions before execution.
_Avoid_: AFK-ready, automated

**AFK-ready**:
A readiness label meaning a **Work Item** is **Agent-eligible** and satisfies the stricter **AFK** criteria for immediate autonomous attempt.
_Avoid_: Agent-eligible, AI-suggested

**Human-only**:
A readiness label meaning a **Work Item** should not be assigned to an autonomous coding agent because it requires human judgment, authority, access, taste, accountability, legal or business responsibility, or relationship context.
_Avoid_: Blocked, not AFK

**Markdown-first Repository Export**:
The MVP integration boundary where planning artifacts are written as predictable, diff-friendly Git-tracked Markdown and structured files before external tracker sync is supported.
_Avoid_: Tracker sync, remote issue export, hidden workspace

**Graph Reconciliation**:
The workflow that compares the current **Planning Graph**, exported files, and user or agent edits to propose safe graph patches or artifact regeneration.
_Avoid_: Blind regeneration, manual overwrite, independent document truth

**Graph Validation**:
The mandatory check that verifies a **Planning Graph** is internally consistent and safe enough for export or **AFK-ready** labeling.
_Avoid_: Lint only, optional check, syntax validation

**Work Item Projection**:
A Markdown export of a **Work Item** containing machine-readable YAML frontmatter and human-readable execution instructions.
_Avoid_: Raw issue, plain task, tracker ticket

**Serialized Planning Graph**:
The canonical machine-readable `planning/graph.json` export of the **Planning Graph**, validated structurally by `planning/graph.schema.json`.
_Avoid_: YAML graph, Markdown source, implicit graph

**MVP Workflow**:
The initial end-to-end flow from **Intake Brief** through draft graph, human clarification, validation, repository export, execution, and reconciliation.
_Avoid_: Tracker sync workflow, autonomous implementation loop, full project management suite

**Structured Clarification**:
The workflow where the planner asks grouped, answerable questions tied to specific **Planning Graph** nodes instead of running an open-ended chat loop.
_Avoid_: Freeform chat, exhaustive questionnaire, brainstorming only

**Clarification Priority**:
The execution-impact ordering used to decide which unresolved graph items the planner asks about first.
_Avoid_: Question order, chat flow, curiosity ranking

**Execution Slice**:
The smallest coherent set of **Work Items** that delivers a validated increment toward the plan.
_Avoid_: Milestone, epic, sprint

**Stable Graph ID**:
A planner-generated typed identifier that remains stable across title, filename, and projection changes.
_Avoid_: Title-derived ID, file path identity, reusable ID

**Archived Node**:
A graph node removed from active projections but retained in graph history or archive metadata so identity and old references remain understandable.
_Avoid_: Hard delete, hidden removal, ID reuse

**Graph Version**:
A monotonically increasing internal revision number stored in `planning/graph.json` that changes whenever canonical graph content changes.
_Avoid_: Git commit, export version, document revision

**Provenance**:
Metadata explaining where a **Planning Graph** node came from and why it exists.
_Avoid_: Hidden origin, untraceable inference, anonymous generation

**Repo Scan**:
Explicit, scoped, read-only analysis of repository files to extract context, components, constraints, commands, existing architecture, and implementation risks.
_Avoid_: Code modification, secret scan dump, full repository ingestion

**CLI-first Interface**:
The MVP interface direction where local planner workflows are exposed through terminal commands backed by a reusable core library.
_Avoid_: Web-first MVP, autonomous agent runner, tracker-first workflow

**TypeScript/Node Stack**:
The V1 implementation stack for the planner CLI, core library, validation, projections, and tests.
_Avoid_: Python-first MVP, untyped graph core, runtime-only graph shape

**Hexagonal Architecture**:
An architectural style where the core planner domain is independent from delivery mechanisms, storage, providers, scanners, and external integrations.
_Avoid_: CLI-coupled core, filesystem-first domain, provider-locked planner

**LLM Adapter**:
A swappable adapter that proposes graph operations, clarification prompts, projections, reconciliation patches, summaries, or candidate risks, assumptions, and decisions.
_Avoid_: Source of truth, domain rule engine, direct graph writer

**Graph Operation**:
A deterministic domain command that describes one intended mutation to the **Planning Graph**, such as adding an **Open Question**, adding a **Requirement**, adding a **Decision**, adding a **Work Item**, adding a **Dependency Edge**, updating **Execution State**, or archiving a node.
_Avoid_: Raw JSON patch, provider response, direct file edit

**Proposed Graph Operation**:
A structured, untrusted graph operation candidate produced by an **LLM Adapter**, **Graph Reconciliation**, **Repo Scan**, CLI flow, or future integration before schema validation, semantic **Graph Validation**, and required approval.
_Avoid_: Accepted graph change, generated graph, direct mutation

**GraphOperationProposer**:
An application-layer port that asks a proposal source to return **Proposed Graph Operations** from an **Intake Brief**, user answer, repo context, run result, or review artifact.
_Avoid_: LLM client, planner core, mutation service

**Graph Operation Approval**:
The rule set determining which proposed graph operations require explicit **Primary User** approval before they affect canonical planning state.
_Avoid_: Auto-accept all, hidden mutation, prompt consent

**Grilling Session**:
The clarification workflow where the planner turns uncertainty into proposed **Open Questions**, asks the **Primary User** for answers, and feeds those answers back into the proposal pipeline as candidate **Requirements**, **Decisions**, **Assumptions**, or **HITL Gates**.
_Avoid_: Freeform chat, provider conversation history, hidden assumptions

**Reviewer LLM**:
An **LLM Adapter** role that reviews an executor run result, validation output, and relevant graph context, then proposes follow-up **Graph Operations** rather than directly changing the graph, files, or Git history.
_Avoid_: Automatic merger, final authority, direct committer

**Planning Change Log**:
A lightweight repository-committed audit log of meaningful graph changes and approvals.
_Avoid_: Git history only, hidden event log, opaque mutation history

**Validation Method**:
A **Work Item** field defining how the result can be checked.
_Avoid_: Acceptance criteria, vague test note, optional verification

**Acceptance Criteria**:
A **Work Item** field describing what must be true for the work to be considered complete.
_Avoid_: Validation command, implementation notes, desired outcome

**Safe-Failure Expectation**:
A **Work Item** field describing what should happen if implementation or validation fails without leaving the repo, graph, artifacts, data, deployment, or public interface in a worse state.
_Avoid_: Automatic revert, vague rollback, ignore failure

## Relationships

- A **Primary User** starts with a rough idea and expects the planner to clarify scope, risks, dependencies, and execution handoffs.
- An **Intake Brief** is parsed into an initial **Planning Graph**.
- A **Planning Graph** is the source of truth from which PRDs, RFCs, architecture docs, Kanban issues, dependency views, and execution labels are projected.
- A **Planning Graph** contains one or more **Work Items**.
- A **Work Item** may be projected into an issue in GitHub, Linear, Jira, Markdown, or another tracker.
- A **Work Item** qualifies as **AFK** only when product and architecture decisions are resolved, dependencies are clear, required context is available, validation is defined, and no secrets or external account access are required.
- A **Work Item** may contain one or more **HITL Gates** when safe progress depends on human input or approval.
- A **Dependency Edge** may connect requirements, decisions, risks, components, documents, or **Work Items**.
- Work item scheduling is a projection that resolves graph-wide **Dependency Edges** into **Work Item** readiness and **AFK** eligibility.
- PRDs, RFCs, and architecture docs are **Document Projections** of the **Planning Graph**.
- Manual edits to a **Document Projection** are treated as proposed changes to the underlying **Planning Graph** nodes.
- Gaps in an **Intake Brief** become open questions, assumptions, decisions, risks, or **HITL Gates** in the **Planning Graph**.
- An **Assumption** includes its inference reason, confidence, impact if wrong, linked graph nodes, and whether it blocks **AFK** eligibility.
- High-impact **Assumptions** create **HITL Gates** before affected **Work Items** can become **AFK**.
- A **Decision** is distinct from an **Assumption**: decisions are committed choices, while assumptions are unconfirmed beliefs used temporarily.
- A **Work Item** depending on an unresolved, proposed, or revisit **Decision** cannot be **AFK**.
- An **Open Question** may be non-blocking, while a **HITL Gate** blocks safe progress for one or more **Work Items**.
- A high-impact **Open Question** can produce a **HITL Gate** when execution depends on the answer.
- A **Requirement** may be functional behavior, a non-functional quality, or an imposed constraint.
- Every **Work Item** should trace to at least one **Requirement** or accepted **Decision**.
- A **Work Item** without traceability to user intent or an accepted **Decision** is suspicious busywork and should be removed, rewritten, or linked to a valid graph node.
- A **Risk** includes likelihood, impact, affected graph nodes, mitigation, review need when relevant, and whether it blocks **AFK** eligibility.
- A high-impact unmitigated **Risk** should create mitigation **Work Items** or **HITL Gates** before dependent **Work Items** can become **AFK**.
- A **Blocker** is usually derived from an unresolved **Dependency Edge**, **HITL Gate**, missing context, failed validation, unavailable prerequisite, unaccepted **Decision**, or high-impact unmitigated **Risk**.
- A **Blocker** carries a cause link so the planner can explain what must happen to unblock the affected **Work Item**.
- A **Component** may be conceptual during planning and later map to packages, services, directories, deployable units, schemas, adapters, frontend areas, backend modules, workers, or agent subsystems.
- A **Component** links to related requirements, risks, decisions, interfaces, and **Work Items**.
- A **Kanban Projection** renders **Work Items** from the **Planning Graph** and is not an independent source of truth.
- **Execution State** is separate from readiness labels such as **AFK**, HITL-gated, blocked, human-only, or agent-eligible.
- **Human-only** overrides agent execution.
- **Agent-eligible** means agent execution may be possible later.
- **AFK-ready** means agent execution is safe to attempt now.
- The MVP uses **Markdown-first Repository Export** as its integration boundary.
- **Markdown-first Repository Export** includes PRDs, RFCs, architecture docs, **Work Item** projections, dependency views, and the structured **Planning Graph** in stable repository paths.
- The **Planning Graph** remains canonical while Git history provides versioning, audit trail, rollback, and future planner intelligence.
- External sync to GitHub Issues, Linear, Jira, or similar trackers is deferred until **Markdown-first Repository Export** is reliable.
- **Graph Reconciliation** treats edited exports as valid input signals while preserving the **Planning Graph** as the canonical source of truth.
- **Graph Reconciliation** may update graph nodes, regenerate artifacts, create **Open Questions**, create **Decisions**, update **Work Items**, preserve useful manual intent, or flag conflicts.
- **Graph Validation** runs before export and before **AFK-ready** labels are applied.
- **Graph Validation** checks traceability, unresolved blockers, dependency cycles, valid document references, clear **HITL Gate** actions, acceptance criteria, **AFK-ready** validation instructions, and **Blocker** cause links.
- **Graph Validation** combines schema validation for graph shape with semantic validation for planning meaning.
- **Graph Validation** errors block **AFK-ready** labels and unsafe exports; warnings may export but must remain visible to the **Primary User**.
- A **Work Item Projection** includes frontmatter for identity, execution state, readiness, dependencies, linked requirements, decisions, components, risks, **HITL Gates**, validation references, and rollback references when relevant.
- A **Work Item Projection** includes body sections for context, desired outcome, boundaries, acceptance criteria, validation, dependencies, **HITL Gates**, and agent notes.
- The **Serialized Planning Graph** is stored at `planning/graph.json`.
- `planning/graph.schema.json` validates structure, required fields, enum values, basic node shape, and references where possible.
- Semantic **Graph Validation** validates traceability, **AFK-ready** eligibility, dependency readiness, **HITL Gate** clarity, risk impact, **Blocker** causes, and projection consistency.
- The **MVP Workflow** starts with an **Intake Brief**, creates a draft **Planning Graph**, surfaces uncertainty, lets the **Primary User** resolve key decisions and assumptions, labels **Work Items**, runs **Graph Validation**, exports repository artifacts, supports execution, and later performs **Graph Reconciliation**.
- Live GitHub/Linear/Jira sync, multi-user collaboration, automatic code implementation, project management analytics, and autonomous multi-agent execution are outside the MVP.
- **Structured Clarification** presents decisions, high-impact assumptions, **HITL Gates**, high-priority **Open Questions**, and risks needing mitigation or acceptance.
- **Structured Clarification** asks the minimum needed to make useful progress and does not require every **Open Question** to be answered before export.
- **Clarification Priority** starts with items blocking **AFK-ready** **Work Items** in the next executable slice, then architecture/data/security/integration decisions, high-impact **Assumptions**, high-impact unmitigated risks, ambiguities affecting multiple **Work Items**, and lower-priority **Open Questions**.
- An **Execution Slice** includes dependency closure, target outcome, validation method, unresolved blockers, readiness summary, and linked requirements or decisions.
- **Execution Slices** guide **Structured Clarification** by identifying what must be resolved so useful work can start safely.
- **Execution Slices** are planner-proposed groupings derived from dependency closure, validation paths, risk, and readiness.
- The **Primary User** may merge, split, reorder, rename, or reject **Execution Slices**.
- Editing an **Execution Slice** updates slice metadata only unless the **Primary User** explicitly changes underlying **Work Item** dependencies.
- **Stable Graph IDs** are unique within type, monotonically increasing for human readability, and may be paired with internal UUIDs for stronger future sync identity.
- **Dependency Edges** reference **Stable Graph IDs**, not titles or file paths.
- Markdown projections include the relevant **Stable Graph ID** in frontmatter and may use readable slugged filenames.
- Deleted graph nodes should be tombstoned or archived, and **Stable Graph IDs** should not be reused.
- An **Archived Node** does not appear in active PRDs, **Kanban Projections**, or **Execution Slices** by default.
- **Dependency Edges** to an **Archived Node** produce **Graph Validation** warnings or errors depending on whether they affect active **Work Items**.
- Archived **Work Items** cannot be **AFK-ready**, **Agent-eligible** for execution, or active.
- Hard delete is only allowed for explicit cleanup of unexported drafts or user-requested purge.
- An **Archived Node** keeps a reason, archived timestamp, and optional replacement node ID.
- V1 **Planning Graph** node types are requirements, decisions, assumptions, risks, open questions, **HITL Gates**, components, **Work Items**, **Document Projections**, and **Execution Slices**.
- **Blocker** is not a V1 node type.
- **Dependency Edges** live in an edges collection with source, target, type, and rationale.
- V1 **Dependency Edge** types are depends_on, blocks, satisfies, mitigates, raises, references, and supersedes.
- **Dependency Edge** direction follows `source -> target`, meaning the source has the relationship to the target.
- Readiness labels are derived during **Graph Validation** from explicit graph inputs, then persisted as a latest computed snapshot for export and diffing.
- A readiness snapshot includes timestamp, graph version, labels, and reasons.
- **Human-only** may be manually set by the **Primary User**.
- **AFK-ready** cannot be manually forced when **Graph Validation** fails.
- **Agent-eligible** may be suggested before **AFK-ready**.
- **Graph Version** increments on node changes, edge changes, and accepted reconciliation patches.
- **Graph Version** does not increment when identical projections are regenerated without graph changes.
- Projections and readiness snapshots include the relevant **Graph Version**.
- **Graph Version** is separate from Git history: Git records repository changes, while **Graph Version** records canonical **Planning Graph** state.
- **Provenance** is lightweight but mandatory for generated or inferred nodes.
- **Provenance** includes source type, source reference, creator, timestamps, confidence for inferred nodes, and rationale for generated or inferred nodes.
- **Provenance** supports trust, debugging, reconciliation, and review by showing whether a node came from an **Intake Brief**, user answer, repo scan, imported document, reconciliation patch, or AI inference.
- A **Repo Scan** must be initiated or approved by the **Primary User** and is read-only in V1.
- A **Repo Scan** respects ignore files and configured exclusions, avoids secrets, credentials, binary files, generated files, and large irrelevant files, and summarizes findings instead of storing large raw file contents in the **Planning Graph**.
- Graph nodes extracted from a **Repo Scan** require **Provenance**.
- If repo context contradicts the **Intake Brief**, the planner creates an **Open Question**, **Assumption**, **Risk**, or **HITL Gate** instead of silently choosing one source.
- The MVP uses a **CLI-first Interface** backed by a reusable core library for graph modeling, validation, projection rendering, reconciliation, and export logic.
- The **CLI-first Interface** is agent-invocable so tools such as Codex, Claude Code, Gemini CLI, or similar coding agents can run planner commands and consume generated artifacts.
- Autonomous code execution by coding agents is outside V1; ThePlanner prepares artifacts and commands for agents to consume later.
- V1 uses the **TypeScript/Node Stack** for the CLI, core planner library, typed graph models, validation rules, projection rendering, reconciliation, and tests.
- The **TypeScript/Node Stack** may use commander or clipanion, zod or TypeBox, JSON Schema generation, ajv, vitest, gray-matter, and prettier.
- Type safety reduces implementation mistakes but does not replace JSON Schema validation or semantic **Graph Validation** at graph boundaries.
- V1 CLI commands are `theplanner plan --brief <file>`, `theplanner validate`, `theplanner export`, `theplanner reconcile`, and `theplanner status`.
- CLI commands support `--json`, deterministic file paths, non-zero exit codes for validation errors, and no interactive prompts unless `--interactive` is passed.
- Graph mutations after reconciliation require explicit `--apply`.
- `theplanner plan --brief <file> --interactive` may stream progress and **Structured Clarification** prompts, but canonical graph mutations still require explicit confirmation when needed.
- The system uses **Hexagonal Architecture** so the core planner is independent from the CLI, filesystem, Git, LLM provider, **Repo Scan**, JSON Schema validation, and future web/editor/tracker integrations.
- The core domain contains the **Planning Graph**, nodes, edges, validation rules, readiness calculation, projection generation, and reconciliation logic.
- Adapters handle CLI input/output, file writing, Git, LLM calls, **Repo Scan**, JSON Schema validation, and future GitHub/Linear/Jira sync.
- **Graph Operations** live in the core domain because they define valid canonical graph mutation semantics.
- **GraphOperationProposer** lives in the application layer because it is a port for proposal sources, not a provider implementation.
- Codex, Claude, Gemini, and other provider-specific **LLM Adapters** live under `src/adapters/llm/` and satisfy application-layer proposal ports.
- **LLM Adapters** must not import filesystem graph repositories, projection writers, Git adapters, or any writer that can mutate `planning/graph.json` or generated Markdown projections.
- **LLM Adapters** must not write directly to `planning/graph.json`, `planning/graph.schema.json`, PRD projections, RFC projections, Architecture projections, **Work Item Projections**, dependency views, or `planning/change-log.ndjson`.
- **LLM Adapters** may return only structured **Proposed Graph Operations**, clarification prompts, summaries, or review findings to the application layer.
- The application layer may build a candidate graph by applying **Proposed Graph Operations** through core domain logic, then run schema validation and semantic **Graph Validation** before any canonical save.
- Only validated and approved **Graph Operations** may be applied to the canonical **Planning Graph** and recorded in the **Planning Change Log**.
- Initial source layout separates `src/core/`, `src/application/`, `src/adapters/`, and `src/templates/`.
- `src/core/` contains graph, validation, readiness, projection, reconciliation, approval, and shared domain code.
- `src/application/` contains use cases and ports for filesystem, Git, LLM, **Repo Scan**, schema validation, and export writing.
- `src/adapters/` implements CLI, filesystem, Git, LLM, **Repo Scan**, and schema ports.
- `tests/` contains fixtures, golden tests, and integration tests.
- CLI code calls application use cases rather than core internals directly.
- Tests enforce dependency boundaries so **Hexagonal Architecture** does not decay over time.
- Initial package scripts are `build`, `test`, `test:watch`, `lint`, `format`, `check`, and `validate:graph`.
- ESLint is introduced early so dependency-boundary enforcement can protect **Hexagonal Architecture** from the start.
- The V1 local CLI binary name is `planner`, with a more distinctive public command name deferred until product naming is settled.
- An **LLM Adapter** may propose draft graph changes from an **Intake Brief**, **Structured Clarification** prompts, **Document Projections**, **Graph Reconciliation** patches, **Repo Scan** summaries, and candidate risks, assumptions, or decisions.
- **LLM Adapter** output is treated as proposed graph operations and cannot directly mutate `planning/graph.json` without validation and approval where required.
- A **Proposed Graph Operation** is untrusted until it passes operation-shape checks, produces a valid candidate **Planning Graph**, passes semantic **Graph Validation**, and satisfies **Graph Operation Approval** rules.
- A **Proposed Graph Operation** must include **Provenance** showing the proposal source, prompt or artifact reference, provider or adapter name when relevant, and confidence where inference is involved.
- LLM-proposed **Work Items** must include **Acceptance Criteria**, an executable command or test **Validation Method**, context summary, boundary notes, traceability, and **Safe-Failure Expectation** before they can enter the canonical graph.
- LLM-proposed **Work Items** that lack executable validation are rejected rather than downgraded to vague manual checks.
- LLM-proposed **Decisions** that affect scope, architecture, data, security, cost, integration choices, user promises, or execution safety require **Graph Operation Approval** before they become accepted **Decisions**.
- LLM-proposed **Open Questions** may be auto-drafted when low risk, but any answer that changes commitments must come back through **Graph Operations**.
- During a **Grilling Session**, missing context becomes **Open Questions** first; user answers then become candidate **Requirements**, **Decisions**, **Assumptions**, risks, or **HITL Gates**.
- A **Reviewer LLM** may inspect executor output, validation results, and run artifacts, but it may only propose **Graph Operations** such as updating **Execution State**, adding a follow-up **Work Item**, adding a **HITL Gate**, or recording an **Open Question**.
- A failing reviewer or validation result must not trigger continuous retry loops; it should create or propose a **HITL Gate** or blocked **Work Item** state with a clear cause.
- Prompts and templates live in adapter or application layers, not the core domain.
- Deterministic **Graph Validation** has final say on **AFK-ready** labels.
- **Graph Operation Approval** is required for operations that change commitment, risk, readiness, scope, or execution safety.
- **Graph Operation Approval** is required for accepting or changing decisions, confirming high-impact assumptions, accepting high-impact risks, marking **Work Items** **Human-only**, archiving nodes after export, applying reconciliation patches that change requirements, decisions, dependencies, or readiness, and any operation that would make a **Work Item** **AFK-ready** if it depends on human judgment.
- Low-risk operations may be automatically applied after validation, including creating draft nodes from an **Intake Brief**, adding low-impact **Open Questions**, generating **Document Projections**, computing readiness snapshots, updating projection metadata, and creating suggested **Execution Slices**.
- **LLM Adapter** proposals may be auto-drafted but not auto-accepted when they change commitment, risk, readiness, scope, or safety.
- The **Planning Change Log** is stored at `planning/change-log.ndjson` in V1.
- The **Planning Change Log** records event ID, timestamp, graph version before and after, actor, operation type, affected node IDs, approval status when relevant, rationale or summary, and provenance reference.
- Git history shows changed files; the **Planning Change Log** explains why planning state changed and who or what approved it.
- **Planning Change Log** does not need an ADR in V1 unless the project adopts stronger audit constraints such as event sourcing, append-only guarantees, SQLite or event-store persistence, compliance-grade audit history, or another durable audit model.
- V1 testing emphasizes core domain unit tests, narrow adapter tests, and CLI golden-file integration tests.
- Core tests cover graph model, **Dependency Edges**, **Graph Validation**, readiness derivation, and **Graph Operation Approval**.
- Projection tests verify graph input produces expected Markdown and YAML frontmatter.
- **Graph Reconciliation** tests verify edited projections produce graph patches or conflicts.
- Schema tests verify `planning/graph.schema.json` accepts valid graph shapes and rejects invalid ones.
- CLI integration tests verify deterministic files and exit codes.
- LLM adapter tests use fixtures or fakes, not live provider calls.
- **Graph Operation** tests cover deterministic application, validation failures, provenance, approval requirements, graph version changes, and rejection of untestable LLM-proposed **Work Items**.
- **GraphOperationProposer** application tests use fake proposers and prove adapters cannot bypass validation or canonical graph application rules.
- **Repo Scan** tests use small fixture repositories.
- **AFK-ready** derivation has regression tests for every blocking condition.
- Tests enforce **Hexagonal Architecture** so core domain code does not import CLI, filesystem, Git, LLM provider, or **Repo Scan** adapters.
- A **Validation Method** may be a command, manual check, static check, acceptance review, or none with explicit rationale.
- **AFK-ready** **Work Items** require at least one **Validation Method**.
- **Validation Methods** prefer commands discovered by **Repo Scan** and include expected results.
- A **Work Item** is not **AFK-ready** when validation requires unavailable external credentials, unavailable services, or **Human-only** judgment.
- **Validation Method** remains a **Work Item** field in V1 and may become a reusable node later if heavily shared.
- Every **Work Item** requires **Acceptance Criteria**.
- **AFK-ready** **Work Items** require both **Acceptance Criteria** and **Validation Method**.
- **Acceptance Criteria** may be product-facing, technical, documentation-facing, or quality-related.
- Each **Validation Method** should map back to one or more **Acceptance Criteria** where possible.
- **Safe-Failure Expectation** is required for **Work Items** that modify state, data, deployment, credentials, migrations, generated artifacts, public interfaces, or risky files.
- **Safe-Failure Expectation** is required for **AFK-ready** **Work Items** when failure could cause data loss, broken exports, destructive edits, or hard-to-debug state.
- Low-risk documentation-only **Work Items** may omit **Safe-Failure Expectation**.
- **Safe-Failure Expectation** may mean stopping, preserving evidence, reporting changed files, and explaining failure rather than automatically reverting.
- MVP **Document Projections** are PRD Projection, RFC Projection, Architecture Projection, **Work Item Projections**, and Dependency View.
- A PRD Projection includes problem, **Primary User**, goals and non-goals, requirements, success criteria, risks, and **Open Questions**.
- An RFC Projection includes context, decision to make, options, selected decision, tradeoffs, consequences, and follow-up **Work Items**.
- An Architecture Projection includes system overview, components, interfaces, data or state, constraints, risks, decisions, and dependency notes.
- A Dependency View includes graph summary, blocked **Work Items**, next **Execution Slices**, and a Mermaid diagram when useful.
- MVP success means a **Primary User** can provide an **Intake Brief** and receive a validated **Markdown-first Repository Export** containing `planning/graph.json`, `planning/graph.schema.json`, PRD/RFC/Architecture projections, **Work Item Projections**, Dependency View, **Structured Clarification** prompts, and **Graph Validation** output.
- MVP quality requires no **AFK-ready** **Work Item** to lack traceability, **Acceptance Criteria**, **Validation Method**, or blocker explanation.
- MVP quality requires generated documents to remain consistent with the **Planning Graph**, manual edits to be detectable for **Graph Reconciliation**, and export usefulness without external tracker credentials.
- The MVP proves the loop from **Intake Brief** to **Planning Graph**, validation, Markdown export, and reconciliation-ready artifacts.

## Example dialogue

> **Dev:** "Are we optimizing for a project manager assigning work to a team?"
> **Domain expert:** "No — the **Primary User** is a founder or tech lead shaping early ideas into artifacts that humans and agents can execute."
>
> **Dev:** "If the PRD and Kanban board disagree, which one wins?"
> **Domain expert:** "Neither directly — both should be regenerated or reconciled from the **Planning Graph**."
>
> **Dev:** "Should we store GitHub issues as the plan?"
> **Domain expert:** "No — a GitHub issue is one possible projection of a **Work Item**."
>
> **Dev:** "Can an agent start this while the founder is away?"
> **Domain expert:** "Only if the **Work Item** is **AFK**: bounded, decided, contextualized, dependency-clear, and verifiable."
>
> **Dev:** "Is this just blocked?"
> **Domain expert:** "No — a **HITL Gate** names the exact human decision, action, review, or risk acceptance needed to continue safely."
>
> **Dev:** "Does the scheduler only look at task-to-task links?"
> **Domain expert:** "No — it projects graph-wide **Dependency Edges** into **Work Item** readiness."
>
> **Dev:** "Can the PRD override the graph?"
> **Domain expert:** "No — a PRD is a **Document Projection**; edits to it must reconcile back into the **Planning Graph**."
>
> **Dev:** "Does the first paragraph from the founder become the PRD?"
> **Domain expert:** "No — it is an **Intake Brief** that must be parsed into the **Planning Graph** first."
>
> **Dev:** "Can we quietly assume the app uses Postgres?"
> **Domain expert:** "No — that must be an **Assumption** or a decision; if impact is high, it creates a **HITL Gate**."
>
> **Dev:** "Can the agent implement the auth flow before we choose the provider?"
> **Domain expert:** "No — that depends on an unresolved **Decision**, so the **Work Item** cannot be **AFK**."
>
> **Dev:** "Do all unanswered questions block the board?"
> **Domain expert:** "No — only those represented as **HITL Gates** block safe progress."
>
> **Dev:** "Can the planner create a cleanup task because it seems useful?"
> **Domain expert:** "Only if the **Work Item** traces to a **Requirement** or accepted **Decision**; otherwise it is suspicious busywork."
>
> **Dev:** "Is possible graph invalidity already a blocker?"
> **Domain expert:** "Not necessarily — it is a **Risk** until it prevents safe execution or needs mitigation."
>
> **Dev:** "Why can't this Work Item start?"
> **Domain expert:** "It is in **Blocker** state because its cause link points to a missing credential **HITL Gate**."
>
> **Dev:** "Is the graph validator a folder or a service?"
> **Domain expert:** "At planning time it is a **Component** because it owns responsibility and interfaces; implementation mapping can come later."
>
> **Dev:** "Should AFK be a Kanban lifecycle column?"
> **Domain expert:** "Not internally — **Execution State** and readiness are separate, though a **Kanban Projection** can render them together."
>
> **Dev:** "If something is not AFK, does a human have to do it?"
> **Domain expert:** "No — it may be **Agent-eligible** but not **AFK-ready** yet; **Human-only** is a separate override."
>
> **Dev:** "Should V1 create GitHub issues directly?"
> **Domain expert:** "No — V1 uses **Markdown-first Repository Export** so planning changes are tracked through Git history without external tracker credentials."
>
> **Dev:** "Should the planner overwrite edited Markdown?"
> **Domain expert:** "No — **Graph Reconciliation** should treat edits as proposed graph patches or conflicts."
>
> **Dev:** "Can we label this Work Item AFK-ready because it looks clear?"
> **Domain expert:** "Only after **Graph Validation** confirms traceability, dependencies, acceptance criteria, and validation instructions."
>
> **Dev:** "Should a Work Item file be prose only?"
> **Domain expert:** "No — a **Work Item Projection** uses YAML frontmatter for machines and Markdown sections for humans and agents."
>
> **Dev:** "Is the canonical graph a Markdown file?"
> **Domain expert:** "No — the **Serialized Planning Graph** is `planning/graph.json`, with shape checked by `planning/graph.schema.json` and meaning checked by semantic **Graph Validation**."
>
> **Dev:** "Does the MVP run agents to implement the plan?"
> **Domain expert:** "No — the **MVP Workflow** prepares validated **Work Item Projections** for humans or agents to execute outside the planner."
>
> **Dev:** "Should clarification be a general chat?"
> **Domain expert:** "No — **Structured Clarification** asks grouped, answerable questions linked to graph nodes."
>
> **Dev:** "Should we ask about future Jira support before export paths?"
> **Domain expert:** "No — **Clarification Priority** favors execution-critical blockers over interesting future scope."
>
> **Dev:** "Is this the same as a milestone?"
> **Domain expert:** "No — an **Execution Slice** is smaller and focused on the next validated increment that can start safely."
>
> **Dev:** "If I reorder a slice, did I change dependencies?"
> **Domain expert:** "No — **Execution Slices** are planning views; **Dependency Edges** remain canonical unless explicitly edited."
>
> **Dev:** "Can we identify a Work Item by its title?"
> **Domain expert:** "No — titles and filenames can change; use the **Stable Graph ID**."
>
> **Dev:** "Should we delete old nodes from the graph?"
> **Domain expert:** "Normally no — create an **Archived Node** state so references and Git history remain understandable."
>
> **Dev:** "Should blockers be graph nodes?"
> **Domain expert:** "No — **Blocker** is a derived readiness state; **Dependency Edges** carry graph relationships."
>
> **Dev:** "Which way does a dependency edge point?"
> **Domain expert:** "`wi-003 depends_on dec-001` means the **Dependency Edge** points from `wi-003` to `dec-001`."
>
> **Dev:** "Can I just set AFK-ready by hand?"
> **Domain expert:** "No — **AFK-ready** is derived by **Graph Validation** and cannot be forced if validation fails."
>
> **Dev:** "Is graph version the same as the Git commit?"
> **Domain expert:** "No — **Graph Version** is the planner's internal revision for canonical graph state."
>
> **Dev:** "Why does this requirement exist?"
> **Domain expert:** "Check its **Provenance** to see whether it came from the **Intake Brief**, a user answer, repo scan, import, reconciliation patch, or AI inference."
>
> **Dev:** "Can the planner rewrite code during repository analysis?"
> **Domain expert:** "No — a V1 **Repo Scan** is explicit, scoped, and read-only."
>
> **Dev:** "Does CLI-first mean ThePlanner runs coding agents?"
> **Domain expert:** "No — the **CLI-first Interface** must be agent-invocable, but autonomous code execution is outside V1."
>
> **Dev:** "Does TypeScript mean we can skip graph validation?"
> **Domain expert:** "No — the **TypeScript/Node Stack** improves implementation safety, but `graph.json` still needs schema and semantic **Graph Validation**."
>
> **Dev:** "Can the core planner write files directly?"
> **Domain expert:** "No — with **Hexagonal Architecture**, file writing is an adapter outside the core domain."
>
> **Dev:** "Can an LLM mark work AFK-ready?"
> **Domain expert:** "No — an **LLM Adapter** can propose changes, but deterministic **Graph Validation** decides **AFK-ready** labels."
>
> **Dev:** "Can Codex update `planning/graph.json` directly after reading a brief?"
> **Domain expert:** "No — Codex is an **LLM Adapter** in this context. It must return **Proposed Graph Operations** that core domain logic validates before any canonical graph write."
>
> **Dev:** "Is a Proposed Graph Operation already safe because it came from Claude or Gemini?"
> **Domain expert:** "No — every **Proposed Graph Operation** is untrusted until schema validation, semantic **Graph Validation**, and required **Graph Operation Approval** pass."
>
> **Dev:** "What should the planner do when an LLM lacks enough context?"
> **Domain expert:** "It should propose **Open Questions** and enter a **Grilling Session**, not invent requirements or silently accept assumptions."
>
> **Dev:** "Can an LLM create a Work Item without a test command?"
> **Domain expert:** "No — an LLM-proposed **Work Item** must include **Acceptance Criteria** and an executable **Validation Method**, otherwise the proposal is rejected."
>
> **Dev:** "Can a reviewer agent mark the Work Item done?"
> **Domain expert:** "No — a **Reviewer LLM** can propose an execution-state **Graph Operation** after validation passes; canonical state changes still flow through graph operation validation and approval policy."
>
> **Dev:** "Can the planner accept an architecture decision automatically?"
> **Domain expert:** "No — **Graph Operation Approval** requires explicit approval for commitment-changing operations."
>
> **Dev:** "Is Git history enough to explain planning changes?"
> **Domain expert:** "No — the **Planning Change Log** records planning intent, affected nodes, graph versions, and approvals."
>
> **Dev:** "Can a Work Item be AFK-ready without a way to check it?"
> **Domain expert:** "No — **AFK-ready** **Work Items** require a **Validation Method** with expected results."
>
> **Dev:** "Are acceptance criteria the same as test commands?"
> **Domain expert:** "No — **Acceptance Criteria** define completion; **Validation Method** defines how to check completion."
>
> **Dev:** "Does rollback always mean revert the code?"
> **Domain expert:** "No — **Safe-Failure Expectation** can mean stop, preserve evidence, and report the failure."
>
> **Dev:** "Which human-facing documents does MVP generate?"
> **Domain expert:** "MVP generates PRD, RFC, Architecture, **Work Item Projections**, and Dependency View projections from the **Planning Graph**."
>
> **Dev:** "How do we know MVP worked?"
> **Domain expert:** "The **Primary User** gets a validated **Markdown-first Repository Export** with graph, projections, work items, dependency explanations, clarification prompts, and validation output."

## Flagged ambiguities

- "User" is too broad for this product. Resolved: the canonical term is **Primary User**.
- "PRD" should not mean the product's source of truth. Resolved: generated documents are projections of the **Planning Graph**.
- "Issue" is tracker-specific. Resolved: the canonical executable unit is **Work Item**.
- "Prompt" is too narrow for multi-source input. Resolved: the canonical input term is **Intake Brief**.
- "Guess" is not precise enough. Resolved: the canonical term is **Assumption** when unconfirmed inferred information is used for planning.
