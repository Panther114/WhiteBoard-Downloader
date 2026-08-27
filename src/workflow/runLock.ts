/** Process-local lock shared by GUI, CLI and MCP service calls. */
let activeOwner: string | null = null;

export class WorkflowBusyError extends Error {
  constructor(owner: string | null) {
    super(`A Blackboard workflow is already running${owner ? ` (${owner})` : ''}. Try again when it finishes.`);
    this.name = 'WorkflowBusyError';
  }
}

export function acquireWorkflowLock(owner: string): () => void {
  if (activeOwner) throw new WorkflowBusyError(activeOwner);
  activeOwner = owner;
  return () => {
    if (activeOwner === owner) activeOwner = null;
  };
}

export function getWorkflowLockStatus(): { busy: boolean; owner?: string } {
  return activeOwner ? { busy: true, owner: activeOwner } : { busy: false };
}
