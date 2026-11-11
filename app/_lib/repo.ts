// The app's CodeCommit repository: read files and folders, commit, parse tasks.md.
import "server-only";
import {
  CreateCommitCommand, CreateRepositoryCommand, GetBranchCommand, GetFileCommand, GetFolderCommand,
  type CreateCommitCommandInput,
} from "@aws-sdk/client-codecommit";
import type { TaskState } from "@/lib/contracts";
import { codecommit } from "./aws";
import { HttpError } from "./http";

const missing = (e: unknown) => /DoesNotExist|NotFound/.test((e as Error).name ?? "");

export async function createRepo(repo: string, tags: Record<string, string>): Promise<void> {
  try {
    await codecommit.send(new CreateRepositoryCommand({ repositoryName: repo, repositoryDescription: "Revenant app", tags }));
  } catch (e) {
    if ((e as Error).name !== "RepositoryNameExistsException") throw e;
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

export async function readFile(repo: string, ref: string, path: string): Promise<{ content: string; commit: string } | null> {
  try {
    const r = await codecommit.send(new GetFileCommand({ repositoryName: repo, commitSpecifier: ref, filePath: path }));
    return { content: new TextDecoder().decode(r.fileContent), commit: r.commitId ?? "" };
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
}

export interface Folder { commit: string; path: string; folders: string[]; files: string[] }

export async function readFolder(repo: string, ref: string, path: string): Promise<Folder | null> {
  try {
    const r = await codecommit.send(new GetFolderCommand({ repositoryName: repo, commitSpecifier: ref, folderPath: path || "/" }));
    const name = (p?: string) => (p ?? "").split("/").pop() ?? "";
    return {
      commit: r.commitId ?? "",
      path,
      folders: (r.subFolders ?? []).map((f) => name(f.absolutePath)).sort(),
      files: [...(r.files ?? []), ...(r.symbolicLinks ?? [])].map((f) => name(f.absolutePath)).sort(),
    };
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
}

export interface Change { path: string; content: string | null }

export async function commit(repo: string, branch: string, parent: string, message: string, files: Change[], author: { name: string; email: string }): Promise<string> {
  const input: CreateCommitCommandInput = {
    repositoryName: repo,
    branchName: branch,
    parentCommitId: parent,
    commitMessage: message,
    authorName: author.name || "Revenant user",
    email: author.email || undefined,
    putFiles: files.filter((f) => f.content !== null).map((f) => ({ filePath: f.path, fileContent: new TextEncoder().encode(f.content!) })),
    deleteFiles: files.filter((f) => f.content === null).map((f) => ({ filePath: f.path })),
  };
  try {
    const r = await codecommit.send(new CreateCommitCommand(input));
    return r.commitId ?? "";
  } catch (e) {
    const n = (e as Error).name;
    if (n === "ParentCommitIdOutdatedException") throw new HttpError(409, "The branch moved since you opened the file. Reload it and commit again.", "outdated");
    if (n === "NoChangeException") throw new HttpError(409, "Nothing changed", "no_change");
    throw e;
  }
}

export const specPath = (app: string, file: "requirements" | "design" | "tasks") => `.kiro/specs/${app}/${file}.md`;

export interface ParsedTask { number: string; title: string; state: TaskState }

/** `- [ ] 1. Title`, `- [-] 2. Title`, `- [x] 3. Title`, and subtasks `- [ ] 3.1 Title`. */
export function parseTasks(md: string): ParsedTask[] {
  const out: ParsedTask[] = [];
  for (const line of md.split("\n")) {
    const m = /^\s*[-*]\s+\[([ xX-])\]\s+(\d+(?:\.\d+)*)\.?\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const mark = m[1]!;
    out.push({ number: m[2]!, title: m[3]!.replace(/\*\*/g, ""), state: mark === "-" ? "running" : mark === " " ? "todo" : "done" });
  }
  return out;
}

/** "2" < "3" < "3.1" < "10" */
export function byNumber(a: { number: string }, b: { number: string }): number {
  const x = a.number.split(".").map(Number);
  const y = b.number.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d) return d;
  }
  return 0;
}
