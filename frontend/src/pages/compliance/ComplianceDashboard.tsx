import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ShieldCheck, ShieldAlert, ShieldX, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 90 ? '#1a6b2e' : score >= 70 ? '#c25e00' : '#b33020'
  const bg    = score >= 90 ? '#e6f4ea' : score >= 70 ? '#fff3e0' : '#fdecea'

  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth="7"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize: size > 60 ? 18 : 13, color, lineHeight:1 }}>{score}%</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    compliant: { bg:'#e6f4ea', color:'#1a6b2e', label:'Compliant' },
    warning:   { bg:'#fff3e0', color:'#c25e00', label:'Warning'   },
    critical:  { bg:'#fdecea', color:'#b33020', label:'Critical'  },
  }[status] ?? { bg:'#f1f3f8', color:'#5a6282', label: status }

  return (
    <span style={{ background:cfg.bg, color:cfg.color, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, textTransform:'uppercase', letterSpacing:'0.04em' }}>
      {cfg.label}
    </span>
  )
}

function SummaryCard({ title, score, total, compliant, warning, critical, icon:Icon }: any) {
  const color = score >= 90 ? '#1a6b2e' : score >= 70 ? '#c25e00' : '#b33020'
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(5,17,76,0.08)', padding:'24px', display:'flex', gap:20, alignItems:'center', minWidth:0 }}>
      <ScoreRing score={score} size={90} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <Icon size={16} style={{ color:'#000000', opacity:0.6 }} />
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#000000' }}>{title}</span>
        </div>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
          <div><div style={{ fontSize:11, color:'#9aa0b8' }}>Total</div><div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#000000' }}>{total}</div></div>
          <div><div style={{ fontSize:11, color:'#1a6b2e' }}>Compliant</div><div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#1a6b2e' }}>{compliant}</div></div>
          <div><div style={{ fontSize:11, color:'#c25e00' }}>Warning</div><div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#c25e00' }}>{warning}</div></div>
          <div><div style={{ fontSize:11, color:'#b33020' }}>Critical</div><div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#b33020' }}>{critical}</div></div>
        </div>
      </div>
    </div>
  )
}

export default function ComplianceDashboard() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['compliance-overview'],
    queryFn: () => api.get('/driver-compliance/score/fleet').then(r => r.data),
  })
  const { data: vehicles = [] } = useQuery({ queryKey:['vehicles'], queryFn:()=>api.get('/vehicles').then(r=>r.data) })
  const { data: drivers  = [] } = useQuery({ queryKey:['drivers'],  queryFn:()=>api.get('/drivers').then(r=>r.data)  })
  const { data: incidents = [] } = useQuery({ queryKey:['incidents'], queryFn:()=>api.get('/incidents').then(r=>r.data) })

  const openIncidents    = incidents.filter((i:any) => i.status !== 'closed').length
  const pendingApprovals = incidents.filter((i:any) => ['submitted','ops_review'].includes(i.status)).length

  if (isLoading) return <div style={{ padding:40, color:'#9aa0b8', fontSize:13 }}>Loading compliance data...</div>

  const vData = overview?.vehicles ?? {}
  const dData = overview?.drivers  ?? {}
  const overallScore = overview ? Math.round((vData.fleet_score + dData.driver_score) / 2) : 0

  return (
    <div style={{ padding:'24px 28px 40px', width:'100%', boxSizing:'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'#000000', letterSpacing:'-0.02em', margin:'0 0 4px' }}>
          Compliance Dashboard
        </h1>
        <p style={{ fontSize:12, color:'#9aa0b8', margin:0 }}>Fleet and driver compliance overview — Quattro Co Ltd</p>
      </div>

      {/* Overall score banner */}
      <div style={{ background:'#000000', borderRadius:14, padding:'20px 28px', marginBottom:16, display:'flex', alignItems:'center', gap:24 }}>
        <ScoreRing score={overallScore} size={80} />
        <div>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.45)', margin:'0 0 4px' }}>Overall compliance score</p>
          <p style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:700, color: overallScore >= 90 ? '#4ade80' : overallScore >= 70 ? '#fbbf24' : '#f87171', margin:0 }}>
            {overallScore >= 90 ? 'Compliant' : overallScore >= 70 ? 'Needs attention' : 'Non-compliant'}
          </p>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.35)', margin:'4px 0 0' }}>
            {vData.total_vehicles} vehicles · {dData.total_drivers} drivers tracked
          </p>
        </div>
        <div style={{ flex:1 }}/>
        <div style={{ display:'flex', gap:16 }}>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.45)', margin:'0 0 2px' }}>Open incidents</p>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color: openIncidents > 0 ? '#f87171' : '#4ade80', margin:0 }}>{openIncidents}</p>
          </div>
          <div style={{ width:1, background:'rgba(255,255,255,0.1)' }}/>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.45)', margin:'0 0 2px' }}>Pending approval</p>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color: pendingApprovals > 0 ? '#fbbf24' : '#4ade80', margin:0 }}>{pendingApprovals}</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12, marginBottom:16 }}>
        <SummaryCard
          title="Vehicle compliance"
          score={vData.fleet_score ?? 0}
          total={vData.total_vehicles ?? 0}
          compliant={vData.compliant ?? 0}
          warning={vData.warning ?? 0}
          critical={vData.critical ?? 0}
          icon={ShieldCheck}
        />
        <SummaryCard
          title="Driver compliance"
          score={dData.driver_score ?? 0}
          total={dData.total_drivers ?? 0}
          compliant={dData.compliant ?? 0}
          warning={dData.warning ?? 0}
          critical={dData.critical ?? 0}
          icon={ShieldCheck}
        />
      </div>

      {/* Incidents pending action */}
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(5,17,76,0.08)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px 14px', borderBottom:'1px solid rgba(5,17,76,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <AlertTriangle size={15} style={{ color:'#c25e00' }}/>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#000000', margin:0 }}>
            Incidents requiring action
          </h2>
          {pendingApprovals > 0 && (
            <span style={{ background:'#fdecea', color:'#b33020', fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20 }}>
              {pendingApprovals} pending
            </span>
          )}
        </div>

        {incidents.filter((i:any) => i.status !== 'closed').length === 0 ? (
          <div style={{ padding:'36px', textAlign:'center' }}>
            <CheckCircle size={32} style={{ color:'#1a6b2e', margin:'0 auto 8px', display:'block' }}/>
            <p style={{ fontSize:13, color:'#9aa0b8', margin:0 }}>No open incidents</p>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
              <thead>
                <tr style={{ background:'#F7F6F3' }}>
                  {['Type','Severity','Status','Vehicle','Date'].map(h => (
                    <th key={h} style={{ padding:'8px 14px', fontSize:10, fontWeight:600, color:'#9aa0b8', letterSpacing:'0.06em', textTransform:'uppercase', textAlign:'left', borderBottom:'1px solid rgba(5,17,76,0.06)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.filter((i:any) => i.status !== 'closed').map((i:any) => (
                  <tr key={i.id} style={{ borderBottom:'1px solid rgba(5,17,76,0.04)' }}>
                    <td style={{ padding:'10px 14px', fontSize:12, fontWeight:500, color:'#000000', textTransform:'capitalize' }}>{i.incident_type.replace(/_/g,' ')}</td>
                    <td style={{ padding:'10px 14px', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em',
                      color: i.severity==='critical'?'#b33020':i.severity==='high'?'#c25e00':i.severity==='medium'?'#2044b0':'#1a6b2e' }}>
                      {i.severity}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <StatusBadge status={i.status.replace(/_/g,' ')} />
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#9aa0b8' }}>{i.vehicle_id?.slice(0,8) ?? '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'#9aa0b8', whiteSpace:'nowrap' }}>
                      {new Date(i.event_datetime).toLocaleDateString('en-ZM',{day:'numeric',month:'short',year:'numeric'})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
