// Shapes of the Revenant API as this app uses them. Defined here because
// lib/contracts.ts is written in parallel; the README "Revenant API" section is
// the reference both sides follow.

export type ProjectStatus = 'spec' | 'building' | 'preview' | 'publishing' | 'live' | 'dead' | 'repairing'

export interface ProjectSummary {
  id: string
  name: string
  status: ProjectStatus
  url: string // the project's page in Revenant
  specUrl: string
  previewUrl?: string | null
  prodUrl?: string | null
  costUsd: number | null // month to date
  creditUsd: number | null // part of costUsd paid by AWS credits
  updatedAt: string // ISO 8601
}

// What the monitor cron stores in the app's config.json.
export interface Snapshot {
  projects?: ProjectSummary[]
  checkedAt?: string
  error?: string
}
