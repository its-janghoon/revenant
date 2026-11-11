// Server components: the signed-in user's project, or the 404 page.
import "server-only";
import { notFound } from "next/navigation";
import { needUser, type User } from "./auth";
import { HttpError } from "./http";
import { findProject, type ProjectRow } from "./store";

export async function pageProject(id: string): Promise<{ u: User; p: ProjectRow }> {
  const u = await needUser();
  try {
    return { u, p: await findProject(u, id) };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}
