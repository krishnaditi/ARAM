import { useSession } from '../state/sessionStore'
import { MERGED_IDS, taxStats, validateTaxonomy } from '../data/clusters'

/**
 * The prototype's review harness — branch logic, DB reads/writes, taxonomy counts,
 * integrity check, audit log, and the staff-flag / instant-typing toggles.
 *
 * Never shown to a child: it is only reachable in a dev build or while the app is
 * running on the local mock, via the 🛠 button in the chat header.
 */

export interface DevRow {
  k: string
  v: string
}
export interface DevTrigger {
  c: string
  a: string
}
export interface DevInfo {
  screenId: string
  screenPos: string
  branch: DevTrigger[]
  inputs: DevRow[]
  outputs: DevRow[]
  triggers: DevTrigger[]
  note?: string
}

export default function SessionDevPanel({ dev, onClose }: { dev: DevInfo; onClose: () => void }) {
  const staffView = useSession((s) => s.staffView)
  const instant = useSession((s) => s.instant)
  const toggleStaffView = useSession((s) => s.toggleStaffView)
  const toggleInstant = useSession((s) => s.toggleInstant)
  const auditLog = useSession((s) => s.auditLog)

  const st = taxStats()
  const vt = validateTaxonomy()
  const ok = vt.dupes.length === 0 && vt.broken.length === 0 && vt.canonical === st.items

  return (
    <div className="dev-drawer" role="dialog" aria-label="Review tools">
      <div className="dev-drawer-head">
        <div>
          <span className="dev-drawer-id">{dev.screenId}</span> {dev.screenPos}
        </div>
        <button type="button" className="dev-drawer-x" onClick={onClose} aria-label="Close review tools">
          ✕
        </button>
      </div>

      <div className="dev-drawer-body">
        <div className="dev-ctrls">
          <button type="button" className={`ctrl${staffView ? ' on' : ''}`} onClick={toggleStaffView}>
            👁 Staff flags{staffView ? ' ON' : ''}
          </button>
          <button type="button" className={`ctrl${instant ? ' on' : ''}`} onClick={toggleInstant}>
            ⏩ Instant{instant ? ' ON' : ''}
          </button>
        </div>

        <Card dot="#EF9F27" title="Branch logic">
          {dev.branch.map((r, i) => (
            <div className="branch-row" key={i}>
              <span className="branch-cond">{r.c}</span>
              <span className="branch-arr">→</span>
              <span className="branch-dest">{r.a}</span>
            </div>
          ))}
        </Card>

        <Card dot="#378ADD" title="Inputs">
          {dev.inputs.length ? (
            dev.inputs.map((r, i) => <Row key={i} k={r.k} v={r.v} />)
          ) : (
            <div className="dev-note">No DB reads</div>
          )}
        </Card>

        <Card dot="#1D9E75" title="Outputs">
          {dev.outputs.length ? (
            dev.outputs.map((r, i) => <Row key={i} k={r.k} v={r.v} mono />)
          ) : (
            <div className="dev-note">No DB writes yet</div>
          )}
        </Card>

        <Card dot="#E24B4A" title="Branch triggers">
          {dev.triggers.length ? (
            dev.triggers.map((r, i) => (
              <div className="dev-tr" key={i}>
                <div className="dev-tc">{r.c}</div>
                <div className="dev-ta">→ {r.a}</div>
              </div>
            ))
          ) : (
            <div className="dev-note">Linear screen</div>
          )}
          {dev.note && <div className="dev-note">{dev.note}</div>}
        </Card>

        <Card dot="#EF9F27" title="Taxonomy · v4">
          <div className="dev-stat">
            <Stat n={st.clusters} label="clusters" />
            <Stat n={st.subs} label="sub-clusters" />
            <Stat n={st.items} label="canonical items" />
            <Stat n={st.placements} label="placements" color="#85B7EB" />
            <Stat n={st.red} label="red" color="#F09595" />
            <Stat n={st.amber} label="amber" color="#FAC775" />
          </div>
          <div className="dev-note">
            <b>
              Denominator for every rate is {st.items}, never {st.placements}.
            </b>{' '}
            Content is byte-identical to the v4 prototype. Only presentation changed.
          </div>
        </Card>

        <Card dot={ok ? '#1D9E75' : '#E24B4A'} title="Analysis integrity">
          <Row k="canonical ids" v={`${vt.canonical} · each defined exactly once`} />
          <Row k="duplicate ids" v={vt.dupes.length ? vt.dupes.join(', ') : 'none'} />
          <Row k="broken xrefs" v={vt.broken.length ? vt.broken.join(', ') : 'none'} />
          <Row
            k="retired ids"
            v={Object.keys(MERGED_IDS)
              .map((k) => `${k}→${MERGED_IDS[k]}`)
              .join(' · ')}
          />
          <div className="dev-note">
            canonicalId() maps retired ids forward, so historic CLUSTER_FLAG rows stay comparable.
          </div>
        </Card>

        {auditLog.length > 0 && (
          <Card dot="#9B6EE0" title={`Audit log (${auditLog.length})`}>
            {auditLog.slice(-10).map((e, i) => (
              <div className="dev-tr" key={i}>
                <div className="dev-tc" style={{ color: '#9B6EE0' }}>
                  {e.type}
                </div>
                <div className="dev-ta">{e.detail}</div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}

function Card({ dot, title, children }: { dot: string; title: string; children: React.ReactNode }) {
  return (
    <div className="dev-card">
      <div className="dev-head">
        <div className="dev-dot" style={{ background: dot }} />
        <div className="dev-head-title">{title}</div>
      </div>
      <div className="dev-body">{children}</div>
    </div>
  )
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="dev-row">
      <div className="dev-k">{mono ? <code>{k}</code> : k}</div>
      <div className="dev-v">{v}</div>
    </div>
  )
}

function Stat({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <div className="dev-stat-i">
      <div className="dev-stat-n" style={color ? { color } : undefined}>
        {n}
      </div>
      {label}
    </div>
  )
}
