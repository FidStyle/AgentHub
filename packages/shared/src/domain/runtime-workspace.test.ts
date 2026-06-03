import { describe, expect, it } from 'vitest'
import type { RuntimeWorkspace } from './runtime-workspace'
import {
  NativeCliToolActionKind,
  PermissionBrokerEventKind,
  RoleDispatchEventKind,
  assertRuntimeCwdMatchesWorkspaceRoot,
  createAcceptancePlanSummary,
  createArchitectDispatch,
  createRuntimeInvokeInputFromChat,
  createRuntimeWorkerJob,
  evaluateNativeCliToolPermission,
  resolveSelectedWorkspaceScope,
} from './runtime-workspace'

const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'

const cloudWorkspace: RuntimeWorkspace = {
  id: 'workspace-test2',
  name: 'test2-e427fab2',
  executionDomain: 'cloud',
  descriptor: {
    cloudProjectDir: workspaceRoot,
  },
}

describe('role runtime workspace permission contract', () => {
  it('resolves selected workspace root into runtime cwd and visible files only inside the workspace', () => {
    const scope = resolveSelectedWorkspaceScope([cloudWorkspace], 'workspace-test2', [
      `${workspaceRoot}/package.json`,
      `${workspaceRoot}/src/App.tsx`,
      `${workspaceRoot}/../agenthub/package.json`,
      '/Users/joytion/Documents/code/agenthub-worktrees/role-runtime-workspace-permissions/AGENTS.md',
      'server/index.ts',
    ])

    expect(scope).toEqual({
      workspaceId: 'workspace-test2',
      executionDomain: 'cloud',
      workspaceRoot,
      cwd: workspaceRoot,
      visibleFiles: ['package.json', 'server/index.ts', 'src/App.tsx'],
    })
  })

  it('creates /api/chat runtime invocation context without host AgentHub monorepo assumptions', () => {
    const invocation = createRuntimeInvokeInputFromChat({
      selectedWorkspaceId: 'workspace-test2',
      sessionId: 'session-acceptance',
      roleAgentId: 'role-architect',
      runtimeType: 'hosted',
      workspaces: [cloudWorkspace],
      userMessage: '做一个加减乘除的简单网站，使用sqlite存储历史记录',
      fileCandidates: [`${workspaceRoot}/README.md`, '/repo/AgentHub/package.json'],
    })

    expect(invocation.cwd).toBe(workspaceRoot)
    expect(invocation.workspaceRoot).toBe(workspaceRoot)
    expect(createRuntimeWorkerJob(invocation)).toEqual(
      expect.objectContaining({
        id: 'worker-workspace-test2-session-acceptance-role-architect',
        workspaceRoot,
        cwd: workspaceRoot,
        runtimeInvocationContextId: 'ctx-workspace-test2-session-acceptance-role-architect',
      }),
    )
    expect(invocation.contextPackage).toEqual(
      expect.objectContaining({
        workspaceRoot,
        visibleFiles: ['README.md'],
        files: ['README.md'],
      }),
    )
    expect(invocation.contextPackage.constraints.join('\n')).toContain(
      'Do not infer stack, package manager, AGENTS.md, Trellis, or monorepo context',
    )
    expect(invocation.contextPackage.constraints.join('\n')).not.toContain('Next.js 15')
    expect(invocation.contextPackage.constraints.join('\n')).not.toContain('React 19')
    expect(invocation.contextPackage.constraints.join('\n')).not.toContain('Drizzle')
    expect(invocation.contextPackage.constraints.join('\n')).not.toContain('Postgres')
    expect(invocation.contextPackage.constraints.join('\n')).not.toContain('next-auth')
    expect(() =>
      assertRuntimeCwdMatchesWorkspaceRoot({
        cwd: '/Users/joytion/Documents/code/agenthub-worktrees/role-runtime-workspace-permissions',
        workspaceRoot,
      }),
    ).toThrow('RUNTIME_CWD_MISMATCH')
  })

  it('dispatches architect engineering requests to backend and frontend roles', () => {
    const dispatch = createArchitectDispatch({
      workspaceId: 'workspace-test2',
      sessionId: 'session-acceptance',
      architectRoleAgentId: 'role-architect',
      userMessage: '做一个加减乘除的简单网站，使用sqlite存储历史记录',
    })
    const plan = createAcceptancePlanSummary({
      workspaceId: 'workspace-test2',
      sessionId: 'session-acceptance',
      userMessage: '做一个加减乘除的简单网站，使用sqlite存储历史记录',
    })

    expect(dispatch.requiresEngineeringDispatch).toBe(true)
    expect(dispatch.targetRoleAgentIds).toEqual(['role-backend', 'role-frontend'])
    expect(dispatch.events.map((event) => event.kind)).toEqual([
      RoleDispatchEventKind.PlanCreated,
      RoleDispatchEventKind.MailboxCreated,
      RoleDispatchEventKind.RoleDispatched,
      RoleDispatchEventKind.RoleDispatched,
    ])
    expect(plan.nodes.map((node) => node.roleAgentId)).toEqual(['role-backend', 'role-frontend'])
  })

  it('requires product permission events before native CLI tool execution', () => {
    const toolCall = {
      id: 'tool-write-1',
      workspaceId: 'workspace-test2',
      sessionId: 'session-acceptance',
      runtimeInvocationId: 'runtime-1',
      actionKind: NativeCliToolActionKind.WriteFile,
      cwd: workspaceRoot,
      targetPaths: [`${workspaceRoot}/src/App.tsx`],
      commandPreview: 'write src/App.tsx',
    }

    const pending = evaluateNativeCliToolPermission(toolCall, {
      workspaceId: 'workspace-test2',
      workspaceRoot,
    })
    const rejected = evaluateNativeCliToolPermission(toolCall, {
      workspaceId: 'workspace-test2',
      workspaceRoot,
      decision: {
        approvalId: 'approval-tool-write-1',
        status: 'rejected',
        decidedBy: 'user-1',
      },
    })
    const approved = evaluateNativeCliToolPermission(toolCall, {
      workspaceId: 'workspace-test2',
      workspaceRoot,
      decision: {
        approvalId: 'approval-tool-write-1',
        status: 'approved',
        decidedBy: 'user-1',
      },
    })

    expect(pending.allowed).toBe(false)
    expect(pending.events.map((event) => event.kind)).toEqual([PermissionBrokerEventKind.ApprovalRequired])
    expect(rejected.allowed).toBe(false)
    expect(rejected.events.map((event) => event.kind)).toEqual([
      PermissionBrokerEventKind.Rejected,
      PermissionBrokerEventKind.ExecutionBlocked,
    ])
    expect(approved.allowed).toBe(true)
    expect(approved.events.map((event) => event.kind)).toEqual([
      PermissionBrokerEventKind.Approved,
      PermissionBrokerEventKind.ExecutionAllowed,
    ])
    expect(approved.events[1].targetPaths).toEqual([workspaceRoot, `${workspaceRoot}/src/App.tsx`])
  })

  it.each([
    NativeCliToolActionKind.InstallDependency,
    NativeCliToolActionKind.StartService,
    NativeCliToolActionKind.NetworkRequest,
    NativeCliToolActionKind.WorkspaceExternalPathAccess,
    NativeCliToolActionKind.DestructiveCommand,
  ])('blocks %s until approval and never allows outside-root targets', (actionKind) => {
    const result = evaluateNativeCliToolPermission(
      {
        id: `tool-${actionKind}`,
        workspaceId: 'workspace-test2',
        sessionId: 'session-acceptance',
        runtimeInvocationId: 'runtime-1',
        actionKind,
        cwd: workspaceRoot,
        targetPaths: ['/Users/joytion/Documents/code/agenthub-worktrees/role-runtime-workspace-permissions/package.json'],
      },
      {
        workspaceId: 'workspace-test2',
        workspaceRoot,
        decision: {
          approvalId: `approval-tool-${actionKind}`,
          status: 'approved',
          decidedBy: 'user-1',
        },
      },
    )

    expect(result.allowed).toBe(false)
    expect(result.code).toBe('OUTSIDE_WORKSPACE_ROOT')
    expect(result.events.map((event) => event.kind)).toEqual([PermissionBrokerEventKind.ExecutionBlocked])
  })
})
