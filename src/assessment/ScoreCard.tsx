import { ASMT_CFG, SUBSTANCES, suRisk, suScore, usedSubs, type AsmtResult, type AsmtState } from './engine'

/**
 * A13 from the prototype: the composite score and band. STAFF VIEW ONLY. The child never
 * sees this card; CounsellorChat renders it only while the 🛠 panel's Staff view is on.
 */
const SEGMENTS = [
  { k: 'body', label: 'body', color: '#26C6C6' },
  { k: 'sleep', label: 'sleep', color: '#378ADD' },
  { k: 'appetite', label: 'appetite', color: '#1D9E75' },
  { k: 'mood', label: 'mood', color: '#EF9F27' },
  { k: 'worry', label: 'worry', color: '#9B6EE0' },
] as const
const CS_LABEL = ['none', 'low', 'moderate', 'high']
const RISK = ['low', 'moderate', 'high']

export default function ScoreCard({ result, state }: { result: AsmtResult; state: AsmtState }) {
  const { bandNames, bandColors, bandPct, totalMax } = ASMT_CFG
  const cuts = bandPct.map((p) => Math.ceil((totalMax * p) / 100))
  const ranges = [
    [0, cuts[0] - 1],
    [cuts[0], cuts[1] - 1],
    [cuts[1], cuts[2] - 1],
    [cuts[2], totalMax],
  ]
  const used = usedSubs(state)
  const name = (id: string) => SUBSTANCES.find((s) => s.id === id)?.id ?? id

  return (
    <div className="asmt-score">
      <div className="asmt-score-note">Staff view only · the student never sees this card</div>
      <div className="asmt-score-total">{result.total}</div>
      <div className="asmt-score-sub">
        total score out of {totalMax} · {result.pct}%
      </div>
      <div className="asmt-score-bar">
        {SEGMENTS.map((sg) => (
          <div key={sg.k} style={{ flex: result.parts[sg.k] || 0.2, background: sg.color }} />
        ))}
      </div>
      <div className="asmt-score-legend">
        {SEGMENTS.map((sg) => (
          <span key={sg.k}>
            {sg.label} {result.parts[sg.k]}
          </span>
        ))}
      </div>

      <div className="asmt-band" style={{ background: bandColors[result.band] }}>
        <span>Band assigned silently</span>
        <b>{bandNames[result.band]}</b>
      </div>

      <div className="asmt-score-rows">
        <div>
          Score band from the total: <b>{bandNames[result.baseBand]}</b>
        </div>
        <div>Overrides: {result.why.length ? result.why.join('; ') : 'none'}</div>
        <div>
          Suicide screen (C-SSRS) risk: <b>{CS_LABEL[result.csEscalated]}</b>
          {result.csEscalated !== result.csRisk && ' (raised one level: substance use to cope)'}
        </div>
        {result.incomplete && <div>Some scored answers were "rather not say" and counted as 0.</div>}
      </div>

      <table className="asmt-score-table">
        <thead>
          <tr>
            <th>Band</th>
            <th>Percent</th>
            <th>Raw /{totalMax}</th>
          </tr>
        </thead>
        <tbody>
          {bandNames.map((n, i) => (
            <tr key={n} className={i === result.band ? 'on' : ''}>
              <td style={{ color: bandColors[i] }}>{n}</td>
              <td>
                {i === 0 ? `< ${bandPct[0]}%` : i === 3 ? `≥ ${bandPct[2]}%` : `${bandPct[i - 1]}–${bandPct[i] - 1}%`}
              </td>
              <td>
                {ranges[i][0]}–{ranges[i][1]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {used.length > 0 && (
        <table className="asmt-score-table">
          <thead>
            <tr>
              <th>Substance</th>
              <th>Score</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {used.map((id) => (
              <tr key={id}>
                <td>{name(id)}</td>
                <td>{suScore(state, id)}</td>
                <td>{RISK[suRisk(state, id)]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {state.flags.length > 0 && (
        <div className="asmt-score-rows">
          <b>Flags raised</b>
          {state.flags.map((f) => (
            <div key={f.code}>
              <span className={`asmt-flag asmt-flag-${f.level}`}>{f.level}</span> {f.code}: {f.note}
            </div>
          ))}
        </div>
      )}

      <div className="asmt-score-note">
        Cut-points are illustrative{ASMT_CFG.assistPlaceholder ? ' and substance scoring uses placeholder adult ASSIST weights' : ''}. The
        clinical team sets them in src/assessment/engine.ts.
      </div>
    </div>
  )
}
