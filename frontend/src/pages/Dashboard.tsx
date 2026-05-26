import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Truck, Users, Zap, AlertTriangle, ArrowUpRight, Clock } from 'lucide-react'

function StatCard({ label, value, icon:Icon, accent, delay }: { label:string; value:number; icon:any; accent:string; delay:string }) {
  return (
    <div className={`fade-up ${delay}`} style={{
      background:'#fff', border:'1px solid rgba(5,17,76,0.08)',
      borderRadius:16, padding:'24px 20px 20px',
      display:'flex', flexDirection:'column', gap:14,
      position:'relative', overflow:'hidden', minWidth:0,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:accent, borderRadius:'16px 16px 0 0' }}/>
      <div style={{ width:40, height:40, borderRadius:10, background:`${accent}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={18} style={{ color:accent }} />
      </div>
      <div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:700, color:'#000000', lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:12, color:'#9aa0b8', marginTop:5 }}>{label}</div>
      </div>
    </div>
  )
}

function statusBadge(status: string) {
  return <span className={`badge badge-${status}`}>{status.replace(/_/g,' ')}</span>
}

export default function Dashboard() {
  const { data: vehicles=[] }    = useQuery({ queryKey:['vehicles'],     queryFn:()=>api.get('/vehicles').then(r=>r.data) })
  const { data: drivers=[] }     = useQuery({ queryKey:['drivers'],      queryFn:()=>api.get('/drivers').then(r=>r.data) })
  const { data: speedEvents=[] } = useQuery({ queryKey:['speed-events'], queryFn:()=>api.get('/speed-events').then(r=>r.data) })
  const { data: incidents=[] }   = useQuery({ queryKey:['incidents'],    queryFn:()=>api.get('/incidents').then(r=>r.data) })

  const activeVehicles = vehicles.filter((v:any)=>v.status==='active').length
  const activeDrivers  = drivers.filter((d:any)=>d.status==='active').length
  const openEvents     = speedEvents.filter((e:any)=>['flagged','in_review'].includes(e.status)).length
  const openIncidents  = incidents.filter((i:any)=>i.status==='open').length
  const recentEvents   = [...speedEvents].sort((a:any,b:any)=>new Date(b.event_datetime).getTime()-new Date(a.event_datetime).getTime()).slice(0,8)

  const now = new Date()
  const greeting = now.getHours()<12 ? 'Good morning' : now.getHours()<17 ? 'Good afternoon' : 'Good evening'

  const thStyle: React.CSSProperties = {
    padding:'9px 16px', fontSize:10, fontWeight:600,
    color:'#9aa0b8', letterSpacing:'0.06em', textTransform:'uppercase',
    textAlign:'left', borderBottom:'1px solid rgba(5,17,76,0.06)', whiteSpace:'nowrap',
  }

  return (
    <div style={{ padding:'28px 28px 40px', width:'100%', boxSizing:'border-box' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom:28, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
        <div>
          <p style={{ fontSize:12, color:'#9aa0b8', margin:'0 0 4px' }}>{greeting}</p>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(20px,2.5vw,26px)', fontWeight:700, color:'#000000', letterSpacing:'-0.02em', margin:'0 0 4px' }}>
            Fleet Overview
          </h1>
          <p style={{ fontSize:12, color:'#9aa0b8', margin:0 }}>FQM Trident Mine · Kalumbila</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#9aa0b8', background:'#fff', border:'1px solid rgba(5,17,76,0.08)', borderRadius:8, padding:'6px 12px', flexShrink:0 }}>
          <Clock size={13}/>
          {now.toLocaleDateString('en-ZM',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:14, marginBottom:16 }}>
        <StatCard label="Active vehicles"   value={activeVehicles} icon={Truck}         accent="#000000" delay="fade-up-1" />
        <StatCard label="Active drivers"    value={activeDrivers}  icon={Users}         accent="#D97757" delay="fade-up-2" />
        <StatCard label="Open speed events" value={openEvents}     icon={Zap}           accent="#e6a817" delay="fade-up-3" />
        <StatCard label="Open incidents"    value={openIncidents}  icon={AlertTriangle} accent="#c0392b" delay="fade-up-4" />
      </div>

      {/* Tables */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:14, marginBottom:14 }}>

        {/* Speed events */}
        <div className="fade-up fade-up-2" style={{ background:'#fff', borderRadius:16, border:'1px solid rgba(5,17,76,0.08)', overflow:'hidden', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px 14px', borderBottom:'1px solid rgba(5,17,76,0.06)' }}>
            <div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#000000', margin:0 }}>Speed events</h2>
              <p style={{ fontSize:11, color:'#9aa0b8', margin:'3px 0 0' }}>Recent GPS flags</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#D97757', fontWeight:500, cursor:'pointer', flexShrink:0 }}>
              View all <ArrowUpRight size={12}/>
            </div>
          </div>
          {recentEvents.length===0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#9aa0b8', fontSize:13 }}>No speed events logged yet</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:300 }}>
                <thead><tr style={{ background:'#F7F6F3' }}>
                  {['Vehicle','Speed','Date','Status'].map(h=><th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {recentEvents.map((e:any)=>(
                    <tr key={e.id} style={{ borderBottom:'1px solid rgba(5,17,76,0.04)' }}>
                      <td style={{ padding:'11px 16px', fontSize:13, fontWeight:500, color:'#000000' }}>{e.vehicle_id?.slice(0,8)}</td>
                      <td style={{ padding:'11px 16px', fontSize:13, fontWeight:600, color:'#D97757', whiteSpace:'nowrap' }}>
                        {e.recorded_speed} <span style={{ fontWeight:400, color:'#9aa0b8', fontSize:11 }}>km/h</span>
                      </td>
                      <td style={{ padding:'11px 16px', fontSize:12, color:'#9aa0b8', whiteSpace:'nowrap' }}>
                        {new Date(e.event_datetime).toLocaleDateString('en-ZM',{day:'numeric',month:'short'})}
                      </td>
                      <td style={{ padding:'11px 16px' }}>{statusBadge(e.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Incidents */}
        <div className="fade-up fade-up-3" style={{ background:'#fff', borderRadius:16, border:'1px solid rgba(5,17,76,0.08)', overflow:'hidden', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px 14px', borderBottom:'1px solid rgba(5,17,76,0.06)' }}>
            <div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#000000', margin:0 }}>Incidents</h2>
              <p style={{ fontSize:11, color:'#9aa0b8', margin:'3px 0 0' }}>Active incident log</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#D97757', fontWeight:500, cursor:'pointer', flexShrink:0 }}>
              View all <ArrowUpRight size={12}/>
            </div>
          </div>
          {incidents.length===0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#9aa0b8', fontSize:13 }}>No incidents recorded yet</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:300 }}>
                <thead><tr style={{ background:'#F7F6F3' }}>
                  {['Type','Severity','Date','Status'].map(h=><th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {incidents.slice(0,8).map((i:any)=>(
                    <tr key={i.id} style={{ borderBottom:'1px solid rgba(5,17,76,0.04)' }}>
                      <td style={{ padding:'11px 16px', fontSize:13, fontWeight:500, color:'#000000', textTransform:'capitalize' }}>{i.incident_type.replace(/_/g,' ')}</td>
                      <td style={{ padding:'11px 16px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap',
                        color:i.severity==='critical'?'#b33020':i.severity==='high'?'#c25e00':i.severity==='medium'?'#2044b0':'#1a6b2e' }}>
                        {i.severity}
                      </td>
                      <td style={{ padding:'11px 16px', fontSize:12, color:'#9aa0b8', whiteSpace:'nowrap' }}>
                        {new Date(i.event_datetime).toLocaleDateString('en-ZM',{day:'numeric',month:'short'})}
                      </td>
                      <td style={{ padding:'11px 16px' }}>{statusBadge(i.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fleet strip */}
      <div className="fade-up fade-up-4" style={{ background:'#000000', borderRadius:16, padding:'20px 28px', display:'flex', alignItems:'center', flexWrap:'wrap', gap:0, overflowX:'auto' }}>
        {[
          { label:'Total fleet', value:vehicles.length,                                            orange:false },
          { label:'Active',      value:activeVehicles,                                             orange:true  },
          { label:'Grounded',    value:vehicles.filter((v:any)=>v.status==='grounded').length,     orange:false },
          { label:'Maintenance', value:vehicles.filter((v:any)=>v.status==='maintenance').length,  orange:false },
        ].map((item,i) => (
          <div key={item.label} style={{ display:'flex', alignItems:'center' }}>
            {i>0 && <div style={{ width:1, height:32, background:'rgba(255,255,255,0.1)', margin:'0 20px' }}/>}
            <div>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(255,255,255,0.45)', margin:'0 0 3px', whiteSpace:'nowrap' }}>{item.label}</p>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:700, color:item.orange?'#D97757':'#fff', lineHeight:1, margin:0 }}>{item.value}</p>
            </div>
          </div>
        ))}
        <div style={{ flex:1, minWidth:16 }}/>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', whiteSpace:'nowrap' }}>Fleet status · live</div>
      </div>

    </div>
  )
}