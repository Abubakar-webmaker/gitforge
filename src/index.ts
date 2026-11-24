
export {
  initializeRepository,
  type InitializeRepositoryOptions,
  type InitializeRepositoryResult
} from "./repository/initialize.js";

export {
  discoverRepository
} from "./repository/discover.js";

export {
  getRepositoryLayout,
  type RepositoryLayout
} from "./repository/layout.js";

export {
  type Repository
} from "./repository/repository.js";

export {
  RepositoryError,
  type RepositoryErrorCode
} from "./errors/repository-error.js";

// Phase 2: Git Object Database
export * from "./objects/index.js";

// Phase 6: Branching & Merging
export * from "./branching/index.js";
