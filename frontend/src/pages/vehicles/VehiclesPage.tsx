import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Truck, Search, X, ChevronRight } from 'lucide-react'
import { can } from '@/lib/permissions'

interface Vehicle {
  id: string
  fleet_no: string | null
  reg_plate: string
  make: string
  model: string
  year: number
  colour: string | null
  capacity: number | null
  status: 'active' | 'grounded' | 'maintenance'
  notes: string | null
  created_at: string
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:      { bg: '#e6f4ea', color: '#1a6b2e' },
    grounded:    { bg: '#fdecea', color: '#b33020' },
    maintenance: { bg: '#fff3e0', color: '#c25e00' },
  }
  const c = cfg[status] ?? { bg: '#f1f3f8', color: '#5a6282' }
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function DetailPanel({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    fleet_no: vehicle.fleet_no  ?? '',
    make:     vehicle.make,
    model:    vehicle.model,
    year:     String(vehicle.year),
    colour:   vehicle.colour   ?? '',
    capacity: vehicle.capacity ? String(vehicle.capacity) : '',
    status:   vehicle.status,
    notes:    vehicle.notes    ?? '',
  })

  async function save() {
    setBusy(true)
    try {
      await api.patch(`/vehicles/${vehicle.id}`, {
        ...form,
        fleet_no: form.fleet_no || null,
        year:     parseInt(form.year),
        capacity: form.capacity ? parseInt(form.capacity) : null,
      })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      setEditing(false)
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteVehicle() {
    if (!confirm(`Delete ${vehicle.reg_plate}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api.delete(`/vehicles/${vehicle.id}`)
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      onClose()
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Delete failed')
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
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500, color: '#000000', marginBottom: 4
  }

  return (
    <div style={{ width: 380, flexShrink: 0, background: '#fff', borderLeft: '1px solid rgba(5,17,76,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(5,17,76,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Truck size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: '#000000', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {vehicle.fleet_no && (
                <span style={{ color: '#D97757' }}>{vehicle.fleet_no}</span>
              )}
              {vehicle.fleet_no && <span style={{ color: 'rgba(5,17,76,0.2)', fontWeight: 400 }}>·</span>}
              {vehicle.reg_plate}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#9aa0b8' }}>{vehicle.make} {vehicle.model} · {vehicle.year}</span>
              <StatusPill status={vehicle.status} />
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(5,17,76,0.05)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <X size={14} color="#000000" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        {!editing ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Fleet no.',  value: vehicle.fleet_no ?? '—' },
                { label: 'Reg plate',  value: vehicle.reg_plate },
                { label: 'Make',       value: vehicle.make },
                { label: 'Model',      value: vehicle.model },
                { label: 'Year',       value: String(vehicle.year) },
                { label: 'Colour',     value: vehicle.colour   ?? '—' },
                { label: 'Capacity',   value: vehicle.capacity ? `${vehicle.capacity} seats` : '—' },
                { label: 'Status',     value: vehicle.status },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#F7F6F3', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#000000', textTransform: label === 'Status' ? 'capitalize' : 'none' }}>{value}</div>
                </div>
              ))}
            </div>

            {vehicle.notes && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 13, color: '#3d4466', lineHeight: 1.6, background: '#F7F6F3', borderRadius: 8, padding: '12px 14px' }}>{vehicle.notes}</div>
              </div>
            )}

            {can('fleet', 'edit') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => setEditing(true)}
                  style={{ width: '100%', height: 40, background: 'rgba(5,17,76,0.05)', color: '#000000', border: '1px solid rgba(5,17,76,0.1)', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  Edit vehicle
                </button>
                <button onClick={deleteVehicle} disabled={busy}
                  style={{ width: '100%', height: 40, background: '#fdecea', color: '#b33020', border: '1px solid #f5c6c2', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", opacity: busy ? 0.6 : 1 }}>
                  Delete vehicle
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Edit vehicle</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Fleet number</label>
                <input value={form.fleet_no} onChange={e => setForm(f => ({ ...f, fleet_no: e.target.value }))} placeholder="e.g. Q101" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Reg plate</label>
                <input value={vehicle.reg_plate} disabled style={{ ...inputStyle, background: '#F7F6F3', color: '#9aa0b8' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Make</label>
                <input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Year</label>
                <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Colour</label>
                <input value={form.colour} onChange={e => setForm(f => ({ ...f, colour: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Capacity (seats)</label>
                <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="grounded">Grounded</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ ...inputStyle, height: 'auto', minHeight: 72, padding: '8px 10px', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 4 }}>
              <button onClick={() => setEditing(false)} style={{ height: 40, background: 'rgba(5,17,76,0.06)', color: '#000000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                Cancel
              </button>
              <button onClick={save} disabled={busy} style={{ height: 40, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VehiclesPage() {
  const [selected, setSelected]         = useState<Vehicle | null>(null)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [newForm, setNewForm] = useState({
    fleet_no: '', reg_plate: '', make: '', model: '', year: '',
    colour: '', capacity: '', status: 'active', notes: ''
  })
  const qc = useQueryClient()

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn:  () => api.get('/vehicles').then(r => r.data),
  })

  const filtered = vehicles.filter((v: Vehicle) => {
    const matchSearch = !search
      || v.reg_plate.toLowerCase().includes(search.toLowerCase())
      || v.make.toLowerCase().includes(search.toLowerCase())
      || v.model.toLowerCase().includes(search.toLowerCase())
      || (v.fleet_no ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || v.status === filterStatus
    return matchSearch && matchStatus
  })

  const counts = {
    total:       vehicles.length,
    active:      vehicles.filter((v: Vehicle) => v.status === 'active').length,
    grounded:    vehicles.filter((v: Vehicle) => v.status === 'grounded').length,
    maintenance: vehicles.filter((v: Vehicle) => v.status === 'maintenance').length,
  }

  async function createVehicle() {
    if (!newForm.reg_plate || !newForm.make || !newForm.model || !newForm.year) {
      alert('Reg plate, make, model and year are required.')
      return
    }
    try {
      await api.post('/vehicles', {
        ...newForm,
        fleet_no: newForm.fleet_no || null,
        year:     parseInt(newForm.year),
        capacity: newForm.capacity ? parseInt(newForm.capacity) : null,
      })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      setShowCreate(false)
      setNewForm({ fleet_no: '', reg_plate: '', make: '', model: '', year: '', colour: '', capacity: '', status: 'active', notes: '' })
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Failed to add vehicle')
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: '#000000', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Fleet</h1>
              <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>{vehicles.length} vehicles registered</p>
            </div>
            {can('fleet', 'edit') && (
              <button onClick={() => setShowCreate(true)}
                style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer' }}>
                + Add vehicle
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total fleet',  value: counts.total,       color: '#000000', bg: 'rgba(5,17,76,0.05)', key: '' },
              { label: 'Active',       value: counts.active,      color: '#1a6b2e', bg: '#e6f4ea',            key: 'active' },
              { label: 'Grounded',     value: counts.grounded,    color: '#b33020', bg: '#fdecea',            key: 'grounded' },
              { label: 'Maintenance',  value: counts.maintenance, color: '#c25e00', bg: '#fff3e0',            key: 'maintenance' },
            ].map(s => (
              <div key={s.label}
                onClick={() => setFilterStatus(filterStatus === s.key ? '' : s.key)}
                style={{ background: s.bg, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', outline: filterStatus === s.key && s.key ? `2px solid ${s.color}` : 'none' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, opacity: 0.7, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', height: 38 }}>
              <Search size={13} style={{ color: '#9aa0b8', flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search fleet no., reg plate, make or model..."
                style={{ border: 'none', outline: 'none', fontSize: 13, color: '#000000', background: 'transparent', width: '100%', fontFamily: "'DM Sans',sans-serif" }} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ height: 38, border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#000000', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="grounded">Grounded</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0b8', fontSize: 13 }}>Loading fleet...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <Truck size={28} style={{ color: '#9aa0b8', margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: '#9aa0b8', margin: '0 0 16px' }}>
                  {search || filterStatus ? 'No vehicles match your search.' : 'No vehicles added yet.'}
                </p>
                {!search && !filterStatus && can('fleet', 'edit') && (
                  <button onClick={() => setShowCreate(true)}
                    style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, padding: '0 20px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer' }}>
                    + Add your first vehicle
                  </button>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F6F3' }}>
                    {['Fleet / Reg', 'Make / Model', 'Year', 'Colour', 'Capacity', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(5,17,76,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v: Vehicle) => {
                    const isSelected = selected?.id === v.id
                    return (
                      <tr key={v.id}
                        onClick={() => setSelected(isSelected ? null : v)}
                        style={{ borderBottom: '1px solid rgba(5,17,76,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(5,17,76,0.03)' : 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (!isSelected)(e.currentTarget as HTMLElement).style.background = 'rgba(5,17,76,0.02)' }}
                        onMouseLeave={e => { if (!isSelected)(e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        {/* Fleet no. + Reg plate combined */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: isSelected ? '#D97757' : '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                              <Truck size={15} color="#fff" />
                            </div>
                            <div>
                              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: '#D97757' }}>
                                {v.fleet_no ?? '—'}
                              </div>
                              <div style={{ fontSize: 11, color: '#9aa0b8', marginTop: 1 }}>
                                {v.reg_plate}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: '#5a6282' }}>{v.make} {v.model}</td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: '#9aa0b8' }}>{v.year}</td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: '#9aa0b8' }}>{v.colour ?? '—'}</td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: '#9aa0b8' }}>{v.capacity ? `${v.capacity} seats` : '—'}</td>
                        <td style={{ padding: '13px 16px' }}><StatusPill status={v.status} /></td>
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

      {selected && <DetailPanel vehicle={selected} onClose={() => setSelected(null)} />}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,17,76,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(5,17,76,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: '#000000', margin: 0 }}>Add new vehicle</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color="#000000" />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Fleet number</label>
                  <input value={newForm.fleet_no} onChange={e => setNewForm(f => ({ ...f, fleet_no: e.target.value }))}
                    placeholder="e.g. Q101" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Registration plate <span style={{ color: '#b33020' }}>*</span></label>
                  <input value={newForm.reg_plate} onChange={e => setNewForm(f => ({ ...f, reg_plate: e.target.value.toUpperCase() }))}
                    placeholder="e.g. BAA 1234 ZM" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Make <span style={{ color: '#b33020' }}>*</span></label>
                  <input value={newForm.make} onChange={e => setNewForm(f => ({ ...f, make: e.target.value }))} placeholder="e.g. Toyota" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Model <span style={{ color: '#b33020' }}>*</span></label>
                  <input value={newForm.model} onChange={e => setNewForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. Coaster" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Year <span style={{ color: '#b33020' }}>*</span></label>
                  <input type="number" value={newForm.year} onChange={e => setNewForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. 2020" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Colour</label>
                  <input value={newForm.colour} onChange={e => setNewForm(f => ({ ...f, colour: e.target.value }))} placeholder="e.g. White" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Capacity</label>
                  <input type="number" value={newForm.capacity} onChange={e => setNewForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Seats" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select value={newForm.status} onChange={e => setNewForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="grounded">Grounded</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes about this vehicle..."
                  style={{ ...inputStyle, height: 'auto', minHeight: 72, padding: '10px 12px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
                <button onClick={() => setShowCreate(false)}
                  style={{ height: 42, background: 'rgba(5,17,76,0.06)', color: '#000000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  Cancel
                </button>
                <button onClick={createVehicle} disabled={!newForm.reg_plate || !newForm.make || !newForm.model || !newForm.year}
                  style={{ height: 42, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (!newForm.reg_plate || !newForm.make || !newForm.model || !newForm.year) ? 0.5 : 1 }}>
                  Add vehicle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}