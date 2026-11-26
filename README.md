
# GitForge

A Git-compatible version control system implemented from scratch in TypeScript and Node.js. Implements Git's core object storage, index, references, branching, merging, diff engine, packfiles, and remote transport protocols.

## Status

**Phase 11**: Production Hardening & Security Audit in progress. All 10 phases functionally complete with security enhancements underway.

## Features Implemented

### Core Repository (Phases 1-2) ✅
- Repository initialization (bare and non-bare)
- Repository discovery (.git directory structure)
- Object database with SHA-1 hashing
- Configuration management (.git/config)

### Git Objects (Phases 3-4) ✅
- Blob objects (file contents)
- Tree objects (directory structures)
- Commit objects (snapshots with history)
- Tag objects (annotated and lightweight)
- Object serialization and storage
- Object compression (zlib)

### Index & Staging (Phase 5) ✅
- Git index file format (.git/index)
- Staging individual files
- Unstaging
- Status reporting

### Branching & Merging (Phases 6-7) ✅
- Branch creation, deletion, listing
- Branch switching (checkout)
- Merge-base calculation (3-way merge preparation)
- Merge operations
- Conflict detection and markers
- Conflict resolution

### Diff Engine (Phase 8) ✅
- Myers diff algorithm
- File-level and line-level diffs
- Diff output formatting
- Cross-file comparisons

### Packfiles (Phase 9) ✅
- Packfile reading and writing
- Object deltification
- Packfile index (.idx) generation
- Efficient object storage and transfer

### Advanced Operations (Phase 10) ✅
- Tags (create, list, delete, resolve)
- Reset (soft, mixed, hard modes)
- Revert (commit inversion)
- Cherry-pick (commit replay)
- Stash (save/apply uncommitted changes)
- File system check (fsck)

### Remote Operations (Phase 10) ✅
- HTTP smart protocol client
- Clone (remote repository cloning)
- Fetch (download objects and refs)
- Push (upload objects and refs)
- Pull (fetch + merge)

### Security Hardening (Phase 11) 🔄
- Input validation for all user inputs
- Path traversal prevention
- Symlink attack prevention
- Stash log sanitization
- TLS certificate validation
- Size and timeout limits
- Atomic reference operations

## Requirements

- Node.js 20+
- npm
- (Optional) Git for interoperability testing

## Installation

```bash
git clone <repository-url>
cd gitforge
npm install
npm run build
npm run test
```

## Usage

### Command Line

```bash
# Initialize a repository
gitforge init
gitforge init --bare

# Check repository status
gitforge status

# Create commits
gitforge add <file>
gitforge commit -m "message"

# Branching
gitforge branch                    # List branches
gitforge branch <branch-name>      # Create branch
gitforge switch <branch-name>      # Switch branch

# Merging
gitforge merge <branch-name>       # Merge branch
gitforge merge --abort             # Abort merge

# Remote operations
gitforge remote add origin <url>   # Add remote
gitforge fetch origin              # Fetch from remote
gitforge push origin <branch>      # Push to remote
gitforge pull origin               # Pull from remote

# Advanced
gitforge stash                     # Stash changes
gitforge stash apply               # Apply stash
gitforge reset HEAD~1              # Undo last commit
gitforge revert <commit-hash>      # Revert commit
gitforge cherry-pick <commit-hash> # Cherry-pick commit
gitforge tag <tag-name>            # Create tag
```

### Programmatic Usage

```typescript
import { 
  discoverRepository,
  createBranch,
  createCommit,
  writeBranch
} from "gitforge";

const repo = await discoverRepository();
await createBranch(repo, "my-feature", commitHash);
```

## Development

```bash
# Type checking
npm run typecheck

# Testing
npm run test                # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report

# Building
npm run build             # Compile TypeScript

# Cleaning
npm run clean             # Remove dist/
```

## Project Structure

```
src/
├── cli/                 # Command-line interface
├── objects/             # Git objects (blob, tree, commit, tag)
├── references/          # Git references (HEAD, branches, tags)
├── branching/           # Branching and merging
├── diff/                # Diff engine (Myers algorithm)
├── remote/              # Remote operations and HTTP transport
├── repository/          # Repository discovery and initialization
├── utils/               # Utility functions (validation, paths, etc.)
├── config/              # Configuration management
├── stash/               # Stash operations
├── tags/                # Tag management
├── reset/               # Reset operations
├── revert/              # Revert operations
├── cherrypick/          # Cherry-pick operations
└── maintenance/         # fsck and other maintenance
tests/
├── unit/                # Unit tests
├── integration/         # Integration tests
└── helpers/             # Test utilities
docs/
├── ARCHITECTURE.md      # Architecture overview
└── SECURITY.md          # Security model and mitigations
```

## Design Principles

- **Git-Compatible**: Output matches Git's object formats and behavior
- **Type-Safe**: Strict TypeScript with comprehensive type checking
- **Modular**: Clear separation of concerns across phases
- **Tested**: Unit and integration tests for all phases
- **No External VCS**: Pure implementation, no git subprocesses
- **Cross-Platform**: Works on Windows, macOS, Linux
- **Secure**: Input validation, TLS enforcement, symlink protection

## Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Design overview for phases 1-10
- **[SECURITY.md](docs/SECURITY.md)** — Security threat model and mitigations
- **[PHASE11_AUDIT_REPORT.md](PHASE11_AUDIT_REPORT.md)** — Comprehensive audit findings

## Known Limitations

### Not Implemented
- **Signed commits/tags**: No GPG integration
- **SSH authentication**: Only supports HTTPS with TLS
- **Credential storage**: Use system keychain
- **Submodules**: Not supported
- **Hooks**: Not executed
- **Rebasing**: Not implemented
- **Worktrees**: Not supported

### Production Considerations
- Reference locking may have race conditions on networked filesystems
- Working tree updates not atomic; SIGTERM can leave incomplete state
- For high-concurrency scenarios, use external lock management
- Not recommended for `.git/` on network drives without additional safeguards

## Security

For security information, threat model, and deployment recommendations, see **[docs/SECURITY.md](docs/SECURITY.md)**.

**Report Security Issues**: Open a GitHub issue with label `security` (or use private reporting once configured).

## Performance

Performance benchmarks with reproducible datasets are available after Phase 11 completion.

## Contributing

Contributions welcome! Please ensure:
- All tests pass: `npm test`
- TypeScript compilation succeeds: `npm run typecheck`
- Code follows project style conventions

## License

MIT

---

**Last Updated**: November 2026 — Phase 11 Production Hardening
**Stability**: Beta (complete functionality, security audit in progress)