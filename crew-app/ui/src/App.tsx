import { useAppApi } from '@kirocrew/app-sdk'
import { Card, CardTitle, PageHeader, StatCard } from '@kirocrew/app-sdk/ui'
import { useEffect, useState } from 'react'
import type { Snapshot } from './types'

const REFRESH_MS = 30_000

const usd = (n: number | null | undefined) =>
  typeof n === 'number' ? `$${n.toFixed(2)}` : '-'

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : 'never')

export default function Revenant() {
  const api = useAppApi()
  const [data, setData] = useState<Snapshot | null>(null)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let live = true
    const load = () =>
      api
        .get<Snapshot>('/api/apps/revenant/config')
        .then((d) => live && (setData(d ?? {}), setFailed('')))
        .catch((e: unknown) => live && setFailed(String(e)))
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [])

  const projects = data?.projects ?? []
  const cost = projects.reduce((sum, p) => sum + (p.costUsd ?? 0), 0)
  const credit = projects.reduce((sum, p) => sum + (p.creditUsd ?? 0), 0)
  const live = projects.filter((p) => p.status === 'live').length

  return (
    <>
      <PageHeader title="Revenant" subtitle="Apps built and deployed into your AWS account" />
      <div className="px-6 pb-8 overflow-y-auto flex-1 min-h-0">
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-6">
          <StatCard label="Projects" value={String(projects.length)} />
          <StatCard label="Live" value={String(live)} accent />
          <StatCard label="Cost this month" value={usd(cost)} />
          <StatCard label="Paid by credits" value={usd(credit)} />
        </div>
        <Card>
          <CardTitle>Projects</CardTitle>
          {failed || data?.error ? (
            <p className="text-sm text-red-500">{failed || data?.error}</p>
          ) : null}
          {!data ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted">
              No projects yet. Ask in chat: "build me a contract signing site". If you
              already have projects, check that the revenant-monitor schedule has its
              secrets and is running.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1.5 pr-3 font-medium">Project</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium text-right">Cost</th>
                  <th className="py-1.5 pr-3 font-medium text-right">Credits</th>
                  <th className="py-1.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-1.5 pr-3">
                      <a href={p.url} target="_blank" rel="noreferrer" className="underline">
                        {p.name}
                      </a>
                      {p.prodUrl ? (
                        <a href={p.prodUrl} target="_blank" rel="noreferrer" className="ml-2 text-muted">
                          open app
                        </a>
                      ) : null}
                    </td>
                    <td className={`py-1.5 pr-3 ${p.status === 'dead' ? 'text-red-500' : ''}`}>
                      {p.status}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{usd(p.costUsd)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{usd(p.creditUsd)}</td>
                    <td className="py-1.5 text-muted">{when(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-muted mt-3">Last checked: {when(data?.checkedAt)}</p>
        </Card>
      </div>
    </>
  )
}
