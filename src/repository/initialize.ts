
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";

import path from "node:path";
import { randomUUID } from "node:crypto";

import { generateInfoExclude, generateRepositoryConfig, generateRepositoryDescription } from "../config/config.js";
import { RepositoryError } from "../errors/repository-error.js";
import { resolveAbsolutePath } from "../utils/paths.js";
import { getRepositoryLayout } from "./layout.js";
import { createRepository, type Repository } from "./repository.js";

export interface InitializeRepositoryOptions {
  readonly directory?: string;
  readonly bare?: boolean;
  readonly initialBranch?: string;
}

export interface InitializeRepositoryResult {
  readonly repository: Repository;
  readonly reinitialized: boolean;
}

function validateBranchName(branch: string): void {
  const forbiddenCharacters =
    /[\x00-\x20\x7f~^:?*\\]/;

  const invalid =
    branch.length === 0 ||
    branch === "@" ||
    branch.startsWith("/") ||
    branch.endsWith("/") ||
    branch.endsWith(".") ||
    branch.includes("..") ||
    branch.includes("//") ||
    branch.includes("@{") ||
    forbiddenCharacters.test(branch) ||
    branch.includes("[");

  const components = branch.split("/");

  const invalidComponent = components.some(
    (component) =>
      component.length === 0 ||
      component === "@" ||
      component.startsWith(".") ||
      component.endsWith(".") ||
      component.endsWith(".lock")
  );

  if (invalid || invalidComponent) {
    throw new RepositoryError(
      "INVALID_BRANCH_NAME",
      `Invalid branch name: "${branch}".`
    );
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

async function isValidRepository(
  gitDir: string
): Promise<boolean> {
  try {
    const layout = getRepositoryLayout(gitDir);

    const [head, config, objects, refs] = await Promise.all([
      stat(layout.head),
      stat(layout.config),
      stat(layout.objects),
      stat(layout.refs)
    ]);

    return (
      head.isFile() &&
      config.isFile() &&
      objects.isDirectory() &&
      refs.isDirectory()
    );
  } catch {
    return false;
  }
}

async function writeRepositoryMetadata(
  gitDir: string,
  bare: boolean,
  initialBranch: string
): Promise<void> {
  const layout = getRepositoryLayout(gitDir);

  const directories = [
    layout.objects,
    layout.objectsInfo,
    layout.objectsPack,
    layout.refs,
    layout.refsHeads,
    layout.refsTags,
    layout.hooks,
    layout.info
  ];

  await Promise.all(
    directories.map((directory) =>
      mkdir(directory, { recursive: true })
    )
  );

  const metadata = [
    {
      file: layout.head,
      content: `ref: refs/heads/${initialBranch}\n`
    },
    {
      file: layout.config,
      content: generateRepositoryConfig({ bare })
    },
    {
      file: layout.description,
      content: generateRepositoryDescription()
    },
    {
      file: layout.exclude,
      content: generateInfoExclude()
    }
  ];

  for (const item of metadata) {
    await writeFile(item.file, item.content, {
      encoding: "utf8",
      flag: "wx"
    });
  }
}

async function initializeWorkingRepository(
  workTree: string,
  initialBranch: string
): Promise<InitializeRepositoryResult> {
  await mkdir(workTree, { recursive: true });

  const gitDir = path.join(workTree, ".git");

  if (await exists(gitDir)) {
    if (!(await isValidRepository(gitDir))) {
      throw new RepositoryError(
        "INVALID_REPOSITORY",
        `An invalid or unsupported .git entry already exists at ${gitDir}.`
      );
    }

    const layout = getRepositoryLayout(gitDir);

    return {
      repository: createRepository(
        gitDir,
        workTree,
        false,
        layout
      ),
      reinitialized: true
    };
  }

  const temporaryParent = await mkdtemp(
    path.join(workTree, ".gitforge-init-")
  );

  const temporaryGitDir = path.join(
    temporaryParent,
    "repository"
  );

  try {
    await writeRepositoryMetadata(
      temporaryGitDir,
      false,
      initialBranch
    );

    await rename(temporaryGitDir, gitDir);

    const layout = getRepositoryLayout(gitDir);

    return {
      repository: createRepository(
        gitDir,
        workTree,
        false,
        layout
      ),
      reinitialized: false
    };
  } catch (error) {
    throw new RepositoryError(
      "REPOSITORY_INITIALIZATION_FAILED",
      `Could not initialize repository at ${workTree}.`,
      error
    );
  } finally {
    await rm(temporaryParent, {
      recursive: true,
      force: true
    });
  }
}

async function initializeBareRepository(
  gitDir: string,
  initialBranch: string
): Promise<InitializeRepositoryResult> {
  await mkdir(gitDir, { recursive: true });

  if (await isValidRepository(gitDir)) {
    return {
      repository: createRepository(
        gitDir,
        null,
        true,
        getRepositoryLayout(gitDir)
      ),
      reinitialized: true
    };
  }

  const temporaryGitDir = path.join(
    gitDir,
    `.gitforge-init-${randomUUID()}`
  );

  const createdFiles: string[] = [];
  const createdDirectories: string[] = [];

  try {
    await writeRepositoryMetadata(
      temporaryGitDir,
      true,
      initialBranch
    );

    const stagedLayout = getRepositoryLayout(temporaryGitDir);
    const targetLayout = getRepositoryLayout(gitDir);

    const stagedDirectories = [
      stagedLayout.objects,
      stagedLayout.objectsInfo,
      stagedLayout.objectsPack,
      stagedLayout.refs,
      stagedLayout.refsHeads,
      stagedLayout.refsTags,
      stagedLayout.hooks,
      stagedLayout.info
    ];

    for (const stagedDirectory of stagedDirectories) {
      const relative = path.relative(
        temporaryGitDir,
        stagedDirectory
      );

      const destination = path.join(gitDir, relative);
      await mkdir(destination, { recursive: true });
      createdDirectories.push(destination);
    }

    const stagedFiles = [
      stagedLayout.head,
      stagedLayout.config,
      stagedLayout.description,
      stagedLayout.exclude
    ];

    for (const stagedFile of stagedFiles) {
      const relative = path.relative(
        temporaryGitDir,
        stagedFile
      );

      const destination = path.join(gitDir, relative);

      const content = await readFile(stagedFile);

      await writeFile(destination, content, {
        flag: "wx"
      });

      createdFiles.push(destination);
    }

    return {
      repository: createRepository(
        gitDir,
        null,
        true,
        targetLayout
      ),
      reinitialized: false
    };
  } catch (error) {
    await Promise.all(
      createdFiles.map((file) =>
        rm(file, { force: true })
      )
    );

    await Promise.all(
      createdDirectories.map((dir) =>
        rm(dir, { recursive: true, force: true })
      )
    );

    throw new RepositoryError(
      "REPOSITORY_INITIALIZATION_FAILED",
      `Could not initialize bare repository at ${gitDir}.`,
      error
    );
  } finally {
    await rm(temporaryGitDir, {
      recursive: true,
      force: true
    });
  }
}

export async function initializeRepository(
  options: InitializeRepositoryOptions = {}
): Promise<InitializeRepositoryResult> {
  const directory = resolveAbsolutePath(
    options.directory ?? process.cwd()
  );

  const bare = options.bare ?? false;
  const initialBranch = options.initialBranch ?? "main";

  validateBranchName(initialBranch);

  try {
    if (bare) {
      return await initializeBareRepository(
        directory,
        initialBranch
      );
    }

    return await initializeWorkingRepository(
      directory,
      initialBranch
    );
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "FILESYSTEM_ERROR",
      `Filesystem operation failed at ${directory}.`,
      error
    );
  }
}
