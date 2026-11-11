// Cognito admin APIs for the install's user pool (compute role: infra/install.yaml, Sid Users).
import "server-only";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { outputs } from "@/lib/amplify";
import { HttpError } from "./guard";

const pool = outputs.auth.user_pool_id;
const idp = new CognitoIdentityProviderClient({ region: outputs.auth.aws_region });

export type UserStatus = "active" | "invited" | "disabled";

export interface PoolUser {
  id: string; // sub, the Revenant user id
  username: string;
  email: string;
  name: string;
  admin: boolean;
  status: UserStatus;
  createdAt: string | null;
}

const attr = (u: UserType, k: string) => u.Attributes?.find((a) => a.Name === k)?.Value ?? "";

/** "mina.park@example.com" -> "Mina Park" when the pool has no name attribute. */
export function displayName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.split(/[._-]+/).filter(Boolean).map((p) => p[0]!.toUpperCase() + p.slice(1)).join(" ") || email;
}

function toUser(u: UserType, admin: boolean): PoolUser {
  const email = attr(u, "email");
  return {
    id: attr(u, "sub"),
    username: u.Username ?? "",
    email,
    name: attr(u, "name") || displayName(email),
    admin,
    status: u.Enabled === false ? "disabled" : u.UserStatus === "FORCE_CHANGE_PASSWORD" ? "invited" : "active",
    createdAt: u.UserCreateDate?.toISOString() ?? null,
  };
}

async function isAdmin(username: string): Promise<boolean> {
  const r = await idp.send(new AdminListGroupsForUserCommand({ UserPoolId: pool, Username: username }));
  return (r.Groups ?? []).some((g) => g.GroupName === "admin");
}

export async function listUsers(): Promise<PoolUser[]> {
  const all: UserType[] = [];
  let token: string | undefined;
  do {
    const r = await idp.send(new ListUsersCommand({ UserPoolId: pool, PaginationToken: token, Limit: 60 }));
    all.push(...(r.Users ?? []));
    token = r.PaginationToken;
  } while (token);
  const admins = await Promise.all(all.map((u) => isAdmin(u.Username ?? "")));
  return all.map((u, i) => toUser(u, admins[i] ?? false)).sort((a, b) => a.email.localeCompare(b.email));
}

export async function findUser(id: string): Promise<PoolUser> {
  const r = await idp.send(new ListUsersCommand({ UserPoolId: pool, Filter: `sub = "${id.replace(/"/g, "")}"`, Limit: 1 }));
  const u = r.Users?.[0];
  if (!u?.Username) throw new HttpError(404, "no such user");
  return toUser(u, await isAdmin(u.Username));
}

/** Cognito emails the invite itself (amplify/auth/resource.ts, userInvitation). */
export async function inviteUser(email: string, admin: boolean): Promise<PoolUser> {
  let u: UserType | undefined;
  try {
    const r = await idp.send(new AdminCreateUserCommand({
      UserPoolId: pool,
      Username: email,
      UserAttributes: [{ Name: "email", Value: email }, { Name: "email_verified", Value: "true" }],
      DesiredDeliveryMediums: ["EMAIL"],
    }));
    u = r.User;
  } catch (e) {
    if ((e as Error).name === "UsernameExistsException") throw new HttpError(409, "that person already has an account");
    throw e;
  }
  if (!u?.Username) throw new HttpError(502, "Cognito did not return the new user");
  if (admin) await idp.send(new AdminAddUserToGroupCommand({ UserPoolId: pool, Username: u.Username, GroupName: "admin" }));
  return toUser(u, admin);
}

export async function setDisabled(u: PoolUser, disabled: boolean): Promise<void> {
  const input = { UserPoolId: pool, Username: u.username };
  await idp.send(disabled ? new AdminDisableUserCommand(input) : new AdminEnableUserCommand(input));
}

export async function deleteUser(u: PoolUser): Promise<void> {
  await idp.send(new AdminDeleteUserCommand({ UserPoolId: pool, Username: u.username }));
}
