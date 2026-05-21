# AgentHub Master PRD

**Author:** joytion, Codex  
**Date:** 2026-05-21  
**Status:** Draft  
**Version:** 0.1  
**Primary Sources:** `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`  
**Method References:** `how_to_prd/prd-taskmaster/SKILL.md`, `how_to_prd/ai-dev-tasks/create-prd.md`

---

## 1. Executive Summary

AgentHub is a multi-agent collaboration platform built around an IM-style interaction model. Users work with role-based AI agents in project-bound workspaces, ask an Orchestrator to clarify and decompose tasks, and review code-oriented outputs such as file changes, Git diff, command output, and preview URLs directly in the chat flow.

The product follows a Trae-like multi-device model: Web is the primary workspace, Desktop is the local connector for user-owned development environments, and Mobile is a lightweight IM, approval, preview, and remote control surface. The MVP must prove an end-to-end development loop across these three surfaces while keeping future compatibility for deployment, marketplace, richer version control, and additional runtime adapters.

---

## 2. Source-Derived Positioning

### 2.1 What the Source Materials Require

From `bytedance_init_prd.md` and the kickoff transcript, the required product direction is:

- AgentHub is a simplified practical version of a multi-agent collaboration product for creating webpages, workflows, code, documents, and related artifacts through conversational interaction.
- IM chat is the core interaction model. Users create conversations, send messages, mention agents, and continue multi-turn iteration.
- Agents should behave like collaboration members. A user can start single-agent conversations or group sessions with multiple agents.
- A main Orchestrator agent should understand intent, clarify requirements, decompose work, dispatch sub-agents, aggregate results, and handle failure or conflict at a product level.
- The product should integrate mainstream agent platforms. The source names Claude Code, Codex, and OpenCode; this PRD narrows MVP runtime scope to Claude Code and Codex.
- Agent outputs should be visible inline in the conversation. For MVP this is scoped to code-oriented outputs: task result cards, file change summaries, Git diff, command output when applicable, and preview links.
- AI collaboration process assets matter. The repository should contain specs, skills, rules, and development workflow documentation, not raw chat logs.
- Multi-device support is expected as a product direction. Web is the main full-featured surface, Desktop provides local file, notification, and agent process capabilities, and Mobile provides lightweight IM, approval, and preview.

### 2.2 Product Interpretation

AgentHub is not a generic chatbot. It is a project-workspace collaboration layer for coordinating role agents and agent runtimes around real development tasks.

The user-facing abstraction is:

- **Role Agent:** A role the user can mention or configure, such as Orchestrator, Frontend Engineer, Tester, Code Reviewer, or PM.
- **Runtime:** The execution backend behind a Role Agent, such as platform-hosted model runtime, local Claude Code, or local Codex.
- **Adapter:** The integration layer that translates AgentHub messages, context packages, runtime commands, and execution events into a specific Runtime.

Claude Code and Codex are not merely text generation APIs in this product. They are connected because users need continuity with their native sessions. AgentHub should bind a Role Agent conversation to the corresponding native Claude Code or Codex session and use resume/continue behavior where supported.

---

## 3. Goals And Success Metrics

### Goal 1: Prove the End-to-End Multi-Agent Development Loop

- **Metric:** Demo path completion rate.
- **Target:** A user can complete the P0 demo path without manual database edits, code patches, or hidden setup after initial environment configuration.
- **Measurement:** Manual demo checklist and automated integration checks where feasible.

### Goal 2: Preserve a Clear Three-Device Product Model

- **Metric:** Each device surface has a distinct and demonstrable role.
- **Target:** Web, Desktop, and Mobile all exist in MVP and each supports its required P0 responsibilities.
- **Measurement:** Product demo and acceptance checklist.

### Goal 3: Demonstrate Real Runtime Integration

- **Metric:** Claude Code and Codex runtimes can be represented through the unified Runtime/Adapter model.
- **Target:** A Role Agent can bind to local Claude Code or Codex through Desktop Connector, and follow-up messages continue the same native session where supported.
- **Measurement:** Runtime adapter integration tests or manual runtime verification.

### Goal 4: Make AI Collaboration Inspectable

- **Metric:** Task plans, role dispatches, context handoff, task result cards, file changes, and execution output are visible in the product.
- **Target:** The user can explain what the Orchestrator decided, which Role Agent ran, what changed, and what requires confirmation.
- **Measurement:** Demo review and PRD acceptance criteria.

---

## 4. Target Users

### Primary User

An individual developer or student building a software project with AI assistance. They use Web as the main workbench, run Desktop Connector on their own development machine, and optionally use Mobile to check progress, reply, or approve tasks when away from the desk.

### Secondary User

A user of a cloud-hosted AgentHub workspace. Their Workspace is still bound to a cloud project directory or personal work area. Cloud execution replaces local Desktop execution, but the product model remains workspace-bound.

### Not MVP Target

Multiple human collaborators editing the same Workspace or Session together. Multi-human collaboration is a P2 feature.

---

## 5. Core Concepts

| Concept | Definition |
| --- | --- |
| User | A person authenticated through GitHub OAuth. |
| Workspace | A project-bound work area. It must bind to either a local folder through Desktop Connector or a cloud project directory. |
| Session | A task conversation inside a Workspace. It contains messages, participating Role Agents, Orchestrator plans, context packages, task states, and result cards. |
| Role Agent | User-visible agent persona, such as Orchestrator, Frontend Engineer, Tester, or Code Reviewer. |
| Runtime | Execution backend for a Role Agent, such as platform-hosted runtime, local Claude Code, or local Codex. |
| Adapter | Runtime-specific integration layer for sending messages, resuming sessions, streaming output, and receiving result events. |
| Orchestrator | A Role Agent that behaves like a PM agent. It clarifies requirements, generates plans, asks for confirmation, dispatches role agents, and summarizes results. |
| Context Package | A structured handoff payload containing task summary, pinned messages, relevant files, previous agent conclusions, and current objective. |
| Task Result Card | A chat artifact produced when a role task completes. It can show status, summary, file changes, Git diff, preview link, and execution output if commands/actions ran. |
| Action/CLI Adapter | A compatibility layer for preview, build, test, deployment, or other command-like operations. |

---

## 6. Primary User Journey

1. User signs in with GitHub OAuth.
2. User creates a Workspace by binding an existing project or creating a new folder.
3. User opens the Web three-column IM workbench.
4. User starts Desktop Connector and binds it to the same account.
5. Desktop Connector detects local Claude Code and Codex availability.
6. User creates a Session and selects role agents.
7. User sends a task to the Orchestrator.
8. Orchestrator clarifies requirements when needed, then generates an execution plan and role assignment.
9. User confirms the plan or explicitly authorizes automatic progression.
10. Role Agents execute through their configured Runtime and Adapter.
11. Chat flow shows agent messages, task states, result cards, file changes, Git diff, preview links, and execution output when applicable.
12. User continues the conversation, pins context, asks a role agent to refine work, approves permission escalations, or ends the task.
13. Mobile can be used during the same flow to view progress, send lightweight messages, and approve pending confirmations.

---

## 7. Requirement Registry

### P0: MVP Requirements

#### FR-AUTH-001: GitHub OAuth Authentication

**Description:** The system must let users sign in with GitHub OAuth. AgentHub must not implement an independent username/password system in MVP.

**Acceptance Criteria:**

- [ ] User can start sign-in from Web, Desktop, and Mobile surfaces.
- [ ] Successful GitHub OAuth sign-in creates or restores the same AgentHub user identity.
- [ ] The same user identity can access the same Workspaces and Sessions across Web, Desktop, and Mobile.
- [ ] Sign-out removes access to protected Workspace and Session data on that device.
- [ ] The PRD does not require email/password, magic link, or custom 2FA for MVP.

**Dependencies:** None.

#### FR-WS-001: Workspace Must Bind To A Project Work Area

**Description:** Every Workspace must bind to a concrete project work area. Local mode binds to a local folder through Desktop Connector. Cloud mode binds to a cloud project directory or personal cloud work area.

**Acceptance Criteria:**

- [ ] User can create a Workspace by selecting an existing local or cloud project directory.
- [ ] User can create a new Workspace by entering a Workspace name and folder name.
- [ ] A Session cannot exist outside a Workspace.
- [ ] Workspace detail view shows whether it is local or cloud-backed.
- [ ] Local Workspace execution is unavailable when no bound Desktop Connector is online.
- [ ] Cloud Workspace execution uses cloud Runtime and cloud project storage, not local Desktop execution.

**Dependencies:** FR-AUTH-001.

#### FR-DEVICE-001: Three-Device Product Surfaces

**Description:** MVP must include Web, Desktop, and Mobile surfaces with different responsibilities. The surfaces share account, Workspace, Session, Agent, permission, and message data but do not expose identical features.

**Acceptance Criteria:**

- [ ] Web provides the full three-column IM workbench.
- [ ] Desktop provides Connector Console functions for account binding, folder binding, runtime detection, local action execution, and connection status.
- [ ] Mobile provides lightweight IM, task progress, approval, and preview functions.
- [ ] Web and Mobile control local work only through the cloud backend forwarding instructions to an online Desktop Connector.
- [ ] No surface claims direct remote control of a local computer without an authenticated Desktop Connector.

**Dependencies:** FR-AUTH-001, FR-WS-001.

#### FR-WEB-001: Web Three-Column IM Workbench

**Description:** Web is the primary full-featured workbench. It must center the product around IM collaboration while exposing context and artifacts around the chat.

**Acceptance Criteria:**

- [ ] Left column supports Workspace switching and Session list access.
- [ ] Center column supports message flow, user messages, role agent streaming messages, Orchestrator plan cards, confirmation cards, and task result cards.
- [ ] Right column can show Artifacts, Context, Agents, and Preview views.
- [ ] User can create a Session from Web.
- [ ] User can mention Role Agents in the message composer.
- [ ] User can view task result cards with status, summary, file changes, Git diff, preview link, and execution output when applicable.

**Dependencies:** FR-WS-001, FR-CHAT-001, FR-RESULT-001.

#### FR-DESK-001: Desktop Connector Console

**Description:** Desktop is a local Connector Console, not a duplicate of the full Web workbench. It must connect user-owned local development environments to AgentHub.

**Acceptance Criteria:**

- [ ] Desktop supports GitHub sign-in or account binding for the same AgentHub user.
- [ ] Desktop can bind a local Workspace folder.
- [ ] Desktop can detect local Claude Code and Codex availability and show connection status.
- [ ] Desktop can show whether the connector is online and reachable by the cloud backend.
- [ ] Desktop can execute approved local Runtime and Action requests.
- [ ] Desktop shows recent task executions, execution status, and failure reasons.
- [ ] Desktop provides an entry to open the Web workbench.

**Dependencies:** FR-AUTH-001, FR-WS-001, FR-RUNTIME-001, FR-ACTION-001.

#### FR-MOB-001: Mobile Lightweight IM, Approval, And Preview

**Description:** Mobile is a lightweight IM and remote-control surface. It must not attempt to be a full code editor or runtime connector.

**Acceptance Criteria:**

- [ ] User can view Workspace and Session lists.
- [ ] User can view chat messages, role agent status, and task result cards.
- [ ] User can send lightweight text messages.
- [ ] User can mention Role Agents.
- [ ] User can approve or reject pending Orchestrator plans, permission escalations, deployment or action confirmations, and failed-task retry requests.
- [ ] User can view preview links and lightweight artifact summaries.
- [ ] Mobile does not provide local Claude Code or Codex runtime integration.
- [ ] Mobile does not provide complex code editing or large diff merge workflows.

**Dependencies:** FR-AUTH-001, FR-CHAT-001, FR-PERM-001, FR-NOTIFY-001.

#### FR-CHAT-001: Core IM Session Experience

**Description:** The system must support an IM-style interaction model for project work. MVP group chat means one human user collaborating with multiple Role Agents, not multiple human users.

**Acceptance Criteria:**

- [ ] User can create a new Session inside a Workspace.
- [ ] User can start a single-role-agent conversation.
- [ ] User can start a multi-role-agent group Session.
- [ ] User can mention one or more Role Agents.
- [ ] Messages support text and role agent streaming replies.
- [ ] Message status distinguishes pending, streaming, completed, failed, and requires confirmation.
- [ ] User can copy message content.
- [ ] User can request regeneration or retry for failed role agent responses.
- [ ] Multi-human chat, read receipts, and message-level human permissions are out of P0.

**Dependencies:** FR-WS-001, FR-AGENT-001.

#### FR-AGENT-001: Role Agent Configuration

**Description:** Users interact with Role Agents, not directly with tool names such as Claude Code or Codex. Role Agents can be created from templates, edited, and bound to a Runtime.

**Acceptance Criteria:**

- [ ] System includes default Role Agent templates for Orchestrator, Frontend Engineer, Tester, Code Reviewer, and PM-style assistant.
- [ ] User can create a Role Agent from a template.
- [ ] User can edit Role Agent name, avatar, capability tags, system prompt, runtime binding, and whether Orchestrator can dispatch to it.
- [ ] User can create a draft Role Agent from a natural language instruction and confirm before saving.
- [ ] Runtime names are visible in configuration and diagnostics, not as the primary chat object.
- [ ] Agent Marketplace is out of P0.

**Dependencies:** FR-RUNTIME-001.

#### FR-RUNTIME-001: Unified Runtime And Adapter Model

**Description:** The system must expose a unified model for platform-hosted and user-owned runtimes. MVP Runtime scope is platform-hosted roles, local Claude Code, and local Codex.

**Acceptance Criteria:**

- [ ] Role Agent can bind to a platform-hosted Runtime.
- [ ] Role Agent can bind to local Claude Code through Desktop Connector.
- [ ] Role Agent can bind to local Codex through Desktop Connector.
- [ ] Adapter receives a structured message and context package, not only a raw string prompt.
- [ ] Adapter can stream role response state back into the Session.
- [ ] Adapter records native session identity where the Runtime supports it.
- [ ] Follow-up messages use resume/continue behavior for the same native Claude Code or Codex session where supported.
- [ ] OpenCode Runtime is out of P0 but the Adapter model must not prevent later OpenCode support.

**Dependencies:** FR-DESK-001, FR-AGENT-001, FR-CTX-001.

#### FR-ORCH-001: Orchestrator Planning And Dispatch

**Description:** Orchestrator is a PM-like Role Agent. It must clarify needs, generate plans, request confirmation by default, and dispatch work to Role Agents through their configured Runtime.

**Acceptance Criteria:**

- [ ] Orchestrator can ask clarifying questions before planning.
- [ ] Orchestrator can generate a plan with steps, assigned Role Agents, expected outputs, and permission-sensitive actions.
- [ ] Default behavior requires user confirmation before execution starts.
- [ ] User can explicitly authorize automatic progression for a Session.
- [ ] High-risk or policy-exceeding actions still require permission confirmation even in automatic mode.
- [ ] Orchestrator can dispatch tasks to Role Agents and summarize their results.
- [ ] Orchestrator can report failure and ask whether to retry, revise plan, or stop.

**Dependencies:** FR-AGENT-001, FR-RUNTIME-001, FR-PERM-001.

#### FR-CTX-001: Context Pinning And Role Handoff

**Description:** The system must make context transfer visible and controllable. Users should hand off project context to Role Agents without repeatedly rewriting history.

**Acceptance Criteria:**

- [ ] User can pin important messages as long-lived Session context.
- [ ] Orchestrator can build a context package for dispatched Role Agent tasks.
- [ ] Context package can include task summary, pinned messages, relevant files, previous role conclusions, and current objective.
- [ ] User can select messages, files, or result cards and pass them to a Role Agent.
- [ ] Handoff targets are Role Agents, not runtime tool names.
- [ ] If the target Role Agent binds to Claude Code or Codex, the Adapter attempts to continue the corresponding native session where supported.
- [ ] Automatic history summarization is not required for P0.

**Dependencies:** FR-CHAT-001, FR-RUNTIME-001.

#### FR-RESULT-001: Task Result Cards

**Description:** When a role task completes or fails, the system must show a task result card in the chat. This is a product display primitive, not a version-control system.

**Acceptance Criteria:**

- [ ] Result card shows task status and result summary.
- [ ] Result card shows changed file list when file changes exist.
- [ ] Result card shows Git diff when available.
- [ ] Result card shows preview link when a preview exists.
- [ ] Result card shows execution output only when a Runtime or Action executed commands, tests, builds, previews, or deployments.
- [ ] AI conversation text remains normal chat messages and is not duplicated as logs.
- [ ] P0 does not implement snapshots, checkpoint comparison, rollback, or non-Git version control.

**Dependencies:** FR-RUNTIME-001, FR-ACTION-001.

#### FR-ACTION-001: Action/CLI Adapter For Preview And Future Deployment

**Description:** The system must route preview, build, test, deployment, and other command-like operations through an Action/CLI Adapter. MVP only commits to local preview and command execution needed for the demo path.

**Acceptance Criteria:**

- [ ] Action request includes command/action identity, working directory, requester, Workspace, Session, and permission level.
- [ ] User can approve required actions before execution when policy requires it.
- [ ] Desktop Connector executes local actions for local Workspaces.
- [ ] Cloud Runtime executes cloud actions for cloud Workspaces.
- [ ] Action status can be pending, running, succeeded, failed, or canceled.
- [ ] Action output can be attached to a task result card.
- [ ] MVP supports local preview style actions such as starting a dev server or returning a preview URL.
- [ ] Full static-site, container, mini-program, Feishu, and third-party publishing are P2 extension actions.

**Dependencies:** FR-DESK-001, FR-PERM-001.

#### FR-PERM-001: Workspace And Session Permission Policy

**Description:** Permissions must be controlled at Workspace and Session levels. Confirmation should be tied to task execution and permission escalation, not to UI artifacts such as diff display.

**Acceptance Criteria:**

- [ ] Workspace can define a default execution policy.
- [ ] Session can override Workspace default policy for that Session.
- [ ] Session policy cannot bypass system-defined high-risk confirmation rules.
- [ ] System requests user confirmation before executing actions that exceed the active policy.
- [ ] High-risk actions include shell command execution, restricted path access, deletion, overwrite, batch modification, deployment or publishing, long-running jobs, and unusually high token or cost use.
- [ ] Orchestrator plan confirmation is a task-level confirmation.
- [ ] Permission escalation confirmation is a permission-level confirmation.
- [ ] Git diff display is not a standalone approval type.

**Dependencies:** FR-WS-001, FR-ORCH-001, FR-ACTION-001.

#### FR-NOTIFY-001: In-App Notifications And Pending Approval Queue

**Description:** MVP must provide an in-app notification and pending approval queue across devices. This supports remote control and Mobile usefulness without requiring push notification infrastructure in P0.

**Acceptance Criteria:**

- [ ] User can view pending approvals from Web.
- [ ] User can view pending approvals from Desktop.
- [ ] User can view pending approvals from Mobile.
- [ ] Approval item links to Workspace, Session, message, task, or action that generated it.
- [ ] Approval types include Orchestrator plan confirmation, task result next-step confirmation, permission escalation confirmation, deployment or publishing confirmation, and failed-task retry confirmation.
- [ ] Desktop system notification, Mobile push, Feishu hook, and WeChat hook are not required for P0.

**Dependencies:** FR-PERM-001, FR-MOB-001.

### P1: Near-Term Enhancements

#### FR-IM-101: Session Management Refinement

**Description:** Add quality-of-life IM features after the core loop works.

**Acceptance Criteria:**

- [ ] User can search Sessions.
- [ ] User can pin Sessions.
- [ ] User can archive Sessions.
- [ ] User can quote or reply to a message.

**Dependencies:** FR-CHAT-001.

#### FR-AGENT-101: Role Agent Toolset Configuration

**Description:** Add deeper configuration for what tools or actions a Role Agent may use.

**Acceptance Criteria:**

- [ ] User can view available tools/actions for a Role Agent.
- [ ] User can enable or disable tool categories for a Role Agent.
- [ ] Tool permissions respect Workspace and Session policy.

**Dependencies:** FR-AGENT-001, FR-PERM-001.

#### FR-WORKSPACE-101: Create New Project From Prompt

**Description:** Support starting from a new project idea, not only an existing project.

**Acceptance Criteria:**

- [ ] User can create a Workspace by providing a folder name and a natural language project brief.
- [ ] Orchestrator can propose initialization steps before execution.
- [ ] User confirms before project files are created.

**Dependencies:** FR-WS-001, FR-ORCH-001, FR-ACTION-001.

#### FR-NOTIFY-101: External Device Notifications

**Description:** Add notifications outside the in-app queue.

**Acceptance Criteria:**

- [ ] Desktop can show local system notifications.
- [ ] Mobile can receive push notifications where the chosen mobile technology supports it.
- [ ] Notification payload does not expose sensitive file content by default.

**Dependencies:** FR-NOTIFY-001.

### P2/P3: Future Compatibility

#### FR-COLLAB-201: Multi-Human Collaboration

**Description:** Add multiple human members inside Workspace or Session.

**Acceptance Criteria:**

- [ ] Workspace can contain multiple human members.
- [ ] Human members have roles and permissions.
- [ ] Session supports multiple human participants.
- [ ] Conflicts and concurrent approvals are handled explicitly.

**Dependencies:** FR-WS-001, FR-CHAT-001, FR-PERM-001.

#### FR-MARKET-201: Agent Marketplace

**Description:** Add discoverable and reusable Agent templates.

**Acceptance Criteria:**

- [ ] User can browse Agent templates.
- [ ] User can install a template into a Workspace.
- [ ] Template permissions and runtime requirements are visible before install.

**Dependencies:** FR-AGENT-001.

#### FR-VERSION-201: Non-Git Code Control And Checkpoints

**Description:** Add a real system for snapshot, checkpoint, patch stack, comparison, and rollback. This is intentionally not P0 or P1.

**Acceptance Criteria:**

- [ ] System can create checkpoints independent of Git commits.
- [ ] User can compare checkpoints.
- [ ] User can revert to a checkpoint.
- [ ] Cross-agent change conflicts are detected and surfaced.

**Dependencies:** FR-RESULT-001.

#### FR-RUNTIME-201: OpenCode Runtime Adapter

**Description:** Add OpenCode as another runtime under the same Runtime/Adapter model.

**Acceptance Criteria:**

- [ ] Role Agent can bind to OpenCode Runtime.
- [ ] Adapter supports session continuity where OpenCode exposes it.
- [ ] OpenCode events map into the same task state and result card model.

**Dependencies:** FR-RUNTIME-001.

#### FR-DOCS-201: Rich Document And Presentation Artifacts

**Description:** Add document, Markdown, Feishu document, and PPT preview or editing.

**Acceptance Criteria:**

- [ ] Markdown artifacts can be previewed.
- [ ] Feishu document artifacts can be integrated where credentials allow.
- [ ] PPT artifacts can be previewed.
- [ ] Artifact interactions can feed context back into Role Agent handoff.

**Dependencies:** FR-CTX-001, FR-RESULT-001.

#### FR-PUBLISH-201: Deployment And Third-Party Publishing Actions

**Description:** Add deploy and publish actions through the Action/CLI Adapter rather than hardcoding each provider in the product layer.

**Acceptance Criteria:**

- [ ] User can configure static-site deployment action.
- [ ] User can configure container deployment action.
- [ ] User can configure source package export.
- [ ] User can configure mini-program publishing action.
- [ ] User can configure Feishu publishing action.
- [ ] Each publish action uses the same permission and approval model as P0 Action/CLI requests.

**Dependencies:** FR-ACTION-001, FR-PERM-001.

---

## 8. Non-Functional Requirements

### NFR-SEC-001: Safe Local Control Boundary

The cloud backend must not directly control the user's computer. Web and Mobile send instructions through the cloud backend. Local execution only occurs through an authenticated online Desktop Connector or through a cloud Workspace Runtime.

### NFR-SEC-002: Secret And Resource Handling

Shared or provided model/API resources must not be exposed in the UI, logs, screenshots, committed files, or exported artifacts. User-owned runtime credentials remain owned by the local runtime or chosen cloud credential store.

### NFR-UX-001: IM-First Experience

The primary experience must feel like an IM collaboration product with agents, not a generic IDE clone. Code and artifact panels support the chat workflow but do not replace it.

### NFR-UX-002: Device-Appropriate Interaction

Web, Desktop, and Mobile must not expose identical UI density. Mobile must avoid complex code editing. Desktop must focus on connector state and local execution. Web must expose full workbench capabilities.

### NFR-OBS-001: Inspectable Agent Work

Users must be able to inspect Orchestrator plan, role assignment, task state, result summary, file changes, Git diff, and execution output when relevant.

---

## 9. Out Of Scope For MVP

- Multiple human users collaborating in the same Workspace or Session.
- Complete deployment platform.
- Agent Marketplace.
- Snapshot, checkpoint comparison, rollback, or non-Git version control.
- OpenCode Runtime.
- Feishu/WeChat hook integration.
- Mini-program or Feishu publishing.
- Rich document/PPT editing.
- Full Mobile code editing.
- Desktop as a duplicate full Web workbench.
- Backend persistent full-computer remote control.
- Independent username/password authentication.

---

## 10. Open Questions For Technical Design

1. Which desktop shell should be used for Desktop Connector, Electron or Tauri?
2. Should Mobile be responsive Web/PWA in MVP, or should it share a native wrapper later?
3. What exact native session resume/continue interfaces are available for Claude Code and Codex on the target environment?
4. What minimum permission policy categories should ship in P0 without overbuilding a full security engine?
5. How should cloud Workspace storage be represented in the MVP if local Workspace is the primary demo path?

---

## 11. Demo Acceptance Checklist

- [ ] User logs in with GitHub OAuth.
- [ ] User creates or binds a Workspace.
- [ ] Desktop Connector is online and bound to the same account.
- [ ] Desktop Connector detects Claude Code and Codex.
- [ ] User creates a Web Session with multiple Role Agents.
- [ ] User sends a task to Orchestrator.
- [ ] Orchestrator asks clarifying questions or generates a plan.
- [ ] User confirms the plan, or authorizes automatic progression.
- [ ] A Role Agent executes through configured Runtime.
- [ ] Runtime uses native session continuity where supported.
- [ ] Task result card shows status, summary, file changes, Git diff, preview link, and execution output where applicable.
- [ ] Mobile can view the same Session, send a lightweight reply, and complete a pending confirmation.
- [ ] Web/Mobile commands affecting local Workspace route through cloud backend to Desktop Connector.

---

## 12. Task Breakdown Hints

The implementation phase should create Trellis tasks by FR-ID. Suggested task groups:

| Group | FR Scope | Notes |
| --- | --- | --- |
| Identity and Workspace | FR-AUTH-001, FR-WS-001 | Establish cross-device identity and project boundary first. |
| Shared Domain Model | FR-DEVICE-001, FR-AGENT-001, FR-RUNTIME-001 | Define data contracts before UI divergence. |
| Web Workbench | FR-WEB-001, FR-CHAT-001, FR-RESULT-001 | Build the main demo surface. |
| Desktop Connector | FR-DESK-001, FR-ACTION-001 | Needed for local runtime execution. |
| Runtime Adapters | FR-RUNTIME-001, FR-CTX-001 | Claude Code and Codex continuity are core differentiators. |
| Orchestrator | FR-ORCH-001, FR-CTX-001, FR-PERM-001 | Planning, handoff, and approvals. |
| Mobile Surface | FR-MOB-001, FR-NOTIFY-001 | Lightweight IM, approvals, preview. |
| Compatibility Hooks | FR-PUBLISH-201, FR-VERSION-201, FR-RUNTIME-201 | Design seams, but do not overbuild MVP behavior. |

