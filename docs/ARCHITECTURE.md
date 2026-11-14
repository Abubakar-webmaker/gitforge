
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

### Application
Coordinates repository operations and user workflows.

### Domain
Defines Git objects, references, indexes, commits and related rules.

### Infrastructure
Provides filesystem, hashing, compression and persistence implementations.

### Repository
Represents the Git repository layout and metadata.

### Transport
Handles remote communication and Git protocols.

## Compatibility policy

GitForge must use standard Git repository formats wherever compatibility is claimed.

A feature is not considered compatible until tested against standard Git.
