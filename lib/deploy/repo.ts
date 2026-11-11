// The few CodeCommit calls the deploy flow makes: read a file or folder on a branch, a branch
// head, and the merge to main at publish.
import "server-only";
import {
  GetBranchCommand, GetFileCommand, GetFolderCommand, MergeBranchesByFastForwardCommand, MergeBranchesBySquashCommand,
} from "@aws-sdk/client-codecommit";
import { codecommit } from "./aws";

const missing = (e: unknown) => /DoesNotExist/.test((e as Error).name);

export async function readFile(repo: string, ref: string, path: string): Promise<string | null> {
  try {
    const r = await codecommit.send(new GetFileCommand({ repositoryName: repo, commitSpecifier: ref, filePath: path }));
    return new TextDecoder().decode(r.fileContent);
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
}

/** Repo-relative paths of the files directly in `path`. */
export async function listFolder(repo: string, ref: string, path: string): Promise<string[]> {
  try {
    const r = await codecommit.send(new GetFolderCommand({ repositoryName: repo, commitSpecifier: ref, folderPath: path }));
    return (r.files ?? []).map((f) => f.absolutePath!).filter(Boolean);
  } catch (e) {
    if (missing(e)) return [];
    throw e;
  }
}

export async function head(repo: string, branch: string): Promise<string | null> {
  try {
    const r = await codecommit.send(new GetBranchCommand({ repositoryName: repo, branchName: branch }));
    return r.branch?.commitId ?? null;
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
}

/** Merges `source` into `target`: fast-forward when possible, else one squash commit. Returns the new head of target. */
export async function merge(repo: string, source: string, target: string, message: string): Promise<string> {
  try {
    const r = await codecommit.send(new MergeBranchesByFastForwardCommand({
      repositoryName: repo, sourceCommitSpecifier: source, destinationCommitSpecifier: target, targetBranch: target,
    }));
    return r.commitId!;
  } catch {
    // main moved since the preview branched off: squash instead (a real error fails there too)
  }
  const r = await codecommit.send(new MergeBranchesBySquashCommand({
    repositoryName: repo,
    sourceCommitSpecifier: source,
    destinationCommitSpecifier: target,
    targetBranch: target,
    commitMessage: message,
    authorName: "Revenant",
    email: "revenant@example.com",
  }));
  return r.commitId!;
}
