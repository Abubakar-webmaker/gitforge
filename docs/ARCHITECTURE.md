
# GitForge Architecture

## Architectural principles

1. Separation of concerns.
2. Explicit module boundaries.
3. Dependency inversion.
4. Deterministic domain operations.
5. Filesystem operations isolated in infrastructure.
6. Git compatibility verified through integration tests.

## Layers

### CLI
Accepts commands, parses arguments and formats output.

Supported Phase 5 commands:
- `git commit -m "message"` - Create commits from trees
- `git log` - Display commit history
- `git log --oneline` - Short history format
- `git log --all` - Show all reachable commits
- `git show <ref>` - Display commit details
- `git rev-parse HEAD` - Resolve references

### Application
Coordinates repository operations and user workflows.

### Domain
Defines Git objects, references, indexes, commits and related rules.

Phase 5 additions:
- Commit objects with author/committer metadata
- Commit parent references and merge support
- Reference system (HEAD, branches)
- History traversal (depth-first, cycle protection)

### Infrastructure
Provides filesystem, hashing, compression and persistence implementations.

Phase 5 additions:
- Atomic reference updates with lock files
- Symbolic reference resolution
- HEAD management (direct and symbolic)

### Repository
Represents the Git repository layout and metadata.

### Transport
Handles remote communication and Git protocols.

## Compatibility policy

GitForge must use standard Git repository formats wherever compatibility is claimed.

A feature is not considered compatible until tested against standard Git.

## Phase 5 - Commit & History

### Implemented

1. **Commit Creation**
   - Commit objects from tree hashes
   - Author and committer metadata
   - Timestamp with timezone offsets
   - Multiline commit messages
   - Parent references (single and multiple)
   - Merge commit support

2. **References System**
   - Direct references (branch hashes)
   - Symbolic references (HEAD, branches)
   - Atomic updates with lock files
   - Reference resolution
   - Detached HEAD support
   - Branch enumeration

3. **History Traversal**
   - Depth-first commit traversal
   - Multiple parent handling
   - Cycle protection
   - Commit reachability analysis

4. **Commands**
   - `git commit` - Create commits (requires tree)
   - `git log` - Display history
   - `git log --oneline` - Short format
   - `git log --all` - All reachable
   - `git show <ref>` - Commit details
   - `git rev-parse HEAD` - Reference resolution

### Testing

- 22 new unit tests for references system
- 13 new integration tests for commit creation and history
- All 339 existing tests pass
- Commit serialization compatible with Git
- Reference format compatible with Git

### Known Limitations

1. Index integration not complete - commit requires pre-computed tree hash
2. Graph output simplified (shows parent chain only)
3. No support for annotated tags
4. No support for tag objects
5. No support for advanced log options (--grep, --since, etc.)
6. No support for commit signing

### Git Compatibility Status

- ✅ Commit object format
- ✅ Reference file format
- ✅ HEAD management
- ✅ Tree and blob integration
- ✅ Multiparent commits
- ⚠️  History traversal (basic operations supported)

