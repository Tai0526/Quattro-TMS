import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useRef } from 'react'
import { getRole } from '@/lib/permissions'
import {
  AlertTriangle, X, ChevronRight, Clock, Search,
  CheckCircle, XCircle, Send, ShieldCheck, User,
  Truck, MapPin, Upload, FileText, Lock, Plus,
  Eye, Filter, Trash2
} from 'lucide-react'

interface Incident {
  id: string
  incident_type: string
  vehicle_id: string | null
  driver_id: string | null
  event_datetime: string
  severity: string
  description: string
  location: string | null
  status: string
  outcome: string | null
  rejection_reason: string | null
  submitted_at: string | null
  manager_reviewed_at: string | null
  ops_reviewed_at: string | null
  closed_at: string | null
  created_at: string
}

const SEVERITY_COLOR: Record<string, string> = {
  low: '#1a6b2e', medium: '#2044b0', high: '#c25e00', critical: '#b33020',
}
const SEVERITY_BG: Record<string, string> = {
  low: '#e6f4ea', medium: '#e8eeff', high: '#fff3e0', critical: '#fdecea',
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  draft:          { bg: '#f1f3f8', color: '#5a6282', label: 'Draft'           },
  submitted:      { bg: '#e8eeff', color: '#2044b0', label: 'Submitted'       },
  manager_review: { bg: '#fff3e0', color: '#c25e00', label: 'Manager review'  },
  ops_review:     { bg: '#faeeda', color: '#854F0B', label: 'Ops review'      },
  closed:         { bg: '#e6f4ea', color: '#1a6b2e', label: 'Closed'          },
  rejected:       { bg: '#fdecea', color: '#b33020', label: 'Rejected'        },
}

const STATUS_STEPS = [
  { key: 'draft',     label: 'Draft'     },
  { key: 'submitted', label: 'Submitted' },
  { key: 'ops_review',label: 'Ops review'},
  { key: 'closed',    label: 'Closed'    },
]

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { bg: '#f1f3f8', color: '#5a6282', label: status }
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span style={{ background: SEVERITY_BG[severity] ?? '#f1f3f8', color: SEVERITY_COLOR[severity] ?? '#5a6282', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {severity}
    </span>
  )
}

function ProgressBar({ status }: { status: string }) {
  const isRejected = status === 'rejected'
  const steps = STATUS_STEPS
  const idx = steps.findIndex(s => s.key === status)
  const effectiveIdx = isRejected ? 1 : idx

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((step, i) => {
          const done    = i < effectiveIdx || (status === 'closed' && i <= effectiveIdx)
          const current = i === effectiveIdx && !isRejected
          const color   = done ? '#1a6b2e' : current ? '#05114C' : '#e0e3ef'
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {done ? <CheckCircle size={12} color="#fff" />
                    : <div style={{ width: 7, height: 7, borderRadius: '50%', background: current ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                  }
                </div>
                <span style={{ fontSize: 9, fontWeight: 500, color: current || done ? '#05114C' : '#9aa0b8', whiteSpace: 'nowrap' }}>{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < effectiveIdx ? '#1a6b2e' : '#e0e3ef', margin: '0 4px', marginBottom: 16 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Status label with context */}
      {isRejected && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#fdecea', borderRadius: 8, fontSize: 12, color: '#b33020', fontWeight: 500 }}>
          ✗ Rejected by manager — returned to reporter for correction
        </div>
      )}
      {status === 'submitted' && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#e8eeff', borderRadius: 8, fontSize: 12, color: '#2044b0' }}>
          ⏳ Submitted — awaiting manager review
        </div>
      )}
      {status === 'ops_review' && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#faeeda', borderRadius: 8, fontSize: 12, color: '#854F0B' }}>
          ✓ Manager approved — awaiting operations manager closure
        </div>
      )}
      {status === 'closed' && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#e6f4ea', borderRadius: 8, fontSize: 12, color: '#1a6b2e' }}>
          ✓ Closed by operations manager
        </div>
      )}
    </div>
  )
}

// ── Documents section ─────────────────────────────────────────────────
function DocumentsSection({ incidentId, canUpload }: { incidentId: string; canUpload: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState('')
  const [opening, setOpening] = useState<string | null>(null)

  const { data: documents = [] } = useQuery({
    queryKey: ['incident-docs', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/documents`).then(r => r.data),
  })

  async function upload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (notes) fd.append('notes', notes)
      await api.post(`/incidents/${incidentId}/evidence`, fd)
      qc.invalidateQueries({ queryKey: ['incident-docs', incidentId] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
      setNotes('')
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function openDocument(docId: string, fileName: string) {
    setOpening(docId)
    try {
      // Stream the file through our backend — bypasses R2 SSL issues
      const response = await api.get(
        `/incidents/${incidentId}/documents/${docId}/download`,
        { responseType: 'blob' }
      )
  
      // Create a local object URL from the blob
      const blob = new Blob([response.data], {
        type: String(response.headers['content-type'] || 'application/octet-stream')
      })
      const url = URL.createObjectURL(blob)
  
      // Open in new tab
      const tab = window.open(url, '_blank', 'noopener,noreferrer')
  
      // Clean up the object URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 10000)
  
      // If browser blocked popup, fall back to download
      if (!tab) {
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
      }
    } catch (e: any) {
      alert('Could not open document. File may not be accessible.')
    } finally {
      setOpening(null)
    }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        Supporting documents
        {documents.length === 0
          ? <span style={{ background: '#fff3e0', color: '#c25e00', fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>None attached</span>
          : <span style={{ background: '#e6f4ea', color: '#1a6b2e', fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
        }
      </div>

      {documents.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: canUpload ? 10 : 0 }}>
          {documents.map((doc: any) => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#F7F6F3', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.15s' }}
              onClick={() => openDocument(doc.id, doc.file_name)}
              onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(5,17,76,0.12)'; e.currentTarget.style.background = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = '#F7F6F3' }}
              title={`Click to open ${doc.file_name}`}
            >
              <FileText size={15} style={{ color: '#D97757', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#05114C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.file_name}
                </div>
                {doc.notes && <div style={{ fontSize: 11, color: '#5a6282', marginTop: 2 }}>{doc.notes}</div>}
                <div style={{ fontSize: 10, color: '#c0c4d4', marginTop: 3 }}>
                  Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {doc.file_size && ` · ${(doc.file_size / 1024).toFixed(0)} KB`}
                </div>
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, color: opening === doc.id ? '#D97757' : '#9aa0b8', fontSize: 11, fontWeight: 500 }}>
                {opening === doc.id ? (
                  <span style={{ fontSize: 10 }}>Opening...</span>
                ) : (
                  <>
                    <Eye size={12} />
                    <span style={{ fontSize: 10 }}>View</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !canUpload && (
          <div style={{ padding: '10px 12px', background: '#f1f3f8', borderRadius: 8, fontSize: 12, color: '#9aa0b8' }}>
            No documents attached to this incident.
          </div>
        )
      )}

      {canUpload && (
        <>
          <input ref={fileRef} type="file" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]) }} />
          <input
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Optional description for this file..."
            style={{ width: '100%', height: 36, border: '1.5px solid rgba(5,17,76,0.12)', borderRadius: 8, padding: '0 10px', fontSize: 12, color: '#05114C', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box', marginBottom: 8 }}
          />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ width: '100%', height: 38, background: 'rgba(5,17,76,0.05)', color: '#05114C', border: '1.5px dashed rgba(5,17,76,0.18)', borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Upload size={13} />
            {uploading ? 'Uploading...' : 'Attach document'}
          </button>
        </>
      )}
    </div>
  )
}

// ── Event log ─────────────────────────────────────────────────────────
function EventLog({ incidentId }: { incidentId: string }) {
  const { data: log = [] } = useQuery({
    queryKey: ['escalation-log', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/escalation-log`).then(r => r.data),
  })

  const roleColor: Record<string, string> = {
    admin: '#b33020', operations_manager: '#05114C', manager: '#2044b0',
    safety: '#c25e00', supervisor: '#0f766e', tracker: '#6b21a8',
    workshop: '#1a6b2e', viewer: '#5a6282',
  }

  const statusColor: Record<string, string> = {
    draft: '#5a6282', submitted: '#2044b0', manager_review: '#c25e00',
    ops_review: '#854F0B', closed: '#1a6b2e', rejected: '#b33020',
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Full event history
      </div>

      {log.length === 0 ? (
        <div style={{ padding: '12px', background: '#f1f3f8', borderRadius: 8, fontSize: 12, color: '#9aa0b8' }}>
          No actions recorded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {log.map((entry: any, i: number) => (
            <div key={entry.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 16, position: 'relative' }}>
              {i < log.length - 1 && (
                <div style={{ position: 'absolute', left: 11, top: 24, bottom: 0, width: 1, background: 'rgba(5,17,76,0.08)' }} />
              )}
              {/* Icon */}
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: statusColor[entry.to_status] ?? '#05114C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                {entry.to_status === 'closed'    ? <CheckCircle size={11} color="#fff" />
                  : entry.to_status === 'rejected' ? <XCircle size={11} color="#fff" />
                  : entry.to_status === 'submitted'? <Send size={10} color="#fff" />
                  : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Who */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#05114C' }}>{entry.escalated_by_name}</span>
                  {entry.escalated_by_role && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: roleColor[entry.escalated_by_role] ?? '#5a6282', background: `${roleColor[entry.escalated_by_role] ?? '#5a6282'}15`, padding: '1px 7px', borderRadius: 10, textTransform: 'capitalize', border: `1px solid ${roleColor[entry.escalated_by_role] ?? '#5a6282'}30` }}>
                      {entry.escalated_by_role.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {/* What */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#9aa0b8', textTransform: 'capitalize' }}>{entry.from_status.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 10, color: '#c0c4d4' }}>→</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: statusColor[entry.to_status] ?? '#05114C', textTransform: 'capitalize', background: STATUS_CFG[entry.to_status]?.bg ?? '#f1f3f8', padding: '1px 8px', borderRadius: 10 }}>
                    {entry.to_status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Notes */}
                {entry.notes && (
                  <div style={{ fontSize: 12, color: '#3d4466', background: '#F7F6F3', borderRadius: 7, padding: '8px 10px', lineHeight: 1.6, marginBottom: 4 }}>
                    "{entry.notes}"
                  </div>
                )}

                {/* When */}
                <div style={{ fontSize: 10, color: '#c0c4d4' }}>
                  {entry.escalated_at ? new Date(entry.escalated_at).toLocaleDateString('en-ZM', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────
function DetailPanel({ incident, onClose, vehicles, drivers, currentRole }: {
  incident: Incident; onClose: () => void; vehicles: any[]; drivers: any[]; currentRole: string
}) {
  const qc = useQueryClient()
  const [managerNotes, setManagerNotes] = useState('')
  const [opsOutcome, setOpsOutcome]     = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    description: incident.description,
    location:    incident.location ?? '',
    severity:    incident.severity,
    incident_type: incident.incident_type,
  })

  // Reset edit form when incident changes
  useState(() => {
    setEditForm({
      description:   incident.description,
      location:      incident.location ?? '',
      severity:      incident.severity,
      incident_type: incident.incident_type,
    })
    setEditing(false)
  })

  const vehicle = vehicles.find(v => v.id === incident.vehicle_id)
  const driver  = drivers.find(d => d.id === incident.driver_id)

  const { data: docs = [] } = useQuery({
    queryKey: ['incident-docs', incident.id],
    queryFn: () => api.get(`/incidents/${incident.id}/documents`).then(r => r.data),
  })

  const hasEvidence = docs.length > 0

  const isSafety   = ['safety', 'supervisor', 'tracker', 'admin'].includes(currentRole)
  const isManager  = ['manager', 'admin'].includes(currentRole)
  const isOps      = ['operations_manager', 'admin'].includes(currentRole)

  const isDraft     = incident.status === 'draft'
  const isRejected  = incident.status === 'rejected'
  const isEditable  = isSafety && (isDraft || isRejected)
  const canUpload   = isSafety && (isDraft || isRejected)
  const canSubmit   = isSafety && isDraft
  const canResubmit = isSafety && isRejected
  const canDelete   = isSafety && isDraft
  const canManagerAct = isManager && incident.status === 'submitted'
  const canOpsAct   = isOps && incident.status === 'ops_review'

  async function action(fn: () => Promise<any>) {
    setBusy(true)
    try {
      await fn()
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['escalation-log', incident.id] })
      qc.invalidateQueries({ queryKey: ['incident-docs', incident.id] })
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    await action(() => api.patch(`/incidents/${incident.id}`, editForm))
    setEditing(false)
  }

  async function deleteIncident() {
    if (!confirm('Delete this draft incident? This cannot be undone.')) return
    setBusy(true)
    try {
      await api.delete(`/incidents/${incident.id}`)
      qc.invalidateQueries({ queryKey: ['incidents'] })
      onClose()
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  const fmt = (d: string | null) => d
    ? new Date(d).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38, border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 8,
    padding: '0 10px', fontSize: 13, color: '#05114C', background: '#fff', outline: 'none',
    fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
  }

  return (
    <div style={{ width: 460, flexShrink: 0, background: '#fff', borderLeft: '1px solid rgba(5,17,76,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(5,17,76,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <SeverityBadge severity={incident.severity} />
            <StatusPill status={incident.status} />
            {isRejected && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#b33020', background: '#fdecea', padding: '2px 8px', borderRadius: 20 }}>
                Needs correction
              </span>
            )}
          </div>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: '#05114C', margin: '0 0 3px', textTransform: 'capitalize' }}>
            {incident.incident_type.replace(/_/g, ' ')}
          </h3>
          <p style={{ fontSize: 11, color: '#9aa0b8', margin: 0 }}>
            {new Date(incident.event_datetime).toLocaleDateString('en-ZM', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {isEditable && !editing && (
            <button onClick={() => setEditing(true)}
              style={{ background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, padding: '0 10px', height: 30, fontSize: 11, fontWeight: 500, color: '#05114C', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              Edit
            </button>
          )}
          <button onClick={onClose} style={{ background: 'rgba(5,17,76,0.05)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} color="#05114C" />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        <ProgressBar status={incident.status} />

        {/* Rejection notice */}
        {incident.rejection_reason && (
          <div style={{ marginBottom: 16, background: '#fdecea', border: '1px solid #f5c6c2', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#b33020', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              ✗ Rejected — corrections needed
            </div>
            <div style={{ fontSize: 13, color: '#b33020', lineHeight: 1.6 }}>{incident.rejection_reason}</div>
            {isRejected && isSafety && (
              <div style={{ fontSize: 11, color: '#b33020', marginTop: 6, opacity: 0.8 }}>
                Update the details below and attach corrected documents, then resubmit.
              </div>
            )}
          </div>
        )}

        {/* Outcome */}
        {incident.outcome && (
          <div style={{ marginBottom: 16, background: '#e6f4ea', border: '1px solid #b7dfbf', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1a6b2e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>✓ Final outcome</div>
            <div style={{ fontSize: 13, color: '#1a6b2e', lineHeight: 1.6 }}>{incident.outcome}</div>
            {incident.closed_at && <div style={{ fontSize: 10, color: '#1a6b2e', opacity: 0.6, marginTop: 4 }}>Closed {fmt(incident.closed_at)}</div>}
          </div>
        )}

        {/* Edit form */}
        {editing ? (
          <div style={{ marginBottom: 16, background: '#F7F6F3', borderRadius: 10, padding: '14px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              {isRejected ? 'Correct and resubmit' : 'Edit incident'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#05114C', marginBottom: 4 }}>Type</label>
                  <select value={editForm.incident_type} onChange={e => setEditForm(f => ({ ...f, incident_type: e.target.value }))} style={inputStyle}>
                    {['accident','near_miss','speed','mechanical','passenger_complaint','road_condition','other'].map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#05114C', marginBottom: 4 }}>Severity</label>
                  <select value={editForm.severity} onChange={e => setEditForm(f => ({ ...f, severity: e.target.value }))} style={inputStyle}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#05114C', marginBottom: 4 }}>Location</label>
                <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="Location of incident" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#05114C', marginBottom: 4 }}>Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  style={{ ...inputStyle, height: 'auto', minHeight: 80, padding: '8px 10px', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{ height: 38, background: 'rgba(5,17,76,0.06)', color: '#05114C', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={busy || !editForm.description.trim()} style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (!editForm.description.trim() || busy) ? 0.5 : 1 }}>
                  {busy ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Read-only meta grid */
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { icon: Truck,  label: 'Vehicle',  value: vehicle ? `${vehicle.reg_plate} — ${vehicle.make}` : incident.vehicle_id?.slice(0, 8) ?? '—' },
                { icon: User,   label: 'Driver',   value: driver  ? driver.full_name : incident.driver_id?.slice(0, 8) ?? '—' },
                { icon: MapPin, label: 'Location', value: incident.location ?? '—' },
                { icon: Clock,  label: 'Reported', value: fmt(incident.created_at) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ background: '#F7F6F3', borderRadius: 8, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <Icon size={10} style={{ color: '#9aa0b8' }} />
                    <span style={{ fontSize: 9, color: '#9aa0b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#05114C', wordBreak: 'break-word' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13, color: '#3d4466', lineHeight: 1.6, background: '#F7F6F3', borderRadius: 8, padding: '11px 13px' }}>{incident.description}</div>
            </div>
          </>
        )}

        {/* Documents */}
        <DocumentsSection incidentId={incident.id} canUpload={canUpload} />

        {/* Event log */}
        <EventLog incidentId={incident.id} />

        {/* ── Actions ── */}

        {/* SAFETY: Submit (draft with docs) */}
        {canSubmit && !editing && (
          <div style={{ borderTop: '1px solid rgba(5,17,76,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Submit for manager review</div>
            {!hasEvidence && (
              <div style={{ padding: '10px 12px', background: '#fff3e0', border: '1px solid #fcd9a0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Lock size={12} style={{ color: '#c25e00', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#c25e00' }}>Attach at least one document before submitting.</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={busy || !hasEvidence} onClick={() => action(() => api.post(`/incidents/${incident.id}/submit`))}
                style={{ flex: 1, height: 42, background: hasEvidence ? '#05114C' : '#e0e3ef', color: hasEvidence ? '#fff' : '#9aa0b8', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: (busy || !hasEvidence) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Send size={14} />
                {hasEvidence ? 'Submit to manager' : 'Attach document first'}
              </button>
              {canDelete && (
                <button onClick={deleteIncident} disabled={busy}
                  style={{ height: 42, width: 42, background: '#fdecea', color: '#b33020', border: '1px solid #f5c6c2', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  title="Delete this draft">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* SAFETY: Resubmit after rejection */}
        {canResubmit && !editing && (
          <div style={{ borderTop: '1px solid rgba(5,17,76,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Resubmit for manager review</div>
            {!hasEvidence && (
              <div style={{ padding: '10px 12px', background: '#fff3e0', border: '1px solid #fcd9a0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Lock size={12} style={{ color: '#c25e00', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#c25e00' }}>Attach corrected documents before resubmitting.</span>
              </div>
            )}
            <button disabled={busy || !hasEvidence} onClick={() => action(() => api.post(`/incidents/${incident.id}/submit`))}
              style={{ width: '100%', height: 42, background: hasEvidence ? '#05114C' : '#e0e3ef', color: hasEvidence ? '#fff' : '#9aa0b8', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: (busy || !hasEvidence) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Send size={14} />
              {hasEvidence ? 'Resubmit to manager' : 'Attach documents first'}
            </button>
          </div>
        )}

        {/* Read-only status for safety after submission */}
        {isSafety && !canSubmit && !canResubmit && !isManager && !isOps && !editing && (
          <div style={{ borderTop: '1px solid rgba(5,17,76,0.06)', paddingTop: 14 }}>
            <div style={{ padding: '12px 14px', background: STATUS_CFG[incident.status]?.bg ?? '#f1f3f8', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CFG[incident.status]?.color ?? '#5a6282', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: STATUS_CFG[incident.status]?.color ?? '#5a6282' }}>
                {incident.status === 'submitted'  ? 'With the manager for review — no further action needed from you'
                : incident.status === 'ops_review' ? 'Manager approved — with operations manager for final closure'
                : incident.status === 'closed'     ? 'Closed by operations manager'
                : STATUS_CFG[incident.status]?.label ?? incident.status}
              </span>
            </div>
          </div>
        )}

        {/* MANAGER: Approve / Reject */}
        {canManagerAct && (
          <div style={{ borderTop: '1px solid rgba(5,17,76,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Manager review</div>
            <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 10 }}>Notes are recorded with your name and timestamp in the event history.</div>
            <textarea value={managerNotes} onChange={e => setManagerNotes(e.target.value)}
              placeholder="Add review notes — required before approving or rejecting..."
              style={{ width: '100%', minHeight: 80, border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 9, padding: '10px 12px', fontSize: 13, color: '#05114C', fontFamily: "'DM Sans',sans-serif", resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button disabled={busy || !managerNotes.trim()}
                onClick={() => action(() => api.post(`/incidents/${incident.id}/manager-review`, null, { params: { notes: managerNotes, approve: true } }))}
                style={{ height: 42, background: '#05114C', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (busy || !managerNotes.trim()) ? 0.4 : 1 }}>
                <CheckCircle size={14} /> Approve
              </button>
              <button disabled={busy || !managerNotes.trim()}
                onClick={() => action(() => api.post(`/incidents/${incident.id}/manager-review`, null, { params: { notes: managerNotes, approve: false } }))}
                style={{ height: 42, background: '#fdecea', color: '#b33020', border: '1px solid #f5c6c2', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (busy || !managerNotes.trim()) ? 0.4 : 1 }}>
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>
        )}

        {/* Manager read-only on non-submitted */}
        {isManager && !canManagerAct && (
          <div style={{ borderTop: '1px solid rgba(5,17,76,0.06)', paddingTop: 14 }}>
            <div style={{ padding: '10px 14px', background: '#F7F6F3', borderRadius: 8, fontSize: 12, color: '#9aa0b8', textAlign: 'center' }}>
              {incident.status === 'ops_review' ? '✓ You approved this — now with Operations Manager'
                : incident.status === 'closed'   ? '✓ Closed by Operations Manager'
                : incident.status === 'rejected' ? 'You rejected this incident'
                : incident.status === 'draft'    ? 'Not yet submitted by the reporter'
                : 'Read only at this stage'}
            </div>
          </div>
        )}

        {/* OPS MANAGER: Close */}
        {canOpsAct && (
          <div style={{ borderTop: '1px solid rgba(5,17,76,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Final closure</div>
            <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 10 }}>Your outcome is final and timestamped. Evidence must be attached.</div>
            {!hasEvidence && (
              <div style={{ padding: '10px 12px', background: '#fdecea', border: '1px solid #f5c6c2', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Lock size={12} style={{ color: '#b33020', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#b33020' }}>Evidence must be attached before closing.</span>
              </div>
            )}
            <textarea value={opsOutcome} onChange={e => setOpsOutcome(e.target.value)}
              placeholder="State the final outcome and corrective actions taken..."
              style={{ width: '100%', minHeight: 90, border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 9, padding: '10px 12px', fontSize: 13, color: '#05114C', fontFamily: "'DM Sans',sans-serif", resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <button disabled={busy || !opsOutcome.trim() || !hasEvidence}
              onClick={() => action(() => api.post(`/incidents/${incident.id}/ops-close`, null, { params: { outcome: opsOutcome } }))}
              style={{ width: '100%', height: 42, background: (hasEvidence && opsOutcome.trim()) ? '#1a6b2e' : '#e0e3ef', color: (hasEvidence && opsOutcome.trim()) ? '#fff' : '#9aa0b8', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: (busy || !opsOutcome.trim() || !hasEvidence) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ShieldCheck size={14} />
              {!hasEvidence ? 'Evidence required' : 'Close incident'}
            </button>
          </div>
        )}

        {/* Ops read-only on non-ops_review */}
        {isOps && !canOpsAct && (
          <div style={{ borderTop: '1px solid rgba(5,17,76,0.06)', paddingTop: 14 }}>
            <div style={{ padding: '10px 14px', background: '#F7F6F3', borderRadius: 8, fontSize: 12, color: '#9aa0b8', textAlign: 'center' }}>
              {incident.status === 'closed'    ? '✓ Closed'
                : incident.status === 'submitted' ? 'Awaiting manager review first'
                : incident.status === 'draft'     ? 'Not yet submitted'
                : 'Read only at this stage'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function IncidentsPage() {
  const currentRole = getRole()
  const [selected, setSelected]             = useState<Incident | null>(null)
  const [search, setSearch]                 = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [showCreate, setShowCreate]         = useState(false)
  const [newForm, setNewForm] = useState({
    incident_type: 'accident', severity: 'medium',
    description: '', location: '', vehicle_id: '', driver_id: '', event_datetime: ''
  })
  const qc = useQueryClient()

  const isSafety  = ['safety', 'supervisor', 'tracker', 'admin'].includes(currentRole)
  const isManager = ['manager', 'admin'].includes(currentRole)
  const isOps     = ['operations_manager', 'admin'].includes(currentRole)

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => api.get('/incidents').then(r => r.data),
  })
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => api.get('/vehicles').then(r => r.data) })
  const { data: drivers  = [] } = useQuery({ queryKey: ['drivers'],  queryFn: () => api.get('/drivers').then(r => r.data) })

  const freshSelected = selected
    ? incidents.find((i: Incident) => i.id === selected.id) ?? selected
    : null

  const filtered = incidents.filter((i: Incident) => {
    const matchSearch   = !search        || i.description.toLowerCase().includes(search.toLowerCase()) || i.incident_type.includes(search.toLowerCase()) || i.location?.toLowerCase().includes(search.toLowerCase())
    const matchStatus   = !filterStatus   || i.status   === filterStatus
    const matchSeverity = !filterSeverity || i.severity === filterSeverity
    return matchSearch && matchStatus && matchSeverity
  })

  // Counts by status
  const counts = {
    draft:     incidents.filter((i: Incident) => i.status === 'draft').length,
    submitted: incidents.filter((i: Incident) => i.status === 'submitted').length,
    ops_review:incidents.filter((i: Incident) => i.status === 'ops_review').length,
    closed:    incidents.filter((i: Incident) => i.status === 'closed').length,
    rejected:  incidents.filter((i: Incident) => i.status === 'rejected').length,
  }

  async function createIncident() {
    try {
      await api.post('/incidents', {
        ...newForm,
        event_datetime: new Date(newForm.event_datetime).toISOString(),
      })
      qc.invalidateQueries({ queryKey: ['incidents'] })
      setShowCreate(false)
      setNewForm({ incident_type: 'accident', severity: 'medium', description: '', location: '', vehicle_id: '', driver_id: '', event_datetime: '' })
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed') }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40, border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 9,
    padding: '0 12px', fontSize: 13, color: '#05114C', background: '#fff', outline: 'none',
    fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500, color: '#05114C', marginBottom: 5
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: '#05114C', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Incidents</h1>
              <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>{incidents.length} total</p>
            </div>
            {isSafety && (
              <button onClick={() => setShowCreate(true)}
                style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Plus size={14} /> Log incident
              </button>
            )}
          </div>

          {/* Status filter chips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { key: '',           label: 'All',           count: incidents.length, color: '#05114C', bg: 'rgba(5,17,76,0.06)' },
              { key: 'draft',      label: 'Draft',         count: counts.draft,     color: '#5a6282', bg: '#f1f3f8' },
              { key: 'submitted',  label: 'Submitted',     count: counts.submitted, color: '#2044b0', bg: '#e8eeff' },
              { key: 'ops_review', label: 'Ops review',    count: counts.ops_review,color: '#854F0B', bg: '#faeeda' },
              { key: 'closed',     label: 'Closed',        count: counts.closed,    color: '#1a6b2e', bg: '#e6f4ea' },
              { key: 'rejected',   label: 'Rejected',      count: counts.rejected,  color: '#b33020', bg: '#fdecea' },
            ].filter(s => s.count > 0 || s.key === '').map(s => (
              <button key={s.key}
                onClick={() => setFilterStatus(filterStatus === s.key ? (s.key === '' ? '' : '') : s.key)}
                style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterStatus === s.key ? s.color : 'rgba(5,17,76,0.1)'}`, background: filterStatus === s.key ? s.bg : '#fff', color: s.color, fontSize: 11, fontWeight: filterStatus === s.key ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}>
                {s.label}
                {s.count > 0 && <span style={{ background: filterStatus === s.key ? s.color : 'rgba(5,17,76,0.1)', color: filterStatus === s.key ? '#fff' : '#9aa0b8', borderRadius: 20, padding: '0 5px', fontSize: 10, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{s.count}</span>}
              </button>
            ))}
          </div>

          {/* Search + severity filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', height: 36 }}>
              <Search size={13} style={{ color: '#9aa0b8', flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description, type or location..."
                style={{ border: 'none', outline: 'none', fontSize: 13, color: '#05114C', background: 'transparent', width: '100%', fontFamily: "'DM Sans',sans-serif" }} />
            </div>
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
              style={{ height: 36, border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#05114C', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}>
              <option value="">All severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0b8', fontSize: 13 }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <AlertTriangle size={28} style={{ color: '#9aa0b8', margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: '#9aa0b8', margin: '0 0 4px' }}>No incidents found</p>
                <p style={{ fontSize: 11, color: '#c0c4d4', margin: 0 }}>Try adjusting your filters</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F6F3' }}>
                    {['Type', 'Severity', 'Vehicle', 'Date', 'Docs', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(5,17,76,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inc: Incident) => {
                    const isSelected = selected?.id === inc.id
                    const vehicle    = vehicles.find((v: any) => v.id === inc.vehicle_id)
                    const needsAction = (isManager && inc.status === 'submitted') ||
                                        (isOps && inc.status === 'ops_review') ||
                                        (isSafety && inc.status === 'draft') ||
                                        (isSafety && inc.status === 'rejected')
                    return (
                      <tr key={inc.id}
                        onClick={() => setSelected(isSelected ? null : inc)}
                        style={{ borderBottom: '1px solid rgba(5,17,76,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(5,17,76,0.04)' : 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (!isSelected)(e.currentTarget as HTMLElement).style.background = 'rgba(5,17,76,0.02)' }}
                        onMouseLeave={e => { if (!isSelected)(e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            {needsAction && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97757', flexShrink: 0 }} />}
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13, color: '#05114C', textTransform: 'capitalize' }}>{inc.incident_type.replace(/_/g, ' ')}</div>
                              {inc.location && <div style={{ fontSize: 11, color: '#9aa0b8', marginTop: 1 }}>{inc.location}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}><SeverityBadge severity={inc.severity} /></td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#5a6282', fontWeight: 500 }}>
                          {vehicle ? vehicle.reg_plate : inc.vehicle_id ? inc.vehicle_id.slice(0, 8) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa0b8', whiteSpace: 'nowrap' }}>
                          {new Date(inc.event_datetime).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {inc.status === 'draft'
                            ? <span style={{ fontSize: 10, fontWeight: 600, color: '#c25e00', background: '#fff3e0', padding: '2px 8px', borderRadius: 20 }}>Needed</span>
                            : <span style={{ fontSize: 10, fontWeight: 600, color: '#1a6b2e', background: '#e6f4ea', padding: '2px 8px', borderRadius: 20 }}>On file</span>
                          }
                        </td>
                        <td style={{ padding: '12px 16px' }}><StatusPill status={inc.status} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          <ChevronRight size={14} style={{ color: isSelected ? '#D97757' : '#9aa0b8' }} />
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

      {freshSelected && (
        <DetailPanel
          incident={freshSelected}
          onClose={() => setSelected(null)}
          vehicles={vehicles}
          drivers={drivers}
          currentRole={currentRole}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,17,76,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(5,17,76,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: '#05114C', margin: 0 }}>Log new incident</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} color="#05114C" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#e8eeff', border: '1px solid #c7d4f8', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2044b0', lineHeight: 1.5 }}>
                Save the incident as a draft first. Then attach supporting documents. Once documents are attached you can submit to the manager for review.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={newForm.incident_type} onChange={e => setNewForm(f => ({ ...f, incident_type: e.target.value }))} style={inputStyle}>
                    {['accident','near_miss','speed','mechanical','passenger_complaint','road_condition','other'].map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Severity</label>
                  <select value={newForm.severity} onChange={e => setNewForm(f => ({ ...f, severity: e.target.value }))} style={inputStyle}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Vehicle</label>
                  <select value={newForm.vehicle_id} onChange={e => setNewForm(f => ({ ...f, vehicle_id: e.target.value }))} style={inputStyle}>
                    <option value="">— None —</option>
                    {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.reg_plate}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Driver</label>
                  <select value={newForm.driver_id} onChange={e => setNewForm(f => ({ ...f, driver_id: e.target.value }))} style={inputStyle}>
                    <option value="">— None —</option>
                    {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Date & time <span style={{ color: '#b33020' }}>*</span></label>
                <input type="datetime-local" value={newForm.event_datetime} onChange={e => setNewForm(f => ({ ...f, event_datetime: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input value={newForm.location} onChange={e => setNewForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Gate 4 — Kalumbila road" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description <span style={{ color: '#b33020' }}>*</span></label>
                <textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what happened in detail..."
                  style={{ ...inputStyle, height: 'auto', minHeight: 90, padding: '10px 12px', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
                <button onClick={() => setShowCreate(false)} style={{ height: 42, background: 'rgba(5,17,76,0.06)', color: '#05114C', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
                <button onClick={createIncident} disabled={!newForm.description || !newForm.event_datetime}
                  style={{ height: 42, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (!newForm.description || !newForm.event_datetime) ? 0.5 : 1 }}>
                  Save as draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}