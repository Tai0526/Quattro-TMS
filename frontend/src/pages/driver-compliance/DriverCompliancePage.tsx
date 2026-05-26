import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Users, X, CheckCircle, Clock, AlertTriangle, Search, Lock } from 'lucide-react'

// ── Fixed compliance categories ───────────────────────────────────────
const CATS = [
  { key: 'Medicals',                  short: 'Medical',  has_expiry: true,  prerequisite: false },
  { key: 'Silicosis',                 short: 'Silicosis',has_expiry: true,  prerequisite: false },
  { key: 'General induction',         short: 'Gen ind',  has_expiry: false, prerequisite: true  },
  { key: 'Hand protection',           short: 'Hand prot',has_expiry: false, prerequisite: true  },
  { key: 'Lightning awareness',       short: 'Lightning', has_expiry: false, prerequisite: true  },
  { key: 'Site induction',            short: 'Site ind', has_expiry: false, prerequisite: true  },
  { key: 'Think level 1',             short: 'Think L1', has_expiry: false, prerequisite: true  },
  { key: 'First aid',                 short: 'First aid',has_expiry: true,  prerequisite: true  },
  { key: 'Pit induction',             short: 'Pit ind',  has_expiry: false, prerequisite: true  },
  { key: 'Fibrous material handling', short: 'Fibrous',  has_expiry: false, prerequisite: true  },
]

// ── Types ─────────────────────────────────────────────────────────────
interface Driver {
  id: string
  full_name: string
  employee_no: string
  status: string
  phone: string | null
}

interface CatRecord {
  category_id: string
  category_name: string
  has_expiry: boolean
  record: {
    id: string | null
    is_compliant: boolean
    expiry_date: string | null
    certificate_file_name: string | null
    notes: string | null
    verified_by: string | null
    verified_at: string | null
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────
function cellStatus(rec: CatRecord['record'], hasExpiry: boolean): 'compliant' | 'expiring' | 'expired' | 'missing' {
  if (!rec || !rec.is_compliant) return 'missing'
  if (hasExpiry && rec.expiry_date) {
    const diff = Math.ceil((new Date(rec.expiry_date).getTime() - Date.now()) / 86400000)
    if (diff < 0)  return 'expired'
    if (diff <= 30) return 'expiring'
  }
  return 'compliant'
}

function StatusDot({ status, locked }: { status: string; locked?: boolean }) {
  if (locked) return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f1f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Lock size={11} style={{ color: '#c0c4d4' }} />
    </div>
  )
  const cfg = {
    compliant: { bg: '#1a6b2e', icon: <CheckCircle size={13} color="#fff" /> },
    expiring:  { bg: '#c25e00', icon: <Clock size={13} color="#fff" /> },
    expired:   { bg: '#b33020', icon: <AlertTriangle size={11} color="#fff" /> },
    missing:   { bg: '#e0e3ef', icon: <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9aa0b8' }} /> },
  }[status] ?? { bg: '#e0e3ef', icon: null }

  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {cfg.icon}
    </div>
  )
}

// ── Quick-tick modal ──────────────────────────────────────────────────
function TickModal({ driver, catName, catRecord, categoryId, hasExpiry, onClose }: {
  driver: Driver
  catName: string
  catRecord: CatRecord['record']
  categoryId: string
  hasExpiry: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isCompliant = catRecord?.is_compliant ?? false
  const [compliant, setCompliant] = useState(isCompliant)
  const [expiryDate, setExpiryDate] = useState(catRecord?.expiry_date?.slice(0, 10) ?? '')
  const [notes, setNotes] = useState(catRecord?.notes ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('category_id', categoryId)
      fd.append('is_compliant', String(compliant))
      if (expiryDate) fd.append('expiry_date', new Date(expiryDate).toISOString())
      if (notes) fd.append('notes', notes)
      await api.post(`/driver-compliance/drivers/${driver.id}/records`, fd)
      qc.invalidateQueries({ queryKey: ['driver-compliance', driver.id] })
      qc.invalidateQueries({ queryKey: ['driver-compliance-all'] })
      onClose()
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38,
    border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 8,
    padding: '0 12px', fontSize: 13, color: '#000000',
    background: '#fff', outline: 'none',
    fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,17,76,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 380, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(5,17,76,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: '#000000' }}>{catName}</div>
            <div style={{ fontSize: 11, color: '#9aa0b8', marginTop: 2 }}>{driver.full_name} · {driver.employee_no}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={13} color="#000000" />
          </button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[true, false].map(val => (
              <button key={String(val)} onClick={() => setCompliant(val)}
                style={{ flex: 1, height: 40, borderRadius: 9, border: `1.5px solid ${compliant === val ? (val ? '#1a6b2e' : '#b33020') : 'rgba(5,17,76,0.12)'}`, background: compliant === val ? (val ? '#e6f4ea' : '#fdecea') : 'transparent', color: compliant === val ? (val ? '#1a6b2e' : '#b33020') : '#9aa0b8', fontSize: 13, fontWeight: compliant === val ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.15s' }}>
                {val ? '✓ Done' : '✗ Not done'}
              </button>
            ))}
          </div>

          {hasExpiry && compliant && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 5 }}>Expiry date</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={inputStyle} />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 5 }}>Notes <span style={{ color: '#9aa0b8', fontWeight: 400 }}>(optional)</span></label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Done at Kalumbila clinic" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 2 }}>
            <button onClick={onClose} style={{ height: 40, background: 'rgba(5,17,76,0.06)', color: '#000000', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              Cancel
            </button>
            <button onClick={save} disabled={busy} style={{ height: 40, background: '#D97757', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Driver detail panel ───────────────────────────────────────────────
function DetailPanel({ driver, categories, onClose }: {
  driver: Driver
  categories: any[]
  onClose: () => void
}) {
  const { data: records = [] } = useQuery<CatRecord[]>({
    queryKey: ['driver-compliance', driver.id],
    queryFn:  () => api.get(`/driver-compliance/drivers/${driver.id}`).then(r => r.data),
  })

  const recordMap = Object.fromEntries(records.map(r => [r.category_name, r]))
  const hasMedicals  = cellStatus(recordMap['Medicals']?.record  ?? null, true)  === 'compliant'
  const hasSilicosis = cellStatus(recordMap['Silicosis']?.record ?? null, true)  === 'compliant'
  const prereqMet    = hasMedicals && hasSilicosis

  const fmt = (d: string | null) => d
    ? new Date(d).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const totalRequired = CATS.length
  const done = CATS.filter(cat => {
    const r = recordMap[cat.key]
    return r && cellStatus(r.record, cat.has_expiry) === 'compliant'
  }).length

  const scoreColor = done / totalRequired >= 0.9 ? '#1a6b2e' : done / totalRequired >= 0.7 ? '#c25e00' : '#b33020'
  const scoreBg    = done / totalRequired >= 0.9 ? '#e6f4ea' : done / totalRequired >= 0.7 ? '#fff3e0' : '#fdecea'

  return (
    <div style={{ width: 420, flexShrink: 0, background: '#fff', borderLeft: '1px solid rgba(5,17,76,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

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
            <span style={{ fontSize: 11, color: '#9aa0b8' }}>{driver.employee_no}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(5,17,76,0.05)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <X size={14} color="#000000" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>

        {/* Score */}
        <div style={{ background: scoreBg, borderRadius: 10, padding: '14px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
            {Math.round((done / totalRequired) * 100)}%
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: scoreColor }}>Compliance score</div>
            <div style={{ fontSize: 11, color: scoreColor, opacity: 0.75, marginTop: 2 }}>{done} of {totalRequired} items completed</div>
          </div>
        </div>

        {/* Prerequisites warning */}
        {!prereqMet && (
          <div style={{ background: '#fdecea', border: '1px solid #f5c6c2', borderRadius: 10, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Lock size={14} style={{ color: '#b33020', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#b33020' }}>Prerequisites incomplete</div>
              <div style={{ fontSize: 11, color: '#b33020', marginTop: 2, lineHeight: 1.5 }}>
                {!hasMedicals && !hasSilicosis ? 'Medicals and Silicosis' : !hasMedicals ? 'Medicals' : 'Silicosis'} must be completed before other trainings can be booked.
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {CATS.map((cat, i) => {
            const rec    = recordMap[cat.key]
            const status = cellStatus(rec?.record ?? null, cat.has_expiry)
            const locked = cat.prerequisite && !prereqMet
            const isPrereq = !cat.prerequisite

            const statusColor = status === 'compliant' ? '#1a6b2e'
              : status === 'expiring' ? '#c25e00'
              : status === 'expired'  ? '#b33020'
              : '#9aa0b8'
            const statusBg = status === 'compliant' ? '#e6f4ea'
              : status === 'expiring' ? '#fff3e0'
              : status === 'expired'  ? '#fdecea'
              : '#f1f3f8'
            const statusLabel = status === 'compliant' ? 'Done'
              : status === 'expiring' ? 'Expiring'
              : status === 'expired'  ? 'Expired'
              : 'Not done'

            if (i === 2) return (
              <>
                <div key="divider" style={{ fontSize: 9, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0 4px' }}>
                  Trainings — requires medicals + silicosis
                </div>
                <div key={cat.key} style={{ background: locked ? '#fafafa' : '#fff', border: `1px solid ${locked ? 'rgba(5,17,76,0.05)' : 'rgba(5,17,76,0.08)'}`, borderRadius: 10, padding: '12px 14px', opacity: locked ? 0.65 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {locked
                        ? <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f1f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={11} style={{ color: '#c0c4d4' }} /></div>
                        : <div style={{ width: 24, height: 24, borderRadius: '50%', background: statusBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {status === 'compliant' ? <CheckCircle size={13} style={{ color: statusColor }} />
                              : status === 'expiring' ? <Clock size={11} style={{ color: statusColor }} />
                              : status === 'expired'  ? <AlertTriangle size={11} style={{ color: statusColor }} />
                              : <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#c0c4d4' }} />}
                          </div>
                      }
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: locked ? '#9aa0b8' : '#000000' }}>{cat.key}</div>
                        {cat.has_expiry && <div style={{ fontSize: 10, color: '#9aa0b8', marginTop: 1 }}>Has expiry date</div>}
                      </div>
                    </div>
                    {!locked && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: statusBg, padding: '2px 8px', borderRadius: 20 }}>
                        {statusLabel}
                      </span>
                    )}
                  </div>
                  {!locked && rec?.record && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(5,17,76,0.06)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {rec.record.verified_at && (
                        <div><div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Date done</div>
                          <div style={{ fontSize: 12, color: '#000000', fontWeight: 500 }}>{fmt(rec.record.verified_at)}</div></div>
                      )}
                      {rec.record.expiry_date && (
                        <div><div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Expires</div>
                          <div style={{ fontSize: 12, color: statusColor, fontWeight: 500 }}>{fmt(rec.record.expiry_date)}</div></div>
                      )}
                      {rec.record.notes && (
                        <div style={{ width: '100%' }}>
                          <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Notes</div>
                          <div style={{ fontSize: 12, color: '#5a6282' }}>{rec.record.notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )

            return (
              <div key={cat.key} style={{ background: locked ? '#fafafa' : '#fff', border: `1px solid ${locked ? 'rgba(5,17,76,0.05)' : 'rgba(5,17,76,0.08)'}`, borderRadius: 10, padding: '12px 14px', opacity: locked ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {locked
                      ? <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f1f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={11} style={{ color: '#c0c4d4' }} /></div>
                      : <div style={{ width: 24, height: 24, borderRadius: '50%', background: statusBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {status === 'compliant' ? <CheckCircle size={13} style={{ color: statusColor }} />
                            : status === 'expiring' ? <Clock size={11} style={{ color: statusColor }} />
                            : status === 'expired'  ? <AlertTriangle size={11} style={{ color: statusColor }} />
                            : <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#c0c4d4' }} />}
                        </div>
                    }
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: locked ? '#9aa0b8' : '#000000' }}>
                        {cat.key}
                        {!cat.prerequisite && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, color: '#D97757', background: '#faeeda', padding: '1px 6px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prerequisite</span>}
                      </div>
                      {cat.has_expiry && <div style={{ fontSize: 10, color: '#9aa0b8', marginTop: 1 }}>Has expiry date</div>}
                    </div>
                  </div>
                  {!locked && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: statusBg, padding: '2px 8px', borderRadius: 20 }}>
                      {statusLabel}
                    </span>
                  )}
                </div>
                {!locked && rec?.record && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(5,17,76,0.06)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {rec.record.verified_at && (
                      <div><div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Date done</div>
                        <div style={{ fontSize: 12, color: '#000000', fontWeight: 500 }}>{fmt(rec.record.verified_at)}</div></div>
                    )}
                    {rec.record.expiry_date && (
                      <div><div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Expires</div>
                        <div style={{ fontSize: 12, color: statusColor, fontWeight: 500 }}>{fmt(rec.record.expiry_date)}</div></div>
                    )}
                    {rec.record.notes && (
                      <div style={{ width: '100%' }}>
                        <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Notes</div>
                        <div style={{ fontSize: 12, color: '#5a6282' }}>{rec.record.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Matrix row ────────────────────────────────────────────────────────
function DriverRow({ driver, categories, isSelected, onSelect, onTick }: {
  driver: Driver
  categories: any[]
  isSelected: boolean
  onSelect: () => void
  onTick: (driver: Driver, catName: string, catId: string, rec: CatRecord['record'], hasExpiry: boolean) => void
}) {
  const { data: records = [] } = useQuery<CatRecord[]>({
    queryKey: ['driver-compliance', driver.id],
    queryFn:  () => api.get(`/driver-compliance/drivers/${driver.id}`).then(r => r.data),
  })

  const recordMap = Object.fromEntries(records.map(r => [r.category_name, r]))
  const hasMedicals  = cellStatus(recordMap['Medicals']?.record  ?? null, true) === 'compliant'
  const hasSilicosis = cellStatus(recordMap['Silicosis']?.record ?? null, true) === 'compliant'
  const prereqMet    = hasMedicals && hasSilicosis

  const totalDone = CATS.filter(cat => {
    const r = recordMap[cat.key]
    return r && cellStatus(r.record, cat.has_expiry) === 'compliant'
  }).length

  return (
    <tr style={{ borderBottom: '1px solid rgba(5,17,76,0.04)', background: isSelected ? 'rgba(5,17,76,0.03)' : 'transparent', transition: 'background 0.12s' }}>

      {/* Driver name */}
      <td style={{ padding: '10px 16px', position: 'sticky', left: 0, background: isSelected ? '#f0f1f8' : '#fff', zIndex: 1, borderRight: '1px solid rgba(5,17,76,0.06)', minWidth: 200 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={onSelect}
        >
          <div style={{ width: 30, height: 30, borderRadius: 8, background: isSelected ? '#D97757' : '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 11, color: '#fff' }}>
              {driver.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#000000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{driver.full_name}</div>
            <div style={{ fontSize: 10, color: '#9aa0b8' }}>{driver.employee_no}</div>
          </div>
        </div>
      </td>

      {/* Score */}
      <td style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid rgba(5,17,76,0.04)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: totalDone === CATS.length ? '#1a6b2e' : totalDone >= CATS.length * 0.7 ? '#c25e00' : '#b33020', background: totalDone === CATS.length ? '#e6f4ea' : totalDone >= CATS.length * 0.7 ? '#fff3e0' : '#fdecea', padding: '3px 8px', borderRadius: 20 }}>
          {totalDone}/{CATS.length}
        </span>
      </td>

      {/* Compliance cells */}
      {CATS.map(cat => {
        const rec    = recordMap[cat.key]
        const status = cellStatus(rec?.record ?? null, cat.has_expiry)
        const locked = cat.prerequisite && !prereqMet
        const catId  = categories.find(c => c.name === cat.key)?.id

        return (
          <td key={cat.key} style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(5,17,76,0.03)' }}>
            <button
              disabled={locked || !catId}
              onClick={() => !locked && catId && onTick(driver, cat.key, catId, rec?.record ?? null, cat.has_expiry)}
              title={locked ? `Complete Medicals & Silicosis first` : cat.key}
              style={{ background: 'none', border: 'none', cursor: locked || !catId ? 'not-allowed' : 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s', opacity: locked ? 0.5 : 1 }}
              onMouseEnter={e => { if (!locked)(e.currentTarget as HTMLElement).style.background = 'rgba(5,17,76,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <StatusDot status={status} locked={locked} />
            </button>
          </td>
        )
      })}
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function DriverCompliancePage() {
  const [selected, setSelected] = useState<Driver | null>(null)
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [tickTarget, setTickTarget] = useState<{
    driver: Driver; catName: string; catId: string; rec: CatRecord['record']; hasExpiry: boolean
  } | null>(null)
  const qc = useQueryClient()

  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ['drivers'],
    queryFn:  () => api.get('/drivers').then(r => r.data),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['compliance-categories'],
    queryFn:  () => api.get('/driver-compliance/categories').then(r => r.data),
  })

  const filtered = drivers.filter(d => {
    const matchSearch = !search
      || d.full_name.toLowerCase().includes(search.toLowerCase())
      || d.employee_no.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || d.status === filterStatus
    return matchSearch && matchStatus
  })

  const counts = {
    total:  drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: '#000000', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Driver compliance</h1>
            <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>Click a cell to tick/update · click a driver name to view full history</p>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { color: '#1a6b2e', bg: '#e6f4ea', label: 'Done / current' },
            { color: '#c25e00', bg: '#fff3e0', label: 'Expiring within 30 days' },
            { color: '#b33020', bg: '#fdecea', label: 'Expired' },
            { color: '#9aa0b8', bg: '#f1f3f8', label: 'Not done' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: l.color }} />
              <span style={{ fontSize: 11, color: '#5a6282' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f1f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={7} style={{ color: '#c0c4d4' }} />
            </div>
            <span style={{ fontSize: 11, color: '#5a6282' }}>Locked — medicals + silicosis required first</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', height: 36, minWidth: 220 }}>
            <Search size={13} style={{ color: '#9aa0b8', flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search driver name or employee no..."
              style={{ border: 'none', outline: 'none', fontSize: 13, color: '#000000', background: 'transparent', width: '100%', fontFamily: "'DM Sans',sans-serif" }} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ height: 36, border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#000000', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}>
            <option value="">All drivers</option>
            <option value="active">Active only</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
          <div style={{ fontSize: 12, color: '#9aa0b8', alignSelf: 'center', marginLeft: 4 }}>
            {filtered.length} driver{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Matrix + detail panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Matrix table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden', minWidth: 'max-content' }}>
            {isLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0b8', fontSize: 13 }}>Loading drivers...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <Users size={28} style={{ color: '#9aa0b8', margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: '#9aa0b8', margin: 0 }}>No drivers found</p>
              </div>
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#F7F6F3' }}>

                    {/* Driver col */}
                    <th style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(5,17,76,0.06)', position: 'sticky', left: 0, background: '#F7F6F3', zIndex: 2, borderRight: '1px solid rgba(5,17,76,0.06)', minWidth: 200 }}>
                      Driver
                    </th>

                    {/* Score col */}
                    <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', borderBottom: '1px solid rgba(5,17,76,0.06)', borderRight: '1px solid rgba(5,17,76,0.04)', whiteSpace: 'nowrap' }}>
                      Score
                    </th>

                    {/* Category cols */}
                    {CATS.map((cat, i) => (
                      <th key={cat.key} style={{
                        padding: '10px 8px', fontSize: 9, fontWeight: 600, color: i < 2 ? '#D97757' : '#9aa0b8',
                        letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'center',
                        borderBottom: '1px solid rgba(5,17,76,0.06)',
                        borderRight: '1px solid rgba(5,17,76,0.03)',
                        borderLeft: i === 2 ? '2px solid rgba(5,17,76,0.08)' : 'none',
                        minWidth: 72, maxWidth: 90, whiteSpace: 'nowrap',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {i < 2 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97757' }} />}
                          {cat.short}
                        </div>
                      </th>
                    ))}
                  </tr>

                  {/* Sub-header for prerequisite indicator */}
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid rgba(5,17,76,0.06)' }}>
                    <td colSpan={2} style={{ padding: '4px 16px', position: 'sticky', left: 0, background: '#fafafa', zIndex: 1, borderRight: '1px solid rgba(5,17,76,0.06)' }}>
                      <span style={{ fontSize: 9, color: '#9aa0b8' }}>● Orange dots = prerequisites</span>
                    </td>
                    {CATS.map((cat, i) => (
                      <td key={cat.key} style={{ padding: '4px 0', textAlign: 'center', borderRight: '1px solid rgba(5,17,76,0.03)', borderLeft: i === 2 ? '2px solid rgba(5,17,76,0.08)' : 'none', background: i < 2 ? 'rgba(217,119,87,0.05)' : 'transparent' }}>
                        {cat.has_expiry && <span style={{ fontSize: 9, color: '#9aa0b8' }}>exp</span>}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(driver => (
                    <DriverRow
                      key={driver.id}
                      driver={driver}
                      categories={categories}
                      isSelected={selected?.id === driver.id}
                      onSelect={() => setSelected(selected?.id === driver.id ? null : driver)}
                      onTick={(d, catName, catId, rec, hasExpiry) => setTickTarget({ driver: d, catName, catId, rec, hasExpiry })}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            driver={selected}
            categories={categories}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {/* Quick-tick modal */}
      {tickTarget && (
        <TickModal
          driver={tickTarget.driver}
          catName={tickTarget.catName}
          categoryId={tickTarget.catId}
          catRecord={tickTarget.rec}
          hasExpiry={tickTarget.hasExpiry}
          onClose={() => setTickTarget(null)}
        />
      )}
    </div>
  )
}