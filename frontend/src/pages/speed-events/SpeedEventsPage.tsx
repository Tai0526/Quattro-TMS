import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import {
  Zap, X, Search, MapPin, Clock, Truck, User,
  AlertTriangle, ChevronRight, CheckCircle, ArrowUpRight,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'

interface SpeedEvent {
  id: string
  vehicle_id: string
  driver_id: string | null
  event_datetime: string
  recorded_speed: number
  speed_limit: number
  location_description: string | null
  tracker_source: string
  tracker_event_id: string | null
  status: string
  dispute_narrative: string | null
  incident_id: string | null
  logged_at: string
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  flagged:   { bg: '#f1f3f8', color: '#5a6282', label: 'Flagged'   },
  in_review: { bg: '#fff3e0', color: '#c25e00', label: 'In review' },
  disputed:  { bg: '#e8eeff', color: '#2044b0', label: 'Disputed'  },
  confirmed: { bg: '#fdecea', color: '#b33020', label: 'Confirmed' },
  closed:    { bg: '#e6f4ea', color: '#1a6b2e', label: 'Closed'    },
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { bg: '#f1f3f8', color: '#5a6282', label: status }
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  )
}

function getSeverity(excess: number): { label: string; color: string; bg: string } {
  if (excess <= 9)  return { label: 'Minor',    color: '#e6a817', bg: '#fef9e7' }
  if (excess <= 14) return { label: 'Moderate', color: '#c25e00', bg: '#fff3e0' }
  return                   { label: 'Severe',   color: '#b33020', bg: '#fdecea' }
}

function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(5,17,76,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(5,17,76,0.1)' }}>
      <div style={{ fontWeight: 600, color: '#000000', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────
function DetailPanel({ event, onClose, vehicles, drivers }: {
  event: SpeedEvent; onClose: () => void; vehicles: any[]; drivers: any[]
}) {
  const qc = useQueryClient()
  const [narrative, setNarrative] = useState(event.dispute_narrative ?? '')
  const [newStatus, setNewStatus] = useState(event.status)
  const [busy, setBusy] = useState(false)
  const [savedStatus, setSavedStatus] = useState(event.status)

  const vehicle   = vehicles.find(v => v.id === event.vehicle_id)
  const driver    = drivers.find(d => d.id === event.driver_id)
  const over      = event.recorded_speed - event.speed_limit
  const pct       = Math.round((over / event.speed_limit) * 100)
  const overColor = pct > 40 ? '#b33020' : pct > 20 ? '#c25e00' : '#e6a817'
  const sev       = getSeverity(over)

  async function save() {
    setBusy(true)
    try {
      await api.patch(`/speed-events/${event.id}`, { status: newStatus, dispute_narrative: narrative || undefined })
      setSavedStatus(newStatus)
      await qc.invalidateQueries({ queryKey: ['speed-events'] })
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }

  async function escalate() {
    if (!confirm('Escalate to a formal incident?')) return
    setBusy(true)
    try {
      await api.post(`/speed-events/${event.id}/escalate`)
      await qc.invalidateQueries({ queryKey: ['speed-events'] })
      await qc.invalidateQueries({ queryKey: ['incidents'] })
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }

  const isConfirmed = event.status === 'confirmed' || savedStatus === 'confirmed'
  const STEPS = ['flagged', 'in_review', 'disputed', 'confirmed', 'closed']
  const idx   = STEPS.indexOf(event.status)

  return (
    <div style={{ width: 400, flexShrink: 0, background: '#fff', borderLeft: '1px solid rgba(5,17,76,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(5,17,76,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <StatusPill status={event.status} />
            <span style={{ fontSize: 10, fontWeight: 600, color: sev.color, background: sev.bg, padding: '2px 8px', borderRadius: 20 }}>{sev.label}</span>
          </div>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: '#000000', margin: '0 0 3px' }}>Speed event</h3>
          <p style={{ fontSize: 11, color: '#9aa0b8', margin: 0 }}>{event.tracker_source} · {event.tracker_event_id ?? 'No ref'}</p>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(5,17,76,0.05)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={14} color="#000000" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          {STEPS.map((step, i) => {
            const done = i < idx, current = i === idx
            const color = done ? '#1a6b2e' : current ? '#000000' : '#e0e3ef'
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {done ? <CheckCircle size={11} color="#fff" /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: current ? '#fff' : 'rgba(255,255,255,0.4)' }} />}
                  </div>
                  <span style={{ fontSize: 9, color: current || done ? '#000000' : '#9aa0b8', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{step.replace('_', ' ')}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < idx ? '#1a6b2e' : '#e0e3ef', margin: '0 3px', marginBottom: 16 }} />}
              </div>
            )
          })}
        </div>

        <div style={{ background: '#000000', borderRadius: 12, padding: '20px', marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recorded speed</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 52, fontWeight: 800, color: pct > 40 ? '#f87171' : pct > 20 ? '#fbbf24' : '#fcd34d', lineHeight: 1 }}>{event.recorded_speed}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>km/h</div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {[
              { label: 'Limit',   value: `${event.speed_limit}`,    color: 'rgba(255,255,255,0.7)' },
              { label: 'Over by', value: `${over.toFixed(0)} km/h`, color: overColor },
              { label: 'Excess',  value: `${pct}%`,                 color: overColor },
            ].map((item, i) => (
              <>
                {i > 0 && <div key={`d${i}`} style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />}
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{item.label}</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              </>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          {[
            { icon: Truck,  label: 'Vehicle',   value: vehicle ? `${vehicle.reg_plate} — ${vehicle.make}` : event.vehicle_id.slice(0, 8) },
            { icon: User,   label: 'Driver',    value: driver ? driver.full_name : event.driver_id?.slice(0, 8) ?? '—' },
            { icon: MapPin, label: 'Location',  value: event.location_description ?? 'No location' },
            { icon: Clock,  label: 'Date/time', value: new Date(event.event_datetime).toLocaleDateString('en-ZM', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ background: '#F7F6F3', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <Icon size={11} style={{ color: '#9aa0b8' }} />
                <span style={{ fontSize: 9, color: '#9aa0b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#000000', wordBreak: 'break-word' }}>{value}</div>
            </div>
          ))}
        </div>

        {event.incident_id && (
          <div style={{ background: '#e6f4ea', borderRadius: 8, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={14} style={{ color: '#1a6b2e', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a6b2e' }}>Escalated to incident</div>
              <div style={{ fontSize: 11, color: '#1a6b2e', opacity: 0.7, marginTop: 1 }}>{event.incident_id.slice(0, 8)}</div>
            </div>
          </div>
        )}

        {event.status !== 'closed' && !event.incident_id && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Update status</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {STEPS.filter(s => s !== 'closed').map(s => (
                <button key={s} onClick={() => setNewStatus(s)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${newStatus === s ? STATUS_CFG[s]?.color ?? '#000000' : 'rgba(5,17,76,0.12)'}`, background: newStatus === s ? (STATUS_CFG[s]?.bg ?? '#f1f3f8') : 'transparent', color: newStatus === s ? (STATUS_CFG[s]?.color ?? '#000000') : '#9aa0b8', fontSize: 11, fontWeight: newStatus === s ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.15s' }}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 5 }}>
                Dispute narrative {newStatus === 'disputed' && <span style={{ color: '#b33020' }}>*</span>}
              </label>
              <textarea value={narrative} onChange={e => setNarrative(e.target.value)}
                placeholder="Document the basis for dispute..."
                style={{ width: '100%', minHeight: 80, border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 9, padding: '10px 12px', fontSize: 13, color: '#000000', fontFamily: "'DM Sans',sans-serif", resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={save} disabled={busy}
              style={{ width: '100%', height: 40, background: '#000000', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer', opacity: busy ? 0.6 : 1, marginBottom: 8 }}>
              {busy ? 'Saving...' : 'Save changes'}
            </button>
            {isConfirmed && (
              <button onClick={escalate} disabled={busy}
                style={{ width: '100%', height: 40, background: '#b33020', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
                <ArrowUpRight size={14} /> Escalate to incident
              </button>
            )}
            {!isConfirmed && newStatus === 'confirmed' && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: '#fff3e0', borderRadius: 8, fontSize: 12, color: '#c25e00' }}>
                Save first to enable escalation.
              </div>
            )}
          </div>
        )}

        {event.dispute_narrative && event.status === 'closed' && (
          <div style={{ background: '#e8eeff', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#2044b0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Dispute narrative</div>
            <div style={{ fontSize: 13, color: '#2044b0', lineHeight: 1.6 }}>{event.dispute_narrative}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Events tab ────────────────────────────────────────────────────────
function EventsTab({ events, vehicles, drivers, isLoading }: {
  events: SpeedEvent[]; vehicles: any[]; drivers: any[]; isLoading: boolean
}) {
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [newForm, setNewForm] = useState({
    vehicle_id: '', driver_id: '', event_datetime: '',
    recorded_speed: '', speed_limit: '80',
    location_description: '', tracker_source: 'Geotab', tracker_event_id: ''
  })
  const qc = useQueryClient()

  const selected = selectedId ? events.find(e => e.id === selectedId) ?? null : null

  const filtered = [...events]
    .filter(e => {
      const matchSearch = !search || e.location_description?.toLowerCase().includes(search.toLowerCase()) || e.tracker_event_id?.includes(search)
      const matchStatus = !filterStatus || e.status === filterStatus
      return matchSearch && matchStatus
    })
    .sort((a, b) => new Date(b.event_datetime).getTime() - new Date(a.event_datetime).getTime())

  const counts = {
    total:     events.length,
    flagged:   events.filter(e => e.status === 'flagged').length,
    disputed:  events.filter(e => e.status === 'disputed').length,
    confirmed: events.filter(e => e.status === 'confirmed').length,
    closed:    events.filter(e => e.status === 'closed').length,
  }

  async function createEvent() {
    try {
      await api.post('/speed-events', {
        ...newForm,
        recorded_speed: parseFloat(newForm.recorded_speed),
        speed_limit:    parseFloat(newForm.speed_limit),
        event_datetime: new Date(newForm.event_datetime).toISOString(),
      })
      qc.invalidateQueries({ queryKey: ['speed-events'] })
      setShowCreate(false)
      setNewForm({ vehicle_id: '', driver_id: '', event_datetime: '', recorded_speed: '', speed_limit: '80', location_description: '', tracker_source: 'Geotab', tracker_event_id: '' })
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40, border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 9,
    padding: '0 12px', fontSize: 13, color: '#000000', background: '#fff', outline: 'none',
    fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 5 }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ padding: '0 24px 14px', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Total',     value: counts.total,     color: '#000000', bg: 'rgba(5,17,76,0.05)', key: '' },
              { label: 'Flagged',   value: counts.flagged,   color: '#5a6282', bg: '#f1f3f8',            key: 'flagged' },
              { label: 'Disputed',  value: counts.disputed,  color: '#2044b0', bg: '#e8eeff',            key: 'disputed' },
              { label: 'Confirmed', value: counts.confirmed, color: '#b33020', bg: '#fdecea',            key: 'confirmed' },
              { label: 'Closed',    value: counts.closed,    color: '#1a6b2e', bg: '#e6f4ea',            key: 'closed' },
            ].map(s => (
              <div key={s.label}
                style={{ background: s.bg, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', outline: filterStatus === s.key && s.key ? `2px solid ${s.color}` : 'none' }}
                onClick={() => setFilterStatus(filterStatus === s.key ? '' : s.key)}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: s.color, opacity: 0.7, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', height: 36 }}>
              <Search size={13} style={{ color: '#9aa0b8', flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search location or event ID..."
                style={{ border: 'none', outline: 'none', fontSize: 13, color: '#000000', background: 'transparent', width: '100%', fontFamily: "'DM Sans',sans-serif" }} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ height: 36, border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#000000', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}>
              <option value="">All statuses</option>
              <option value="flagged">Flagged</option>
              <option value="in_review">In review</option>
              <option value="disputed">Disputed</option>
              <option value="confirmed">Confirmed</option>
              <option value="closed">Closed</option>
            </select>
            <button onClick={() => setShowCreate(true)}
              style={{ height: 36, background: '#D97757', color: '#fff', border: 'none', borderRadius: 9, padding: '0 16px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer' }}>
              + Log event
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0b8', fontSize: 13 }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <Zap size={28} style={{ color: '#9aa0b8', margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: '#9aa0b8', margin: 0 }}>No speed events found</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F6F3' }}>
                    {['Vehicle','Driver','Speed','Limit','Excess','Severity','Location','Date','Status',''].map(h => (
                      <th key={h} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 600, color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(5,17,76,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const isSelected = selectedId === e.id
                    const vehicle    = vehicles.find(v => v.id === e.vehicle_id)
                    const driver     = drivers.find(d => d.id === e.driver_id)
                    const over       = e.recorded_speed - e.speed_limit
                    const overColor  = over > 40 ? '#b33020' : over > 20 ? '#c25e00' : '#e6a817'
                    const sev        = getSeverity(over)
                    return (
                      <tr key={e.id}
                        onClick={() => setSelectedId(isSelected ? null : e.id)}
                        style={{ borderBottom: '1px solid rgba(5,17,76,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(5,17,76,0.03)' : 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={ev => { if (!isSelected)(ev.currentTarget as HTMLElement).style.background = 'rgba(5,17,76,0.02)' }}
                        onMouseLeave={ev => { if (!isSelected)(ev.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#000000', whiteSpace: 'nowrap' }}>{vehicle ? vehicle.reg_plate : e.vehicle_id.slice(0, 8)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#5a6282', whiteSpace: 'nowrap' }}>{driver ? driver.full_name.split(' ')[0] : '—'}</td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: overColor }}>{e.recorded_speed}</span>
                          <span style={{ fontSize: 10, color: '#9aa0b8', marginLeft: 3 }}>km/h</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#9aa0b8', whiteSpace: 'nowrap' }}>{e.speed_limit} km/h</td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: overColor, background: `${overColor}18`, padding: '2px 8px', borderRadius: 20 }}>+{over.toFixed(0)}</span>
                        </td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: sev.color, background: sev.bg, padding: '2px 8px', borderRadius: 20 }}>{sev.label}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#9aa0b8', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.location_description ?? '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 11, color: '#9aa0b8', whiteSpace: 'nowrap' }}>{new Date(e.event_datetime).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ padding: '11px 14px' }}><StatusPill status={e.status} /></td>
                        <td style={{ padding: '11px 14px' }}><ChevronRight size={14} style={{ color: isSelected ? '#D97757' : '#9aa0b8' }} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selected && <DetailPanel event={selected} onClose={() => setSelectedId(null)} vehicles={vehicles} drivers={drivers} />}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,17,76,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(5,17,76,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: '#000000', margin: 0 }}>Log speed event</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} color="#000000" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Vehicle <span style={{ color: '#b33020' }}>*</span></label>
                  <select value={newForm.vehicle_id} onChange={e => setNewForm(f => ({ ...f, vehicle_id: e.target.value }))} style={inputStyle}>
                    <option value="">— Select —</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.reg_plate}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Driver</label>
                  <select value={newForm.driver_id} onChange={e => setNewForm(f => ({ ...f, driver_id: e.target.value }))} style={inputStyle}>
                    <option value="">— None —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={labelStyle}>Date & time <span style={{ color: '#b33020' }}>*</span></label><input type="datetime-local" value={newForm.event_datetime} onChange={e => setNewForm(f => ({ ...f, event_datetime: e.target.value }))} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Recorded speed (km/h) <span style={{ color: '#b33020' }}>*</span></label><input type="number" value={newForm.recorded_speed} onChange={e => setNewForm(f => ({ ...f, recorded_speed: e.target.value }))} placeholder="e.g. 95" style={inputStyle} /></div>
                <div><label style={labelStyle}>Speed limit (km/h)</label><input type="number" value={newForm.speed_limit} onChange={e => setNewForm(f => ({ ...f, speed_limit: e.target.value }))} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tracker source</label>
                  <select value={newForm.tracker_source} onChange={e => setNewForm(f => ({ ...f, tracker_source: e.target.value }))} style={inputStyle}>
                    <option value="Geotab">Geotab</option>
                    <option value="AMSI">AMSI</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Tracker event ID</label><input value={newForm.tracker_event_id} onChange={e => setNewForm(f => ({ ...f, tracker_event_id: e.target.value }))} placeholder="e.g. EVT-001234" style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>Location description</label><input value={newForm.location_description} onChange={e => setNewForm(f => ({ ...f, location_description: e.target.value }))} placeholder="e.g. Kalumbila–Solwezi road, km 14" style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
                <button onClick={() => setShowCreate(false)} style={{ height: 42, background: 'rgba(5,17,76,0.06)', color: '#000000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
                <button onClick={createEvent} disabled={!newForm.vehicle_id || !newForm.recorded_speed || !newForm.event_datetime}
                  style={{ height: 42, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (!newForm.vehicle_id || !newForm.recorded_speed || !newForm.event_datetime) ? 0.5 : 1 }}>
                  Log event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────
function AnalyticsTab({ events, vehicles, drivers, selectedYear, selectedMonth, compareMonth, compareYear }: {
  events: SpeedEvent[]; vehicles: any[]; drivers: any[]
  selectedYear: number; selectedMonth: number
  compareMonth: number | null; compareYear: number
}) {
  function eventsForMonth(month: number, year: number) {
    return events.filter(e => {
      const d = new Date(e.event_datetime)
      return d.getMonth() === month && d.getFullYear() === year
    })
  }

  const currentMonthEvents = eventsForMonth(selectedMonth, selectedYear)
  const prevMonth          = selectedMonth === 0 ? 11 : selectedMonth - 1
  const prevYear           = selectedMonth === 0 ? selectedYear - 1 : selectedYear
  const prevMonthEvents    = eventsForMonth(prevMonth, prevYear)
  const compareMonthEvents = compareMonth !== null ? eventsForMonth(compareMonth, compareYear) : []
  const ytdEvents          = events.filter(e => new Date(e.event_datetime).getFullYear() === selectedYear)

  function severityBreakdown(evs: SpeedEvent[]) {
    return evs.reduce((acc, e) => {
      const s = getSeverity(e.recorded_speed - e.speed_limit).label
      acc[s] = (acc[s] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  const curSev  = severityBreakdown(currentMonthEvents)
  const prevSev = severityBreakdown(prevMonthEvents)
  const ytdSev  = severityBreakdown(ytdEvents)
  const compSev = compareMonth !== null ? severityBreakdown(compareMonthEvents) : {}

  function weeklyData(evs: SpeedEvent[], month: number, year: number) {
    const weeks: Record<string, number> = { 'Wk 1': 0, 'Wk 2': 0, 'Wk 3': 0, 'Wk 4': 0, 'Wk 5': 0 }
    evs.forEach(e => {
      const d = new Date(e.event_datetime)
      if (d.getMonth() !== month || d.getFullYear() !== year) return
      weeks[`Wk ${Math.ceil(d.getDate() / 7)}`] = (weeks[`Wk ${Math.ceil(d.getDate() / 7)}`] || 0) + 1
    })
    return Object.entries(weeks).map(([k, v]) => ({ week: k, events: v }))
  }

  const weeklyTrend     = weeklyData(currentMonthEvents, selectedMonth, selectedYear)
  const weeklyTrendComp = compareMonth !== null ? weeklyData(compareMonthEvents, compareMonth, compareYear) : []
  const weeklyMerged    = weeklyTrend.map((w, i) => ({
    week: w.week,
    [MONTHS[selectedMonth]]: w.events,
    ...(compareMonth !== null ? { [MONTHS[compareMonth]]: weeklyTrendComp[i]?.events ?? 0 } : {}),
  }))

  function speedDistribution(evs: SpeedEvent[]) {
    const b: Record<string, number> = { '1–9 over': 0, '10–14 over': 0, '15–25 over': 0, '26–40 over': 0, '40+ over': 0 }
    evs.forEach(e => {
      const x = e.recorded_speed - e.speed_limit
      if      (x <= 9)  b['1–9 over']++
      else if (x <= 14) b['10–14 over']++
      else if (x <= 25) b['15–25 over']++
      else if (x <= 40) b['26–40 over']++
      else              b['40+ over']++
    })
    return Object.entries(b).map(([name, count]) => ({ name, count }))
  }

  const speedDist = speedDistribution(currentMonthEvents)

  const now = new Date()
  const monthlyYtd = Array.from({ length: 12 }, (_, i) => ({
    month: MONTHS[i].slice(0, 3),
    minor:    severityBreakdown(eventsForMonth(i, selectedYear))['Minor']    || 0,
    moderate: severityBreakdown(eventsForMonth(i, selectedYear))['Moderate'] || 0,
    severe:   severityBreakdown(eventsForMonth(i, selectedYear))['Severe']   || 0,
  })).filter((_, i) => i <= now.getMonth() || selectedYear < now.getFullYear())

  function topItems(evs: SpeedEvent[], keyFn: (e: SpeedEvent) => string | null, labelFn: (id: string) => string, limit = 5) {
    const counts: Record<string, number> = {}
    evs.filter(e => keyFn(e)).forEach(e => { const k = keyFn(e)!; counts[k] = (counts[k] || 0) + 1 })
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, limit)
      .map(([id, count]) => ({ id, label: labelFn(id), count }))
  }

  const topVeh    = topItems(currentMonthEvents, e => e.vehicle_id, id => vehicles.find(v => v.id === id)?.reg_plate ?? id.slice(0,8))
  const topDrv    = topItems(currentMonthEvents, e => e.driver_id, id => drivers.find(d => d.id === id)?.full_name ?? id.slice(0,8))
  const topVehYtd = topItems(ytdEvents,          e => e.vehicle_id, id => vehicles.find(v => v.id === id)?.reg_plate ?? id.slice(0,8))

  const totalChg = pctChange(currentMonthEvents.length, prevMonthEvents.length)

  const cardStyle = (color: string): React.CSSProperties => ({
    background: '#fff', borderRadius: 12, border: '1px solid rgba(5,17,76,0.08)',
    padding: '14px 16px', position: 'relative', overflow: 'hidden',
  })

  function StatCard({ label, value, sub, color, trend }: { label: string; value: number; sub?: string; color: string; trend?: number }) {
    return (
      <div style={cardStyle(color)}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '12px 12px 0 0' }} />
        <div style={{ fontSize: 10, color: '#9aa0b8', fontWeight: 500, marginBottom: 6 }}>{label}</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: '#9aa0b8', marginTop: 3 }}>{sub}</div>}
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
            {trend > 0 ? <TrendingUp size={11} style={{ color: '#b33020' }} />
              : trend < 0 ? <TrendingDown size={11} style={{ color: '#1a6b2e' }} />
              : <Minus size={11} style={{ color: '#9aa0b8' }} />}
            <span style={{ fontSize: 10, fontWeight: 600, color: trend > 0 ? '#b33020' : trend < 0 ? '#1a6b2e' : '#9aa0b8' }}>
              {trend > 0 ? '+' : ''}{trend}% vs prev month
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '0 24px 40px' }}>

      {/* ── Summary stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 12 }}>
        <StatCard label={`Total · ${MONTHS[selectedMonth]} ${selectedYear}`} value={currentMonthEvents.length} color="#000000" trend={totalChg} />
        <StatCard label="Minor  (≤9 km/h over)"     value={curSev['Minor']    ?? 0} sub={`YTD: ${ytdSev['Minor']    ?? 0}`} color="#e6a817" trend={pctChange(curSev['Minor']    ?? 0, prevSev['Minor']    ?? 0)} />
        <StatCard label="Moderate  (10–14 km/h over)" value={curSev['Moderate'] ?? 0} sub={`YTD: ${ytdSev['Moderate'] ?? 0}`} color="#c25e00" trend={pctChange(curSev['Moderate'] ?? 0, prevSev['Moderate'] ?? 0)} />
        <StatCard label="Severe  (≥15 km/h over)"    value={curSev['Severe']   ?? 0} sub={`YTD: ${ytdSev['Severe']   ?? 0}`} color="#b33020" trend={pctChange(curSev['Severe']   ?? 0, prevSev['Severe']   ?? 0)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label={`YTD total · ${selectedYear}`}  value={ytdEvents.length}                                             color="#000000" />
        <StatCard label="Escalated to incidents (month)" value={currentMonthEvents.filter(e => e.incident_id).length} sub={`YTD: ${ytdEvents.filter(e => e.incident_id).length}`} color="#b33020" />
        <StatCard label="Disputed (month)"               value={currentMonthEvents.filter(e => e.status === 'disputed').length} sub={`YTD: ${ytdEvents.filter(e => e.status === 'disputed').length}`} color="#2044b0" />
      </div>

      {/* ── Comparison banner ── */}
      {compareMonth !== null && (
        <div style={{ background: '#000000', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Comparing</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {MONTHS[selectedMonth]} {selectedYear} <span style={{ color: 'rgba(255,255,255,0.3)' }}>vs</span> {MONTHS[compareMonth]} {compareYear}
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.1)' }} />
          {[
            { label: 'Total',    cur: currentMonthEvents.length,                              comp: compareMonthEvents.length },
            { label: 'Minor',    cur: curSev['Minor']    ?? 0,                                comp: compSev['Minor']    ?? 0 },
            { label: 'Moderate', cur: curSev['Moderate'] ?? 0,                                comp: compSev['Moderate'] ?? 0 },
            { label: 'Severe',   cur: curSev['Severe']   ?? 0,                                comp: compSev['Severe']   ?? 0 },
            { label: 'Escalated',cur: currentMonthEvents.filter(e => e.incident_id).length,   comp: compareMonthEvents.filter(e => e.incident_id).length },
          ].map((item, idx) => {
            const chg = pctChange(item.cur, item.comp)
            const improving = chg < 0
            return (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {idx > 0 && <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />}
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: '#fff' }}>{item.cur}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>vs {item.comp}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: improving ? '#4ade80' : chg > 0 ? '#f87171' : 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: 10 }}>
                      {chg > 0 ? '+' : ''}{chg}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Weekly trend */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', padding: '16px 18px' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: '#000000', marginBottom: 2 }}>
            Week-by-week · {MONTHS[selectedMonth]}{compareMonth !== null ? ` vs ${MONTHS[compareMonth]}` : ''}
          </div>
          <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 14 }}>Events per week of the month</div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={weeklyMerged}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(5,17,76,0.06)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9aa0b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9aa0b8' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey={MONTHS[selectedMonth]} stroke="#000000" strokeWidth={2.5} dot={{ fill: '#000000', r: 4 }} />
              {compareMonth !== null && (
                <Line type="monotone" dataKey={MONTHS[compareMonth]} stroke="#D97757" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#D97757', r: 3 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Speed excess distribution */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', padding: '16px 18px' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: '#000000', marginBottom: 2 }}>Speed excess distribution</div>
          <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 14 }}>How far over the limit violations are occurring · {MONTHS[selectedMonth]}</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={speedDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(5,17,76,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa0b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9aa0b8' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]}>
                {speedDist.map((_, i) => (
                  <Cell key={i} fill={['#e6a817','#e6a817','#c25e00','#b33020','#7b1d12'][i] ?? '#000000'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* YTD stacked bar */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', padding: '16px 18px' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: '#000000', marginBottom: 2 }}>YTD trend · {selectedYear}</div>
          <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 14 }}>Monthly events by severity — is it getting better or worse?</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={monthlyYtd}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(5,17,76,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9aa0b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9aa0b8' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="minor"    name="Minor"    stackId="a" fill="#e6a817" />
              <Bar dataKey="moderate" name="Moderate" stackId="a" fill="#c25e00" />
              <Bar dataKey="severe"   name="Severe"   stackId="a" fill="#b33020" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Severity breakdown bars */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', padding: '16px 18px' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: '#000000', marginBottom: 2 }}>Severity split</div>
          <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 18 }}>{MONTHS[selectedMonth]} vs previous month · % change shown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(['Minor', 'Moderate', 'Severe'] as const).map(sev => {
              const cur  = curSev[sev]  ?? 0
              const prev = prevSev[sev] ?? 0
              const comp = compareMonth !== null ? (compSev[sev] ?? 0) : null
              const total = currentMonthEvents.length || 1
              const widthPct = Math.round((cur / total) * 100)
              const chg = pctChange(cur, prev)
              const cfg = getSeverity(sev === 'Minor' ? 5 : sev === 'Moderate' ? 12 : 20)
              return (
                <div key={sev}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{sev}</span>
                      {comp !== null && (
                        <span style={{ fontSize: 10, color: '#9aa0b8' }}>
                          {MONTHS[selectedMonth].slice(0,3)} {cur} · {MONTHS[compareMonth!].slice(0,3)} {comp}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: cfg.color }}>{cur}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: chg > 0 ? '#b33020' : chg < 0 ? '#1a6b2e' : '#9aa0b8', background: chg > 0 ? '#fdecea' : chg < 0 ? '#e6f4ea' : '#f1f3f8', padding: '2px 7px', borderRadius: 10 }}>
                        {chg > 0 ? '+' : ''}{chg}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 7, background: '#f1f3f8', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${widthPct}%`, background: cfg.color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Top vehicles */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', padding: '16px 18px' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: '#000000', marginBottom: 2 }}>Top offending vehicles</div>
          <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 16 }}>{MONTHS[selectedMonth]} · most flagged events</div>
          {topVeh.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9aa0b8', textAlign: 'center', padding: '20px 0' }}>No events this month</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topVeh.map((v, i) => {
                const ytdCount = topVehYtd.find(t => t.id === v.id)?.count ?? 0
                return (
                  <div key={v.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? '#b33020' : i === 1 ? '#c25e00' : '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{i + 1}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{v.label}</div>
                          <div style={{ fontSize: 10, color: '#9aa0b8' }}>YTD: {ytdCount} events</div>
                        </div>
                      </div>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: i === 0 ? '#b33020' : '#000000' }}>{v.count}</span>
                    </div>
                    <div style={{ height: 4, background: '#f1f3f8', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${(v.count / topVeh[0].count) * 100}%`, background: i === 0 ? '#b33020' : i === 1 ? '#c25e00' : '#000000', borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top drivers */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', padding: '16px 18px' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: '#000000', marginBottom: 2 }}>Top offending drivers</div>
          <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 16 }}>{MONTHS[selectedMonth]} · most flagged events</div>
          {topDrv.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9aa0b8', textAlign: 'center', padding: '20px 0' }}>No events with assigned drivers this month</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topDrv.map((d, i) => (
                <div key={d.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? '#b33020' : i === 1 ? '#c25e00' : '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{i + 1}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{d.label}</span>
                    </div>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: i === 0 ? '#b33020' : '#000000' }}>{d.count}</span>
                  </div>
                  <div style={{ height: 4, background: '#f1f3f8', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${(d.count / topDrv[0].count) * 100}%`, background: i === 0 ? '#b33020' : i === 1 ? '#c25e00' : '#000000', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function SpeedEventsPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'events'>('analytics')
  const now = new Date()
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [compareMonth,  setCompareMonth]  = useState<number | null>(null)
  const [compareYear,   setCompareYear]   = useState(now.getFullYear())

  const { data: events = [], isLoading } = useQuery({ queryKey: ['speed-events'], queryFn: () => api.get('/speed-events').then(r => r.data) })
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => api.get('/vehicles').then(r => r.data) })
  const { data: drivers  = [] } = useQuery({ queryKey: ['drivers'],  queryFn: () => api.get('/drivers').then(r => r.data) })

  const years = [...new Set([now.getFullYear(), ...events.map((e: SpeedEvent) => new Date(e.event_datetime).getFullYear())])].sort((a,b) => b-a)

  const selStyle: React.CSSProperties = {
    height: 32, border: '1px solid rgba(5,17,76,0.12)', borderRadius: 8,
    padding: '0 10px', fontSize: 12, color: '#000000', background: '#fff',
    outline: 'none', fontFamily: "'DM Sans',sans-serif",
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>

        {/* Title row + analytics controls inline */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>

          {/* Left: title */}
          <div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: '#000000', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Speed events</h1>
            <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>
              Geotab GPS flag management · {events.length} total events
            </p>
          </div>

          {/* Right: controls — only visible on analytics tab */}
          {activeTab === 'analytics' && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#9aa0b8', marginBottom: 4 }}>Year</div>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={selStyle}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#9aa0b8', marginBottom: 4 }}>Month</div>
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={selStyle}>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div style={{ width: 1, height: 32, background: 'rgba(5,17,76,0.1)', alignSelf: 'flex-end' }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#9aa0b8', marginBottom: 4 }}>Compare with</div>
                <select value={compareMonth ?? ''} onChange={e => setCompareMonth(e.target.value === '' ? null : Number(e.target.value))} style={selStyle}>
                  <option value="">— None —</option>
                  {MONTHS.map((m, i) => i !== selectedMonth && <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              {compareMonth !== null && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: '#9aa0b8', marginBottom: 4 }}>Comp. year</div>
                  <select value={compareYear} onChange={e => setCompareYear(Number(e.target.value))} style={selStyle}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 2, background: '#fff', borderRadius: 10, border: '1px solid rgba(5,17,76,0.08)', padding: 4, width: 'fit-content', marginBottom: 16 }}>
          {[
            { key: 'analytics' as const, label: '📊  Analytics & reports' },
            { key: 'events'    as const, label: '⚡  Event log'           },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: activeTab === t.key ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", background: activeTab === t.key ? '#000000' : 'transparent', color: activeTab === t.key ? '#fff' : '#5a6282', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'analytics' ? (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <AnalyticsTab
              events={events}
              vehicles={vehicles}
              drivers={drivers}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              compareMonth={compareMonth}
              compareYear={compareYear}
            />
          </div>
        ) : (
          <EventsTab events={events} vehicles={vehicles} drivers={drivers} isLoading={isLoading} />
        )}
      </div>
    </div>
  )
}