import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import {
  Truck, CheckCircle, AlertTriangle, Clock, X, Plus,
  Wrench, ShieldAlert, ChevronRight, ArrowLeft, User
} from 'lucide-react'
import { can } from '@/lib/permissions'

function statusColor(s: string) {
  return s === 'completed' ? '#1a6b2e' : s === 'overdue' ? '#b33020' : '#c25e00'
}
function statusBg(s: string) {
  return s === 'completed' ? '#e6f4ea' : s === 'overdue' ? '#fdecea' : '#fff3e0'
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 40,
  border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 9,
  padding: '0 12px', fontSize: 13, color: '#05114C',
  background: '#fff', outline: 'none',
  fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500, color: '#05114C', marginBottom: 5
}

// ── Modal wrapper ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(5,17,76,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(5,17,76,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: '#05114C', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} color="#05114C" />
          </button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function ModalButtons({ onCancel, onSubmit, disabled, label }: { onCancel: () => void; onSubmit: () => void; disabled?: boolean; label?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
      <button onClick={onCancel} style={{ height: 42, background: 'rgba(5,17,76,0.06)', color: '#05114C', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
      <button onClick={onSubmit} disabled={disabled} style={{ height: 42, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: disabled ? 0.5 : 1 }}>
        {label ?? 'Save'}
      </button>
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────
function AddLicensingModal({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ item_type: 'insurance', issue_date: '', expiry_date: '', issuer: '', reference_no: '', notes: '' })
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      await api.post(`/maintenance/vehicles/${vehicleId}/licensing`, fd)
      qc.invalidateQueries({ queryKey: ['licensing', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle-compliance', vehicleId] })
      onClose()
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Add licensing item" onClose={onClose}>
      <div>
        <label style={labelStyle}>Item type</label>
        <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))} style={inputStyle}>
          <option value="insurance">Insurance</option>
          <option value="road_tax">Road tax</option>
          <option value="fitness_certificate">Fitness certificate</option>
          <option value="fqm_inspection">FQM inspection</option>
          <option value="zra_sticker">ZRA sticker</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Issue date</label><input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} style={inputStyle} /></div>
        <div><label style={labelStyle}>Expiry date <span style={{ color: '#b33020' }}>*</span></label><input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} style={inputStyle} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Issuer</label><input value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} placeholder="e.g. RTSA" style={inputStyle} /></div>
        <div><label style={labelStyle}>Reference no.</label><input value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} style={inputStyle} /></div>
      </div>
      <ModalButtons onCancel={onClose} onSubmit={submit} disabled={busy || !form.expiry_date} label="Add item" />
    </Modal>
  )
}

function AddChecklistModal({ vehicleId, drivers, onClose }: { vehicleId: string; drivers: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ submission_date: new Date().toISOString().slice(0, 10), driver_id: '', notes: '' })
  const [faults, setFaults] = useState<{ description: string; severity: string }[]>([])
  const [newFault, setNewFault] = useState({ description: '', severity: 'minor' })
  const [busy, setBusy] = useState(false)
  function addFault() {
    if (!newFault.description.trim()) return
    setFaults(f => [...f, { ...newFault }])
    setNewFault({ description: '', severity: 'minor' })
  }
  async function submit() {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('submission_date', form.submission_date)
      if (form.driver_id) fd.append('driver_id', form.driver_id)
      if (form.notes) fd.append('notes', form.notes)
      if (faults.length > 0) fd.append('faults', JSON.stringify(faults))
      await api.post(`/maintenance/vehicles/${vehicleId}/checklists`, fd)
      qc.invalidateQueries({ queryKey: ['checklists', vehicleId] })
      onClose()
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Submit daily checklist" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Date <span style={{ color: '#b33020' }}>*</span></label><input type="date" value={form.submission_date} onChange={e => setForm(f => ({ ...f, submission_date: e.target.value }))} style={inputStyle} /></div>
        <div><label style={labelStyle}>Driver</label>
          <select value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))} style={inputStyle}>
            <option value="">— Select —</option>
            {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>
      </div>
      <div><label style={labelStyle}>Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="General observations..." style={inputStyle} /></div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#05114C', marginBottom: 8 }}>Faults found <span style={{ color: '#9aa0b8', fontWeight: 400 }}>({faults.length})</span></div>
        {faults.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: '#fdecea', borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ flex: 1, fontSize: 12, color: '#b33020' }}>{f.description}</span>
            <span style={{ fontSize: 10, color: '#b33020', fontWeight: 600, textTransform: 'uppercase' }}>{f.severity}</span>
            <button onClick={() => setFaults(fl => fl.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b33020', fontSize: 16 }}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input value={newFault.description} onChange={e => setNewFault(f => ({ ...f, description: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addFault() }} placeholder="Describe fault and press Enter or +" style={{ ...inputStyle, flex: 1 }} />
          <select value={newFault.severity} onChange={e => setNewFault(f => ({ ...f, severity: e.target.value }))} style={{ ...inputStyle, width: 110 }}>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="critical">Critical</option>
          </select>
          <button onClick={addFault} style={{ height: 40, width: 40, background: '#05114C', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={16} /></button>
        </div>
      </div>
      <ModalButtons onCancel={onClose} onSubmit={submit} disabled={busy || !form.submission_date} label="Submit checklist" />
    </Modal>
  )
}

function AddJobCardModal({ vehicleId, users, onClose }: { vehicleId: string; users: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ fault_description: '', severity: 'minor', mechanic_name: '', target_date: '' })
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('fault_description', form.fault_description)
      fd.append('severity', form.severity)
      // Store mechanic and target date in resolution_notes prefix until model is extended
      const meta = [
        form.mechanic_name ? `MECHANIC: ${form.mechanic_name}` : '',
        form.target_date   ? `TARGET: ${form.target_date}`     : '',
      ].filter(Boolean).join(' | ')
      if (meta) fd.append('resolution_notes', meta)
      await api.post(`/maintenance/vehicles/${vehicleId}/job-cards`, fd)
      qc.invalidateQueries({ queryKey: ['job-cards', vehicleId] })
      qc.invalidateQueries({ queryKey: ['all-job-cards'] })
      onClose()
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Open job card" onClose={onClose}>
      <div>
        <label style={labelStyle}>Fault description <span style={{ color: '#b33020' }}>*</span></label>
        <textarea value={form.fault_description} onChange={e => setForm(f => ({ ...f, fault_description: e.target.value }))} placeholder="Describe the fault in detail..." style={{ ...inputStyle, height: 'auto', minHeight: 80, padding: '10px 12px', resize: 'vertical' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Severity</label>
          <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={inputStyle}>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Target completion date</label>
          <input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Assigned mechanic <span style={{ color: '#9aa0b8', fontWeight: 400 }}>(name)</span></label>
        <input value={form.mechanic_name} onChange={e => setForm(f => ({ ...f, mechanic_name: e.target.value }))} placeholder="e.g. Joseph Mwale" style={inputStyle} />
      </div>
      <ModalButtons onCancel={onClose} onSubmit={submit} disabled={busy || !form.fault_description.trim()} label="Open job card" />
    </Modal>
  )
}

function UpdateJobCardModal({ card, onClose }: { card: any; onClose: () => void }) {
  const qc = useQueryClient()
  const existing = card.resolution_notes ?? ''
  const mechMatch   = existing.match(/MECHANIC: ([^|]+)/)
  const targetMatch = existing.match(/TARGET: ([^|]+)/)
  const restNotes   = existing.replace(/MECHANIC: [^|]+\s*\|?\s*/g, '').replace(/TARGET: [^|]+\s*\|?\s*/g, '').trim()
  const [form, setForm] = useState({ status: card.status, mechanic_name: mechMatch ? mechMatch[1].trim() : '', target_date: targetMatch ? targetMatch[1].trim() : '', notes: restNotes })
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('status', form.status)
      const meta = [
        form.mechanic_name ? `MECHANIC: ${form.mechanic_name}` : '',
        form.target_date   ? `TARGET: ${form.target_date}`     : '',
        form.notes         ? form.notes                        : '',
      ].filter(Boolean).join(' | ')
      if (meta) fd.append('resolution_notes', meta)
      await api.patch(`/maintenance/job-cards/${card.id}`, fd)
      qc.invalidateQueries({ queryKey: ['job-cards'] })
      qc.invalidateQueries({ queryKey: ['all-job-cards'] })
      onClose()
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Update job card" onClose={onClose}>
      <div style={{ background: '#F7F6F3', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#05114C' }}>{card.fault_description}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Target date</label>
          <input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Assigned mechanic</label>
        <input value={form.mechanic_name} onChange={e => setForm(f => ({ ...f, mechanic_name: e.target.value }))} placeholder="e.g. Joseph Mwale" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Resolution notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What was done..." style={{ ...inputStyle, height: 'auto', minHeight: 64, padding: '10px 12px', resize: 'vertical' }} />
      </div>
      <ModalButtons onCancel={onClose} onSubmit={submit} disabled={busy} label="Update" />
    </Modal>
  )
}

function AddPlanModal({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ maintenance_type: 'service', description: '', due_date: '', interval_days: '' })
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('maintenance_type', form.maintenance_type)
      if (form.description) fd.append('description', form.description)
      if (form.due_date) fd.append('due_date', form.due_date)
      if (form.interval_days) fd.append('interval_days', form.interval_days)
      await api.post(`/maintenance/vehicles/${vehicleId}/plans`, fd)
      qc.invalidateQueries({ queryKey: ['plans', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle-compliance', vehicleId] })
      onClose()
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Add maintenance plan" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Type <span style={{ color: '#b33020' }}>*</span></label>
          <select value={form.maintenance_type} onChange={e => setForm(f => ({ ...f, maintenance_type: e.target.value }))} style={inputStyle}>
            <option value="service">Service</option>
            <option value="inspection">Inspection</option>
            <option value="greasing">Greasing</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div><label style={labelStyle}>Due date</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} /></div>
      </div>
      <div><label style={labelStyle}>Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. 10,000 km service" style={inputStyle} /></div>
      <div><label style={labelStyle}>Repeat every (days) <span style={{ color: '#9aa0b8', fontWeight: 400 }}>— blank for once-off</span></label><input type="number" value={form.interval_days} onChange={e => setForm(f => ({ ...f, interval_days: e.target.value }))} placeholder="e.g. 90" style={inputStyle} /></div>
      <ModalButtons onCancel={onClose} onSubmit={submit} disabled={busy} label="Add plan" />
    </Modal>
  )
}

function CompletePlanModal({ plan, onClose }: { plan: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    try {
      const fd = new FormData()
      if (notes) fd.append('completion_notes', notes)
      await api.patch(`/maintenance/plans/${plan.id}/complete`, fd)
      qc.invalidateQueries({ queryKey: ['plans'] })
      onClose()
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Mark as completed" onClose={onClose}>
      <div style={{ background: '#F7F6F3', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Plan</div>
        <div style={{ fontSize: 13, color: '#05114C', fontWeight: 500, textTransform: 'capitalize' }}>{plan.maintenance_type} {plan.description ? `— ${plan.description}` : ''}</div>
      </div>
      <div><label style={labelStyle}>Completion notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Parts used, technician name..." style={{ ...inputStyle, height: 'auto', minHeight: 72, padding: '10px 12px', resize: 'vertical' }} /></div>
      <ModalButtons onCancel={onClose} onSubmit={submit} disabled={busy} label="Mark complete" />
    </Modal>
  )
}

function AddTyreModal({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ position: 'front_left', brand: '', size: '', changed_date: new Date().toISOString().slice(0, 10), next_due_date: '', notes: '' })
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      await api.post(`/maintenance/vehicles/${vehicleId}/tyres`, fd)
      qc.invalidateQueries({ queryKey: ['tyres', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle-compliance', vehicleId] })
      onClose()
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Record tyre change" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Position <span style={{ color: '#b33020' }}>*</span></label>
          <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} style={inputStyle}>
            <option value="front_left">Front left</option>
            <option value="front_right">Front right</option>
            <option value="rear_left">Rear left</option>
            <option value="rear_right">Rear right</option>
            <option value="spare">Spare</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div><label style={labelStyle}>Changed date <span style={{ color: '#b33020' }}>*</span></label><input type="date" value={form.changed_date} onChange={e => setForm(f => ({ ...f, changed_date: e.target.value }))} style={inputStyle} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Brand</label><input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Bridgestone" style={inputStyle} /></div>
        <div><label style={labelStyle}>Size</label><input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="e.g. 235/65R16" style={inputStyle} /></div>
      </div>
      <div><label style={labelStyle}>Next due date</label><input type="date" value={form.next_due_date} onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))} style={inputStyle} /></div>
      <ModalButtons onCancel={onClose} onSubmit={submit} disabled={busy || !form.changed_date} label="Record tyre change" />
    </Modal>
  )
}

// ── Empty state ───────────────────────────────────────────────────────
function EmptyState({ message, onAdd, label }: { message: string; onAdd: () => void; label: string }) {
  return (
    <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center' }}>
      <p style={{ fontSize: 13, color: '#9aa0b8', margin: '0 0 14px' }}>{message}</p>
      <button onClick={onAdd} style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Plus size={14} /> {label}
      </button>
    </td></tr>
  )
}

// ── Fleet overview ────────────────────────────────────────────────────
function FleetOverview({ vehicles, onSelectVehicle }: { vehicles: any[]; onSelectVehicle: (id: string) => void }) {

  // Fetch all job cards and plans across fleet
  const { data: allJobCards = [] } = useQuery({
    queryKey: ['all-job-cards'],
    queryFn: async () => {
      const results = await Promise.all(
        vehicles.map(v => api.get(`/maintenance/vehicles/${v.id}/job-cards`).then(r => r.data.map((j: any) => ({ ...j, vehicle: v }))))
      )
      return results.flat()
    },
    enabled: vehicles.length > 0,
  })

  const { data: allPlans = [] } = useQuery({
    queryKey: ['all-plans'],
    queryFn: async () => {
      const results = await Promise.all(
        vehicles.map(v => api.get(`/maintenance/vehicles/${v.id}/plans`).then(r => r.data.map((p: any) => ({ ...p, vehicle: v }))))
      )
      return results.flat()
    },
    enabled: vehicles.length > 0,
  })

  const { data: allLicensing = [] } = useQuery({
    queryKey: ['all-licensing'],
    queryFn: async () => {
      const results = await Promise.all(
        vehicles.map(v => api.get(`/maintenance/vehicles/${v.id}/licensing`).then(r => r.data.map((l: any) => ({ ...l, vehicle: v }))))
      )
      return results.flat()
    },
    enabled: vehicles.length > 0,
  })

  const openJobs       = allJobCards.filter((j: any) => ['open', 'in_progress'].includes(j.status))
  const overduePlans   = allPlans.filter((p: any) => p.status === 'overdue')
  const upcomingPlans  = allPlans.filter((p: any) => p.status === 'upcoming' && p.due_date && (new Date(p.due_date).getTime() - Date.now()) < 30 * 24 * 3600 * 1000)
  const expiredLic     = allLicensing.filter((l: any) => l.expiry_date && new Date(l.expiry_date) < new Date())
  const expiringSoonLic = allLicensing.filter((l: any) => l.expiry_date && new Date(l.expiry_date) > new Date() && (new Date(l.expiry_date).getTime() - Date.now()) < 30 * 24 * 3600 * 1000)

  // Mechanic stats from job cards
  const mechanicStats: Record<string, { name: string; open: number; completed: number }> = {}
  allJobCards.forEach((j: any) => {
    const match = j.resolution_notes?.match(/MECHANIC: ([^|]+)/)
    const name  = match ? match[1].trim() : null
    if (name) {
      if (!mechanicStats[name]) mechanicStats[name] = { name, open: 0, completed: 0 }
      if (['open', 'in_progress'].includes(j.status)) mechanicStats[name].open++
      if (j.status === 'completed') mechanicStats[name].completed++
    }
  })
  const mechanics = Object.values(mechanicStats).sort((a, b) => b.completed - a.completed)

  const thStyle: React.CSSProperties = {
    padding: '8px 14px', fontSize: 10, fontWeight: 600,
    color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase',
    textAlign: 'left', borderBottom: '1px solid rgba(5,17,76,0.06)', whiteSpace: 'nowrap',
  }

  return (
    <div>
      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total vehicles',      value: vehicles.length,        color: '#05114C', bg: 'rgba(5,17,76,0.05)', icon: Truck },
          { label: 'Open job cards',      value: openJobs.length,        color: openJobs.length > 0 ? '#b33020' : '#1a6b2e', bg: openJobs.length > 0 ? '#fdecea' : '#e6f4ea', icon: Wrench },
          { label: 'Overdue maintenance', value: overduePlans.length,    color: overduePlans.length > 0 ? '#b33020' : '#1a6b2e', bg: overduePlans.length > 0 ? '#fdecea' : '#e6f4ea', icon: AlertTriangle },
          { label: 'Licensing issues',    value: expiredLic.length + expiringSoonLic.length, color: (expiredLic.length + expiringSoonLic.length) > 0 ? '#c25e00' : '#1a6b2e', bg: (expiredLic.length + expiringSoonLic.length) > 0 ? '#fff3e0' : '#e6f4ea', icon: ShieldAlert },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.color, opacity: 0.7, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14, marginBottom: 14 }}>

        {/* Open job cards */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(5,17,76,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, color: '#05114C', margin: 0 }}>Open job cards</h3>
              <p style={{ fontSize: 11, color: '#9aa0b8', margin: '2px 0 0' }}>Faults requiring attention</p>
            </div>
            {openJobs.length > 0 && <span style={{ background: '#fdecea', color: '#b33020', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{openJobs.length}</span>}
          </div>
          {openJobs.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <CheckCircle size={24} style={{ color: '#1a6b2e', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>No open job cards</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F7F6F3' }}>
                {['Vehicle','Fault','Mechanic','Severity'].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {openJobs.slice(0, 6).map((j: any) => {
                  const mechMatch = j.resolution_notes?.match(/MECHANIC: ([^|]+)/)
                  const mechName  = mechMatch ? mechMatch[1].trim() : null
                  return (
                    <tr key={j.id} style={{ borderBottom: '1px solid rgba(5,17,76,0.04)', cursor: 'pointer' }}
                      onClick={() => onSelectVehicle(j.vehicle.id)}>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#05114C', whiteSpace: 'nowrap' }}>{j.vehicle.reg_plate}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#3d4466', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.fault_description}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: mechName ? '#05114C' : '#c0c4d4' }}>
                        {mechName ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={10}/>{mechName}</span> : 'Unassigned'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: j.severity === 'critical' ? '#b33020' : j.severity === 'moderate' ? '#c25e00' : '#2044b0' }}>{j.severity}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Overdue / upcoming maintenance */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(5,17,76,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, color: '#05114C', margin: 0 }}>Maintenance due</h3>
              <p style={{ fontSize: 11, color: '#9aa0b8', margin: '2px 0 0' }}>Overdue + due within 30 days</p>
            </div>
            {(overduePlans.length + upcomingPlans.length) > 0 && (
              <span style={{ background: '#fff3e0', color: '#c25e00', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                {overduePlans.length + upcomingPlans.length}
              </span>
            )}
          </div>
          {overduePlans.length + upcomingPlans.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <CheckCircle size={24} style={{ color: '#1a6b2e', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>All maintenance up to date</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F7F6F3' }}>
                {['Vehicle','Type','Due date','Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[...overduePlans, ...upcomingPlans].slice(0, 6).map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(5,17,76,0.04)', cursor: 'pointer' }}
                    onClick={() => onSelectVehicle(p.vehicle.id)}>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#05114C', whiteSpace: 'nowrap' }}>{p.vehicle.reg_plate}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#3d4466', textTransform: 'capitalize' }}>{p.maintenance_type}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: p.status === 'overdue' ? '#b33020' : '#c25e00', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {p.due_date ? new Date(p.due_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: statusBg(p.status), color: statusColor(p.status), fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>

        {/* Licensing expiry alerts */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(5,17,76,0.06)' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, color: '#05114C', margin: 0 }}>Licensing alerts</h3>
            <p style={{ fontSize: 11, color: '#9aa0b8', margin: '2px 0 0' }}>Expired or expiring within 30 days</p>
          </div>
          {expiredLic.length + expiringSoonLic.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <CheckCircle size={24} style={{ color: '#1a6b2e', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>All licensing current</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F7F6F3' }}>
                {['Vehicle','Item','Expiry','Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[...expiredLic, ...expiringSoonLic].slice(0, 6).map((l: any) => {
                  const expired = new Date(l.expiry_date) < new Date()
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid rgba(5,17,76,0.04)', cursor: 'pointer' }}
                      onClick={() => onSelectVehicle(l.vehicle.id)}>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#05114C', whiteSpace: 'nowrap' }}>{l.vehicle.reg_plate}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#3d4466', textTransform: 'capitalize' }}>{l.item_type.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: expired ? '#b33020' : '#c25e00', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {new Date(l.expiry_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: expired ? '#fdecea' : '#fff3e0', color: expired ? '#b33020' : '#c25e00', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>
                          {expired ? 'Expired' : 'Expiring'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mechanic performance */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(5,17,76,0.06)' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, color: '#05114C', margin: 0 }}>Mechanic activity</h3>
            <p style={{ fontSize: 11, color: '#9aa0b8', margin: '2px 0 0' }}>Jobs completed vs open per mechanic</p>
          </div>
          {mechanics.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <Wrench size={24} style={{ color: '#9aa0b8', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>No mechanic data yet — assign mechanics when opening job cards</p>
            </div>
          ) : (
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mechanics.map(m => {
                const total = m.open + m.completed
                const pct   = total > 0 ? Math.round((m.completed / total) * 100) : 0
                return (
                  <div key={m.name}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#05114C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 10, color: '#fff' }}>
                            {m.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#05114C' }}>{m.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9aa0b8' }}>
                        <span style={{ color: '#1a6b2e', fontWeight: 600 }}>{m.completed}</span> done · <span style={{ color: m.open > 0 ? '#c25e00' : '#9aa0b8', fontWeight: m.open > 0 ? 600 : 400 }}>{m.open}</span> open
                      </div>
                    </div>
                    <div style={{ height: 5, background: '#f1f3f8', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#1a6b2e' : pct >= 50 ? '#e6a817' : '#b33020', borderRadius: 3, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Vehicle list */}
      <div style={{ marginTop: 14, background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(5,17,76,0.06)' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, color: '#05114C', margin: 0 }}>All vehicles — click to view details</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, padding: 14 }}>
          {vehicles.map(v => (
            <button
              key={v.id}
              onClick={() => onSelectVehicle(v.id)}
              style={{ background: '#F7F6F3', border: '1px solid rgba(5,17,76,0.08)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: "'DM Sans',sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background = '#05114C'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F7F6F3'; e.currentTarget.style.color = 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Truck size={13} />
                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700 }}>{v.reg_plate}</span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.65 }}>{v.make} {v.model} · {v.year}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [activeTab, setActiveTab] = useState<'licensing' | 'checklists' | 'jobcards' | 'plans' | 'tyres'>('licensing')
  const [modal, setModal] = useState<'licensing' | 'checklist' | 'jobcard' | 'plan' | 'tyre' | { type: 'update-job'; card: any } | { type: 'complete-plan'; plan: any } | null>(null)
  const qc = useQueryClient()

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => api.get('/vehicles').then(r => r.data) })
  const { data: drivers  = [] } = useQuery({ queryKey: ['drivers'],  queryFn: () => api.get('/drivers').then(r => r.data) })
  const { data: users    = [] } = useQuery({ queryKey: ['users'],    queryFn: () => api.get('/auth/users').then(r => r.data).catch(() => []) })

  const { data: licensing  = [] } = useQuery({ queryKey: ['licensing',  selectedVehicle], queryFn: () => selectedVehicle ? api.get(`/maintenance/vehicles/${selectedVehicle}/licensing`).then(r => r.data)  : [], enabled: !!selectedVehicle })
  const { data: checklists = [] } = useQuery({ queryKey: ['checklists', selectedVehicle], queryFn: () => selectedVehicle ? api.get(`/maintenance/vehicles/${selectedVehicle}/checklists`).then(r => r.data) : [], enabled: !!selectedVehicle })
  const { data: jobCards   = [] } = useQuery({ queryKey: ['job-cards',  selectedVehicle], queryFn: () => selectedVehicle ? api.get(`/maintenance/vehicles/${selectedVehicle}/job-cards`).then(r => r.data)  : [], enabled: !!selectedVehicle })
  const { data: plans      = [] } = useQuery({ queryKey: ['plans',      selectedVehicle], queryFn: () => selectedVehicle ? api.get(`/maintenance/vehicles/${selectedVehicle}/plans`).then(r => r.data)      : [], enabled: !!selectedVehicle })
  const { data: tyres      = [] } = useQuery({ queryKey: ['tyres',      selectedVehicle], queryFn: () => selectedVehicle ? api.get(`/maintenance/vehicles/${selectedVehicle}/tyres`).then(r => r.data)      : [], enabled: !!selectedVehicle })
  const { data: score           } = useQuery({ queryKey: ['vehicle-compliance', selectedVehicle], queryFn: () => selectedVehicle ? api.get(`/maintenance/vehicles/${selectedVehicle}/compliance-score`).then(r => r.data) : null, enabled: !!selectedVehicle })

  const selectedVehicleData = vehicles.find((v: any) => v.id === selectedVehicle)

  const tabs = [
    { key: 'licensing'  as const, label: 'Licensing'           },
    { key: 'checklists' as const, label: 'Checklists'          },
    { key: 'jobcards'   as const, label: 'Job cards'           },
    { key: 'plans'      as const, label: 'Planned maintenance' },
    { key: 'tyres'      as const, label: 'Tyres'               },
  ]

  const thStyle: React.CSSProperties = {
    padding: '9px 14px', fontSize: 10, fontWeight: 600,
    color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase',
    textAlign: 'left', borderBottom: '1px solid rgba(5,17,76,0.06)', whiteSpace: 'nowrap',
  }

  const addButtons: Record<string, { label: string; action: () => void }> = {
    licensing:  { label: 'Add licensing item',   action: () => setModal('licensing')  },
    checklists: { label: 'Submit checklist',      action: () => setModal('checklist')  },
    jobcards:   { label: 'Open job card',         action: () => setModal('jobcard')    },
    plans:      { label: 'Add maintenance plan',  action: () => setModal('plan')       },
    tyres:      { label: 'Record tyre change',    action: () => setModal('tyre')       },
  }

  return (
    <div style={{ padding: '24px 28px 40px', width: '100%', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selectedVehicle && (
            <button onClick={() => setSelectedVehicle('')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#05114C', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              <ArrowLeft size={13} /> Fleet overview
            </button>
          )}
          <div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: '#05114C', letterSpacing: '-0.02em', margin: '0 0 3px' }}>
              {selectedVehicleData ? `${selectedVehicleData.reg_plate} — ${selectedVehicleData.make} ${selectedVehicleData.model}` : 'Vehicle Maintenance'}
            </h1>
            <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>
              {selectedVehicle ? 'Licensing, checklists, job cards, planned maintenance and tyres' : 'Fleet maintenance overview — select a vehicle for full details'}
            </p>
          </div>
        </div>

        {/* Vehicle selector always visible */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#05114C', marginBottom: 5 }}>Jump to vehicle</label>
          <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
            style={{ height: 38, border: '1.5px solid rgba(5,17,76,0.14)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#05114C', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif", minWidth: 220 }}>
            <option value="">— Choose a vehicle —</option>
            {vehicles.map((v: any) => (
              <option key={v.id} value={v.id}>{v.reg_plate} — {v.make} {v.model}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── State 1: Fleet overview ── */}
      {!selectedVehicle && (
        vehicles.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', padding: '60px', textAlign: 'center' }}>
            <Truck size={32} style={{ color: '#9aa0b8', margin: '0 auto 10px', display: 'block' }} />
            <p style={{ fontSize: 13, color: '#9aa0b8', margin: 0 }}>No vehicles registered yet. Add vehicles in the Fleet page first.</p>
          </div>
        ) : (
          <FleetOverview vehicles={vehicles} onSelectVehicle={setSelectedVehicle} />
        )
      )}

      {/* ── State 2: Vehicle detail ── */}
      {selectedVehicle && (
        <>
          {/* Compliance score strip */}
          {score && (
            <div style={{
              background: score.status === 'compliant' ? '#e6f4ea' : score.status === 'warning' ? '#fff3e0' : '#fdecea',
              border: `1px solid ${score.status === 'compliant' ? '#b7dfbf' : score.status === 'warning' ? '#fcd9a0' : '#f5c6c2'}`,
              borderRadius: 12, padding: '14px 20px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {score.status === 'compliant'
                  ? <CheckCircle size={18} style={{ color: '#1a6b2e' }} />
                  : <AlertTriangle size={18} style={{ color: score.status === 'warning' ? '#c25e00' : '#b33020' }} />}
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 14, color: score.status === 'compliant' ? '#1a6b2e' : score.status === 'warning' ? '#c25e00' : '#b33020' }}>
                  Compliance score: {score.score}% {score.critical_override && '— CRITICAL OVERRIDE'}
                </span>
              </div>
              {score.issues?.length > 0 && (
                <div style={{ flex: 1, fontSize: 12, color: score.status === 'compliant' ? '#1a6b2e' : score.status === 'warning' ? '#c25e00' : '#b33020' }}>
                  {score.issues.slice(0, 3).join(' · ')}{score.issues.length > 3 ? ` +${score.issues.length - 3} more` : ''}
                </div>
              )}
            </div>
          )}

          {/* Tabs + add button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 2, background: '#fff', borderRadius: 10, border: '1px solid rgba(5,17,76,0.08)', padding: 4 }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ padding: '7px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: activeTab === t.key ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", background: activeTab === t.key ? '#05114C' : 'transparent', color: activeTab === t.key ? '#fff' : '#5a6282', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  {t.label}
                </button>
              ))}
            </div>
            {can('maintenance', 'edit') && (<button onClick={addButtons[activeTab].action}
              style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> {addButtons[activeTab].label}
            </button>)}
          </div>

          {/* Tab content */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>

            {activeTab === 'licensing' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F7F6F3' }}>
                  {['Item','Critical','Issue date','Expiry date','Issuer','Reference','Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {licensing.length === 0
                    ? <EmptyState message="No licensing items recorded yet." onAdd={() => setModal('licensing')} label="Add licensing item" />
                    : licensing.map((item: any) => {
                        const expired = item.expiry_date && new Date(item.expiry_date) < new Date()
                        const soon    = item.expiry_date && !expired && (new Date(item.expiry_date).getTime() - Date.now()) < 30 * 24 * 3600 * 1000
                        const sl = expired ? 'Expired' : soon ? 'Expiring soon' : 'Current'
                        const sc = expired ? '#b33020' : soon ? '#c25e00' : '#1a6b2e'
                        const sb = expired ? '#fdecea' : soon ? '#fff3e0' : '#e6f4ea'
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(5,17,76,0.04)' }}>
                            <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#05114C', textTransform: 'capitalize' }}>{item.item_type.replace(/_/g, ' ')}</td>
                            <td style={{ padding: '12px 14px' }}>{item.is_critical ? <span style={{ background: '#fdecea', color: '#b33020', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>Critical</span> : <span style={{ background: '#f1f3f8', color: '#5a6282', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>Standard</span>}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#9aa0b8' }}>{item.issue_date ? new Date(item.issue_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: expired ? '#b33020' : '#5a6282', fontWeight: expired ? 600 : 400 }}>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#9aa0b8' }}>{item.issuer ?? '—'}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#9aa0b8' }}>{item.reference_no ?? '—'}</td>
                            <td style={{ padding: '12px 14px' }}><span style={{ background: sb, color: sc, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sl}</span></td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            )}

            {activeTab === 'checklists' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F7F6F3' }}>
                  {['Date','Driver','Faults','Scan attached','Notes'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {checklists.length === 0
                    ? <EmptyState message="No checklists submitted yet." onAdd={() => setModal('checklist')} label="Submit checklist" />
                    : checklists.map((c: any) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(5,17,76,0.04)' }}>
                          <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#05114C' }}>{new Date(c.submission_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#5a6282' }}>{c.driver_id ? drivers.find((d: any) => d.id === c.driver_id)?.full_name ?? c.driver_id.slice(0, 8) : '—'}</td>
                          <td style={{ padding: '12px 14px' }}>{c.has_faults ? <span style={{ background: '#fdecea', color: '#b33020', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>Yes</span> : <span style={{ background: '#e6f4ea', color: '#1a6b2e', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>No faults</span>}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: c.scan_file_name ? '#D97757' : '#9aa0b8' }}>{c.scan_file_name ?? 'No scan'}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#9aa0b8' }}>{c.notes ?? '—'}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            )}

            {activeTab === 'jobcards' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F7F6F3' }}>
                  {['Fault description','Mechanic','Severity','Status','Opened','Target date',''].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {jobCards.length === 0
                    ? <EmptyState message="No job cards yet." onAdd={() => setModal('jobcard')} label="Open job card" />
                    : jobCards.map((j: any) => {
                        const mechMatch   = j.resolution_notes?.match(/MECHANIC: ([^|]+)/)
                        const targetMatch = j.resolution_notes?.match(/TARGET: ([^|]+)/)
                        const mechName    = mechMatch   ? mechMatch[1].trim()   : null
                        const targetDate  = targetMatch ? targetMatch[1].trim() : null
                        const isOverdue   = targetDate && new Date(targetDate) < new Date() && !['completed','cancelled'].includes(j.status)
                        return (
                          <tr key={j.id} style={{ borderBottom: '1px solid rgba(5,17,76,0.04)' }}>
                            <td style={{ padding: '12px 14px', fontSize: 13, color: '#05114C', maxWidth: 220 }}>{j.fault_description}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12 }}>
                              {mechName
                                ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#05114C' }}><User size={11} style={{ color: '#9aa0b8' }}/>{mechName}</span>
                                : <span style={{ color: '#c0c4d4', fontSize: 11 }}>Unassigned</span>}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: j.severity === 'critical' ? '#b33020' : j.severity === 'moderate' ? '#c25e00' : '#2044b0' }}>{j.severity}</td>
                            <td style={{ padding: '12px 14px' }}><span style={{ background: statusBg(j.status), color: statusColor(j.status), fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{j.status.replace('_', ' ')}</span></td>
                            <td style={{ padding: '12px 14px', fontSize: 11, color: '#9aa0b8', whiteSpace: 'nowrap' }}>{new Date(j.created_at).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, whiteSpace: 'nowrap', color: isOverdue ? '#b33020' : '#5a6282', fontWeight: isOverdue ? 600 : 400 }}>
                              {targetDate ? new Date(targetDate).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                              {isOverdue && <span style={{ marginLeft: 6, fontSize: 10, background: '#fdecea', color: '#b33020', padding: '1px 6px', borderRadius: 10 }}>Overdue</span>}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {!['completed','cancelled'].includes(j.status) && (
                                <button onClick={() => setModal({ type: 'update-job', card: j })} style={{ fontSize: 11, color: '#05114C', background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Update</button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            )}

            {activeTab === 'plans' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F7F6F3' }}>
                  {['Type','Description','Due date','Interval','Last done','Status',''].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {plans.length === 0
                    ? <EmptyState message="No maintenance plans yet." onAdd={() => setModal('plan')} label="Add maintenance plan" />
                    : plans.map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(5,17,76,0.04)' }}>
                          <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#05114C', textTransform: 'capitalize' }}>{p.maintenance_type}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#5a6282' }}>{p.description ?? '—'}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: p.status === 'overdue' ? '#b33020' : '#5a6282', fontWeight: p.status === 'overdue' ? 600 : 400 }}>{p.due_date ? new Date(p.due_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#9aa0b8' }}>{p.interval_days ? `Every ${p.interval_days} days` : 'Once-off'}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#9aa0b8' }}>{p.last_done_date ? new Date(p.last_done_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td style={{ padding: '12px 14px' }}><span style={{ background: statusBg(p.status), color: statusColor(p.status), fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.status}</span></td>
                          <td style={{ padding: '12px 14px' }}>
                            {p.status !== 'completed' && (
                              <button onClick={() => setModal({ type: 'complete-plan', plan: p })} style={{ fontSize: 11, color: '#1a6b2e', background: '#e6f4ea', border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>Mark done</button>
                            )}
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            )}

            {activeTab === 'tyres' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F7F6F3' }}>
                  {['Position','Brand','Size','Changed','Next due','Notes'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {tyres.length === 0
                    ? <EmptyState message="No tyre records yet." onAdd={() => setModal('tyre')} label="Record tyre change" />
                    : tyres.map((t: any) => {
                        const overdue = t.next_due_date && new Date(t.next_due_date) < new Date()
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid rgba(5,17,76,0.04)' }}>
                            <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#05114C', textTransform: 'capitalize' }}>{t.position.replace(/_/g, ' ')}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#5a6282' }}>{t.brand ?? '—'}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#9aa0b8' }}>{t.size ?? '—'}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#5a6282' }}>{new Date(t.changed_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: overdue ? '#b33020' : '#5a6282', fontWeight: overdue ? 600 : 400 }}>
                              {t.next_due_date ? new Date(t.next_due_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                              {overdue && <span style={{ marginLeft: 6, fontSize: 10, background: '#fdecea', color: '#b33020', padding: '1px 6px', borderRadius: 10 }}>Overdue</span>}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#9aa0b8' }}>{t.notes ?? '—'}</td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {modal === 'licensing'  && <AddLicensingModal  vehicleId={selectedVehicle} onClose={() => setModal(null)} />}
      {modal === 'checklist'  && <AddChecklistModal  vehicleId={selectedVehicle} drivers={drivers} onClose={() => setModal(null)} />}
      {modal === 'jobcard'    && <AddJobCardModal    vehicleId={selectedVehicle} users={users} onClose={() => setModal(null)} />}
      {modal === 'plan'       && <AddPlanModal       vehicleId={selectedVehicle} onClose={() => setModal(null)} />}
      {modal === 'tyre'       && <AddTyreModal       vehicleId={selectedVehicle} onClose={() => setModal(null)} />}
      {typeof modal === 'object' && modal?.type === 'update-job'    && <UpdateJobCardModal card={modal.card} onClose={() => setModal(null)} />}
      {typeof modal === 'object' && modal?.type === 'complete-plan' && <CompletePlanModal  plan={modal.plan} onClose={() => setModal(null)} />}
    </div>
  )
}