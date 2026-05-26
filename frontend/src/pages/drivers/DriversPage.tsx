import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { can } from '@/lib/permissions'
import { useState } from 'react'
import {
  Users, X, Search, ChevronRight, CheckCircle,
  XCircle, Clock, Phone, Mail, CreditCard, User
} from 'lucide-react'

interface Driver {
  id: string
  full_name: string
  employee_no: string
  phone: string | null
  email: string | null
  licence_no: string | null
  licence_class: string | null
  licence_expiry: string | null
  psv_expiry: string | null
  medical_expiry: string | null
  status: 'active' | 'suspended' | 'terminated'
  notes: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:     { bg: '#e6f4ea', color: '#1a6b2e' },
    suspended:  { bg: '#fff3e0', color: '#c25e00' },
    terminated: { bg: '#fdecea', color: '#b33020' },
  }
  const c = cfg[status] ?? { bg: '#f1f3f8', color: '#5a6282' }
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function ExpiryTag({ label, date }: { label: string; date: string | null }) {
  if (!date) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#9aa0b8' }}>Not set</div>
      </div>
    </div>
  )

  const d     = new Date(date)
  const now   = new Date()
  const diff  = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const expired     = diff < 0
  const expiringSoon = diff >= 0 && diff <= 30

  const color = expired ? '#b33020' : expiringSoon ? '#c25e00' : '#1a6b2e'
  const bg    = expired ? '#fdecea' : expiringSoon ? '#fff3e0' : '#e6f4ea'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color, fontWeight: expired || expiringSoon ? 600 : 400 }}>
          {d.toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}
          {expired && <span style={{ marginLeft: 4, fontSize: 10, background: bg, padding: '1px 6px', borderRadius: 10 }}>Expired</span>}
          {expiringSoon && !expired && <span style={{ marginLeft: 4, fontSize: 10, background: bg, padding: '1px 6px', borderRadius: 10 }}>{diff}d left</span>}
        </div>
      </div>
    </div>
  )
}

function expiryStatus(date: string | null): 'ok' | 'soon' | 'expired' | 'missing' {
  if (!date) return 'missing'
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0)  return 'expired'
  if (diff <= 30) return 'soon'
  return 'ok'
}

function OverallHealth({ driver }: { driver: Driver }) {
  const statuses = [
    expiryStatus(driver.licence_expiry),
    expiryStatus(driver.psv_expiry),
    expiryStatus(driver.medical_expiry),
  ]
  if (statuses.includes('expired')) return <span style={{ fontSize: 10, fontWeight: 600, color: '#b33020', background: '#fdecea', padding: '2px 8px', borderRadius: 20 }}>Docs expired</span>
  if (statuses.includes('soon'))    return <span style={{ fontSize: 10, fontWeight: 600, color: '#c25e00', background: '#fff3e0', padding: '2px 8px', borderRadius: 20 }}>Expiring soon</span>
  if (statuses.includes('missing')) return <span style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', background: '#f1f3f8', padding: '2px 8px', borderRadius: 20 }}>Incomplete</span>
  return <span style={{ fontSize: 10, fontWeight: 600, color: '#1a6b2e', background: '#e6f4ea', padding: '2px 8px', borderRadius: 20 }}>Docs current</span>
}

// ── Detail panel ──────────────────────────────────────────────────────

function DetailPanel({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    phone:          driver.phone ?? '',
    email:          driver.email ?? '',
    licence_no:     driver.licence_no ?? '',
    licence_class:  driver.licence_class ?? '',
    licence_expiry: driver.licence_expiry ? driver.licence_expiry.slice(0, 10) : '',
    psv_expiry:     driver.psv_expiry     ? driver.psv_expiry.slice(0, 10)     : '',
    medical_expiry: driver.medical_expiry ? driver.medical_expiry.slice(0, 10) : '',
    status:         driver.status,
    notes:          driver.notes ?? '',
  })
  const [busy, setBusy] = useState(false)

  const { data: complianceScore } = useQuery({
    queryKey: ['driver-score', driver.id],
    queryFn:  () => api.get(`/driver-compliance/drivers/${driver.id}/score`).then(r => r.data),
  })

  async function save() {
    setBusy(true)
    try {
      await api.patch(`/drivers/${driver.id}`, {
        ...form,
        licence_expiry: form.licence_expiry ? new Date(form.licence_expiry).toISOString() : null,
        psv_expiry:     form.psv_expiry     ? new Date(form.psv_expiry).toISOString()     : null,
        medical_expiry: form.medical_expiry ? new Date(form.medical_expiry).toISOString() : null,
      })
      qc.invalidateQueries({ queryKey: ['drivers'] })
      setEditing(false)
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38,
    border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 8,
    padding: '0 10px', fontSize: 13, color: '#000000',
    background: '#fff', outline: 'none',
    fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
  }

  const scoreColor = !complianceScore ? '#9aa0b8'
    : complianceScore.score >= 90 ? '#1a6b2e'
    : complianceScore.score >= 70 ? '#c25e00'
    : '#b33020'
  const scoreBg = !complianceScore ? '#f1f3f8'
    : complianceScore.score >= 90 ? '#e6f4ea'
    : complianceScore.score >= 70 ? '#fff3e0'
    : '#fdecea'

  return (
    <div style={{ width: 400, flexShrink: 0, background: '#fff', borderLeft: '1px solid rgba(5,17,76,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(5,17,76,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: '#fff' }}>
              {driver.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </span>
          </div>
          <div>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: '#000000', margin: '0 0 3px' }}>{driver.full_name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#9aa0b8' }}>{driver.employee_no}</span>
              <StatusPill status={driver.status} />
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(5,17,76,0.05)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <X size={14} color="#000000" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>

        {/* Compliance score */}
        {complianceScore && (
          <div style={{ background: scoreBg, borderRadius: 10, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
              {complianceScore.score}%
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: scoreColor }}>Compliance score</div>
              <div style={{ fontSize: 11, color: scoreColor, opacity: 0.7, marginTop: 2 }}>
                {complianceScore.compliant}/{complianceScore.total} required items current
              </div>
            </div>
          </div>
        )}

        {/* Document expiry health */}
        <div style={{ background: '#F7F6F3', borderRadius: 10, padding: '14px', marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Document health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ExpiryTag label="Licence expiry" date={driver.licence_expiry} />
            <ExpiryTag label="PSV permit expiry" date={driver.psv_expiry} />
            <ExpiryTag label="Medical certificate" date={driver.medical_expiry} />
          </div>
        </div>

        {/* Contact info */}
        {!editing && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Contact</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={13} style={{ color: '#9aa0b8', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: driver.phone ? '#000000' : '#c0c4d4' }}>{driver.phone ?? 'No phone number'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={13} style={{ color: '#9aa0b8', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: driver.email ? '#000000' : '#c0c4d4' }}>{driver.email ?? 'No email address'}</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Licence</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#F7F6F3', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 3 }}>Number</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#000000' }}>{driver.licence_no ?? '—'}</div>
                </div>
                <div style={{ background: '#F7F6F3', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 3 }}>Class</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#000000' }}>{driver.licence_class ?? '—'}</div>
                </div>
              </div>
            </div>

            {driver.notes && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 13, color: '#3d4466', lineHeight: 1.6, background: '#F7F6F3', borderRadius: 8, padding: '12px 14px' }}>{driver.notes}</div>
              </div>
            )}

            {can('drivers', 'edit') && (<button
              onClick={() => setEditing(true)}
              style={{ width: '100%', height: 40, background: 'rgba(5,17,76,0.05)', color: '#000000', border: '1px solid rgba(5,17,76,0.1)', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
            >
              Edit record
            </button>)}
          </>
        )}

        {/* Edit form */}
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Edit driver record</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>Licence no.</label>
                <input value={form.licence_no} onChange={e => setForm(f => ({ ...f, licence_no: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>Licence class</label>
                <input value={form.licence_class} onChange={e => setForm(f => ({ ...f, licence_class: e.target.value }))} placeholder="e.g. C, CE, D" style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>Licence expiry</label>
              <input type="date" value={form.licence_expiry} onChange={e => setForm(f => ({ ...f, licence_expiry: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>PSV permit expiry</label>
              <input type="date" value={form.psv_expiry} onChange={e => setForm(f => ({ ...f, psv_expiry: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>Medical certificate expiry</label>
              <input type="date" value={form.medical_expiry} onChange={e => setForm(f => ({ ...f, medical_expiry: e.target.value }))} style={inputStyle} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'suspended' | 'terminated' }))} style={inputStyle}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4 }}>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ ...inputStyle, height: 'auto', minHeight: 72, padding: '8px 10px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 4 }}>
              <button
                onClick={() => setEditing(false)}
                style={{ height: 40, background: 'rgba(5,17,76,0.06)', color: '#000000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                style={{ height: 40, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────

export default function DriversPage() {
  const [selected, setSelected]         = useState<Driver | null>(null)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDoc, setFilterDoc]       = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [newForm, setNewForm] = useState({
    full_name: '', employee_no: '', phone: '', email: '',
    licence_no: '', licence_class: '', licence_expiry: '',
    psv_expiry: '', medical_expiry: '',
  })
  const qc = useQueryClient()

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn:  () => api.get('/drivers').then(r => r.data),
  })

  const filtered = drivers.filter((d: Driver) => {
    const matchSearch = !search
      || d.full_name.toLowerCase().includes(search.toLowerCase())
      || d.employee_no.toLowerCase().includes(search.toLowerCase())
      || d.licence_no?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || d.status === filterStatus
    const matchDoc = !filterDoc || (() => {
      const s = [expiryStatus(d.licence_expiry), expiryStatus(d.psv_expiry), expiryStatus(d.medical_expiry)]
      if (filterDoc === 'expired')  return s.includes('expired')
      if (filterDoc === 'soon')     return s.includes('soon') && !s.includes('expired')
      if (filterDoc === 'ok')       return !s.includes('expired') && !s.includes('soon') && !s.includes('missing')
      return true
    })()
    return matchSearch && matchStatus && matchDoc
  })

  const counts = {
    total:      drivers.length,
    active:     drivers.filter((d: Driver) => d.status === 'active').length,
    expired:    drivers.filter((d: Driver) => [d.licence_expiry, d.psv_expiry, d.medical_expiry].some(dt => expiryStatus(dt) === 'expired')).length,
    expiringSoon: drivers.filter((d: Driver) => [d.licence_expiry, d.psv_expiry, d.medical_expiry].some(dt => expiryStatus(dt) === 'soon') && ![d.licence_expiry, d.psv_expiry, d.medical_expiry].some(dt => expiryStatus(dt) === 'expired')).length,
  }

  async function createDriver() {
    try {
      await api.post('/drivers', {
        ...newForm,
        licence_expiry: newForm.licence_expiry ? new Date(newForm.licence_expiry).toISOString() : null,
        psv_expiry:     newForm.psv_expiry     ? new Date(newForm.psv_expiry).toISOString()     : null,
        medical_expiry: newForm.medical_expiry ? new Date(newForm.medical_expiry).toISOString() : null,
      })
      qc.invalidateQueries({ queryKey: ['drivers'] })
      setShowCreate(false)
      setNewForm({ full_name: '', employee_no: '', phone: '', email: '', licence_no: '', licence_class: '', licence_expiry: '', psv_expiry: '', medical_expiry: '' })
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Failed to create driver')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40,
    border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 9,
    padding: '0 12px', fontSize: 13, color: '#000000',
    background: '#fff', outline: 'none',
    fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 5
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left — list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: '#000000', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Drivers</h1>
              <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>{drivers.length} drivers registered</p>
            </div>
            {can('drivers', 'edit') && (<button
              onClick={() => setShowCreate(true)}
              style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer' }}
            >
              + Add driver
            </button>)}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total drivers',  value: counts.total,        color: '#000000', bg: 'rgba(5,17,76,0.05)' },
              { label: 'Active',         value: counts.active,       color: '#1a6b2e', bg: '#e6f4ea' },
              { label: 'Docs expiring',  value: counts.expiringSoon, color: '#c25e00', bg: '#fff3e0' },
              { label: 'Docs expired',   value: counts.expired,      color: '#b33020', bg: '#fdecea' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, opacity: 0.7, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', height: 38 }}>
              <Search size={13} style={{ color: '#9aa0b8', flexShrink: 0 }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Name, employee no. or licence..."
                style={{ border: 'none', outline: 'none', fontSize: 13, color: '#000000', background: 'transparent', width: '100%', fontFamily: "'DM Sans',sans-serif" }}
              />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ height: 38, border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#000000', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="terminated">Terminated</option>
            </select>
            <select value={filterDoc} onChange={e => setFilterDoc(e.target.value)}
              style={{ height: 38, border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#000000', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}>
              <option value="">All doc statuses</option>
              <option value="ok">Docs current</option>
              <option value="soon">Expiring soon</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0b8', fontSize: 13 }}>Loading drivers...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <Users size={28} style={{ color: '#9aa0b8', margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: '#9aa0b8', margin: 0 }}>No drivers found</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F6F3' }}>
                    {['Driver', 'Employee no.', 'Licence', 'Licence expiry', 'PSV expiry', 'Medical', 'Docs', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(5,17,76,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d: Driver) => {
                    const isSelected = selected?.id === d.id
                    const licStatus = expiryStatus(d.licence_expiry)
                    const psvStatus = expiryStatus(d.psv_expiry)
                    const medStatus = expiryStatus(d.medical_expiry)

                    function expiryCell(date: string | null, status: string) {
                      if (!date) return <span style={{ fontSize: 12, color: '#c0c4d4' }}>—</span>
                      const color = status === 'expired' ? '#b33020' : status === 'soon' ? '#c25e00' : '#5a6282'
                      return <span style={{ fontSize: 12, color, fontWeight: status !== 'ok' ? 600 : 400 }}>
                        {new Date(date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    }

                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelected(isSelected ? null : d)}
                        style={{ borderBottom: '1px solid rgba(5,17,76,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(5,17,76,0.04)' : 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (!isSelected)(e.currentTarget as HTMLElement).style.background = 'rgba(5,17,76,0.02)' }}
                        onMouseLeave={e => { if (!isSelected)(e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 11, color: '#fff' }}>
                                {d.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                              </span>
                            </div>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13, color: '#000000' }}>{d.full_name}</div>
                              {d.phone && <div style={{ fontSize: 11, color: '#9aa0b8', marginTop: 1 }}>{d.phone}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px', fontSize: 12, color: '#5a6282', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}>{d.employee_no}</td>
                        <td style={{ padding: '13px 16px', fontSize: 12, color: '#5a6282', whiteSpace: 'nowrap' }}>
                          {d.licence_no ? <span>{d.licence_no}<span style={{ marginLeft: 4, fontSize: 10, color: '#9aa0b8' }}>{d.licence_class}</span></span> : <span style={{ color: '#c0c4d4' }}>—</span>}
                        </td>
                        <td style={{ padding: '13px 16px' }}>{expiryCell(d.licence_expiry, licStatus)}</td>
                        <td style={{ padding: '13px 16px' }}>{expiryCell(d.psv_expiry, psvStatus)}</td>
                        <td style={{ padding: '13px 16px' }}>{expiryCell(d.medical_expiry, medStatus)}</td>
                        <td style={{ padding: '13px 16px' }}><OverallHealth driver={d} /></td>
                        <td style={{ padding: '13px 16px' }}><StatusPill status={d.status} /></td>
                        <td style={{ padding: '13px 16px' }}>
                          <ChevronRight size={14} style={{ color: isSelected ? '#D97757' : '#9aa0b8', transition: 'color 0.12s' }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Right — detail panel */}
      {selected && <DetailPanel driver={selected} onClose={() => setSelected(null)} />}

      {/* Create modal */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(5,17,76,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(5,17,76,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: '#000000', margin: 0 }}>Add new driver</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color="#000000" />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Full name <span style={{ color: '#b33020' }}>*</span></label>
                  <input value={newForm.full_name} onChange={e => setNewForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. John Banda" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Employee no. <span style={{ color: '#b33020' }}>*</span></label>
                  <input value={newForm.employee_no} onChange={e => setNewForm(f => ({ ...f, employee_no: e.target.value }))} placeholder="e.g. EMP-001" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} placeholder="+260 9X XXX XXXX" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(5,17,76,0.07)', paddingTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Licence & certification</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Licence number</label>
                    <input value={newForm.licence_no} onChange={e => setNewForm(f => ({ ...f, licence_no: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Licence class</label>
                    <input value={newForm.licence_class} onChange={e => setNewForm(f => ({ ...f, licence_class: e.target.value }))} placeholder="e.g. C, CE, D" style={inputStyle} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Licence expiry</label>
                  <input type="date" value={newForm.licence_expiry} onChange={e => setNewForm(f => ({ ...f, licence_expiry: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>PSV expiry</label>
                  <input type="date" value={newForm.psv_expiry} onChange={e => setNewForm(f => ({ ...f, psv_expiry: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Medical expiry</label>
                  <input type="date" value={newForm.medical_expiry} onChange={e => setNewForm(f => ({ ...f, medical_expiry: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
                <button onClick={() => setShowCreate(false)} style={{ height: 42, background: 'rgba(5,17,76,0.06)', color: '#000000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  Cancel
                </button>
                <button
                  onClick={createDriver}
                  disabled={!newForm.full_name || !newForm.employee_no}
                  style={{ height: 42, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (!newForm.full_name || !newForm.employee_no) ? 0.5 : 1 }}
                >
                  Add driver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}