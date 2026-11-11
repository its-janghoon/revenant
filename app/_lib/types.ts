// Answers of the screens lane's own routes, shared by route handlers and client components.
import type { Deploy, Preview, Project, Repair, Run, Settings, Task, TimelineEvent } from "@/lib/contracts";

export interface ProjectCard extends Project {
  costUsd: number;
  creditUsd: number;
  kiroCredits: number;
  tasksDone: number;
  tasksTotal: number;
  previews: number;
  repairAttempt: number | null; // running repair attempt
}

export interface Detail {
  project: Project;
  branch: string; // work branch: newest live preview, else rv/spec
  previewUrl: string | null;
  runs: Run[];
  tasks: Task[];
  deploys: Deploy[];
  previews: Preview[];
  repairs: Repair[];
  costUsd: number;
  creditUsd: number;
  kiroCredits: number;
  region: string;
  sqlAllowed: boolean;
}

export interface Me { sub: string; email: string; name: string; admin: boolean; onboarded: boolean }

export interface SettingsView {
  settings: Settings;
  sqlAllowed: boolean;
  ownKey: { set: boolean; updatedAt: string | null };
  companyKey: boolean;
  account: string;
  region: string;
}

export interface FileNode { type: "folder"; commit: string; path: string; folders: string[]; files: string[] }
export interface FileBody { type: "file"; commit: string; path: string; content: string; before?: string | null }

export interface SpecView {
  branch: string;
  commit: string | null;
  requirements: string | null;
  design: string | null;
  tasks: string | null;
  summary: string[]; // plain sentences for the user
  parts: { part: string; service: string; cost: string | null }[];
  totalUsd: string | null;
}

export type { TimelineEvent };

/** Message protocol between the Studio and the Select-mode script in preview builds. */
export type InspectIn = { type: "rv:inspect"; on: boolean };
export type InspectOut = {
  type: "rv:select";
  file: string;
  line: number;
  label: string; // e.g. "Button"
  text?: string;
  rect: { x: number; y: number; w: number; h: number }; // iframe viewport pixels
};
