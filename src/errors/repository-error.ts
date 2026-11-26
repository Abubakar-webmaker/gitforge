
export type RepositoryErrorCode =
  // Repository operations
  | "REPOSITORY_NOT_FOUND"
  | "REPOSITORY_ALREADY_EXISTS"
  | "INVALID_REPOSITORY"
  | "INVALID_REPOSITORY_PATH"
  | "REPOSITORY_INITIALIZATION_FAILED"
  | "DISCOVER_REFS_FAILED"
  // Input validation
  | "INVALID_INPUT"
  | "INVALID_BRANCH_NAME"
  | "INVALID_TAG"
  | "INVALID_COMMIT"
  | "INVALID_PATH"
  | "INVALID_URL"
  | "INVALID_MESSAGE"
  | "INVALID_REFERENCE"
  | "INVALID_HEAD"
  | "INVALID_OBJECT"
  | "INVALID_TARGET"
  | "INVALID_TREE"
  | "INVALID_BRANCH"
  | "INVALID_COMMIT_HASH"
  | "INVALID_ARGUMENTS"
  | "BARE_REPOSITORY"
  // Reference and object operations
  | "REFERENCE_ERROR"
  | "OBJECT_NOT_FOUND"
  | "OBJECT_CORRUPTED"
  | "TARGET_NOT_FOUND"
  | "COMMIT_NOT_FOUND"
  // Tag operations
  | "TAG_EXISTS"
  | "TAG_NOT_FOUND"
  | "TAG_DELETE_FAILED"
  // Branch operations
  | "BRANCH_NOT_FOUND"
  | "BRANCH_EXISTS"
  | "BRANCH_DELETE_FAILED"
  | "BRANCH_RENAME_FAILED"
  | "CANNOT_DELETE_CURRENT_BRANCH"
  // Checkout operations
  | "CHECKOUT_ERROR"
  | "SWITCH_ERROR"
  | "UNCOMMITTED_CHANGES"
  // Commit operations
  | "COMMIT_ERROR"
  | "NO_COMMITS"
  | "NOT_A_COMMIT"
  | "CANNOT_REVERT_ROOT"
  // Merge operations
  | "MERGE_CONFLICT"
  | "MERGE_FAILED"
  | "MERGE_BASE_ERROR"
  | "NO_COMMON_ANCESTOR"
  | "NO_MERGE_IN_PROGRESS"
  | "ABORT_ERROR"
  | "CHERRY_PICK_CONFLICT"
  | "CHERRY_PICK_FAILED"
  | "NO_CHERRYPICK_IN_PROGRESS"
  // Revert operations
  | "REVERT_CONFLICT"
  | "REVERT_FAILED"
  | "NO_REVERT_IN_PROGRESS"
  // Reset operations
  | "RESET_FAILED"
  // Stash operations
  | "STASH_NOT_FOUND"
  | "STASH_SAVE_FAILED"
  | "STASH_DELETE_FAILED"
  | "STASH_READ_FAILED"
  | "STASH_CLEAR_FAILED"
  | "INVALID_STASH"
  | "NO_STASH_IN_PROGRESS"
  // Log and history
  | "LOG_ERROR"
  | "SHOW_ERROR"
  | "COMMIT_HISTORY_ERROR"
  // Filesystem operations
  | "FILESYSTEM_ERROR"
  | "FILE_NOT_FOUND"
  // Remote operations
  | "REMOTE_ERROR"
  | "REMOTE_NOT_FOUND"
  | "HTTP_ERROR"
  | "HTTP_TIMEOUT"
  | "HTTP_REQUEST_FAILED"
  | "HTTP_RESPONSE_TOO_LARGE"
  | "PROTOCOL_ERROR"
  | "UPLOAD_PACK_FAILED"
  | "RECEIVE_PACK_FAILED"
  | "FETCH_FAILED"
  | "PUSH_FAILED"
  | "PULL_FAILED"
  | "CLONE_FAILED"
  // Fsck operations
  | "FSCK_ERROR"
  | "OBJECT_DANGLING"
  // Reset/Revert operations
  | "DETACHED_HEAD"
  | "INVALID_MODE"
  // General errors
  | "NOT_FOUND"
  | "NOT_IMPLEMENTED"
  | "MESSAGE_TOO_LONG"
  | "HEAD_NOT_FOUND";

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
