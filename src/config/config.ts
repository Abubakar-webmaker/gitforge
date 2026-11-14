
export interface RepositoryConfigOptions {
  readonly bare: boolean;
  readonly platform?: NodeJS.Platform;
}

export function generateRepositoryConfig(
  options: RepositoryConfigOptions
): string {
  const platform = options.platform ?? process.platform;

  const fileMode = platform !== "win32";
  const logAllRefUpdates = !options.bare;

  return [
    "[core]",
    "\trepositoryformatversion = 0",
    `\tfilemode = ${fileMode}`,
    `\tbare = ${options.bare}`,
    `\tlogallrefupdates = ${logAllRefUpdates}`,
    ""
  ].join("\n");
}

export function generateRepositoryDescription(): string {
  return "Unnamed repository; edit this file 'description' to name the repository.\n";
}

export function generateInfoExclude(): string {
  return [
    "# GitForge repository-specific exclude patterns.",
    "# See gitignore documentation for pattern syntax.",
    ""
  ].join("\n");
}
