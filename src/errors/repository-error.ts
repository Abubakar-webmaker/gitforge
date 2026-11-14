
export type RepositoryErrorCode =
  | "REPOSITORY_NOT_FOUND"
  | "REPOSITORY_ALREADY_EXISTS"
  | "INVALID_REPOSITORY"
  | "INVALID_BRANCH_NAME"
  | "INVALID_REPOSITORY_PATH"
  | "REPOSITORY_INITIALIZATION_FAILED"
  | "FILESYSTEM_ERROR";

export class RepositoryError extends Error {
  public readonly code: RepositoryErrorCode;

  public override readonly cause?: unknown;

  constructor(
    code: RepositoryErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message);

    this.name = "RepositoryError";
    this.code = code;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
