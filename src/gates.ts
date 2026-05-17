export class WriteGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteGateError";
  }
}

export function assertConfirmedWrite(args: Record<string, unknown>, toolName: string): void {
  if (args.confirm !== true) {
    throw new WriteGateError(
      `${toolName} is a write operation. Pass {"confirm": true} to proceed.`,
    );
  }
}

export function assertDestructive(args: Record<string, unknown>, toolName: string): void {
  if (args.confirm !== true || args.destructive !== true) {
    throw new WriteGateError(
      `${toolName} is a destructive operation. Pass {"confirm": true, "destructive": true} to proceed.`,
    );
  }
}
