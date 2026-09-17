/**
 * Error carrying the HTTP status a route handler should reply with.
 * Lives in its own module so both `context.ts` and `branch-scope.ts`
 * can throw it without a circular import.
 */
export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}
