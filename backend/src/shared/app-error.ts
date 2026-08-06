export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Array<Record<string, unknown>> = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}
