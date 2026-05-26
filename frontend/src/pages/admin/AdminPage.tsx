import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import {
  Users, Plus, X, Shield, Eye, Edit3, Trash2,
  ChevronDown, ChevronUp, Check, Search
} from 'lucide-react'

// ── Role definitions ──────────────────────────────────────────────────
const ROLES = [
  {
    key: 'admin',
    label: 'Admin',
    color: '#b33020', bg: '#fdecea',
    description: 'Full system access. Manages users, roles and all settings.',
    fixed: true,
  },
  {
    key: 'operations_manager',
    label: 'Operations Manager',
    color: '#05114C', bg: 'rgba(5,17,76,0.08)',
    description: 'Final incident closure, compliance reports, fleet overview.',
    fixed: false,
  },
  {
    key: 'manager',
    label: 'Manager',
    color: '#2044b0', bg: '#e8eeff',
    description: 'Approves incidents and reviews submitted reports.',
    fixed: false,
  },
  {
    key: 'safety',
    label: 'Safety',
    color: '#c25e00', bg: '#fff3e0',
    description: 'Incidents, driver compliance, driver records. Cannot manage fleet or speed events.',
    fixed: false,
  },
  {
    key: 'workshop',
    label: 'Workshop',
    color: '#1a6b2e', bg: '#e6f4ea',
    description: 'Vehicle maintenance, fleet records, job cards, tyre and service records.',
    fixed: false,
  },
  {
    key: 'tracker',
    label: 'Tracker / GPS',
    color: '#6b21a8', bg: '#f3e8ff',
    description: 'Speed events only — log, review, dispute and escalate GPS flags.',
    fixed: false,
  },
  {
    key: 'upper_management',
    label: 'Upper Management',
    color: '#854F0B', bg: '#faeeda',
    description: 'Read-only compliance dashboard and reports. Receives automatic notifications.',
    fixed: false,
  },
  {
    key: 'supervisor',
    label: 'Supervisor',
    color: '#0f766e', bg: '#ccfbf1',
    description: 'Logs incidents, submits checklists, views all records.',
    fixed: false,
  },
  {
    key: 'viewer',
    label: 'Viewer',
    color: '#5a6282', bg: '#f1f3f8',
    description: 'Read-only access to all records. Cannot create or edit anything.',
    fixed: false,
  },
]

// ── Role permissions matrix ───────────────────────────────────────────
const MODULES = [
  { key: 'fleet',             label: 'Fleet / Vehicles'       },
  { key: 'drivers',           label: 'Drivers'                },
  { key: 'maintenance',       label: 'Maintenance'            },
  { key: 'speed_events',      label: 'Speed events'           },
  { key: 'incidents',         label: 'Incidents'              },
  { key: 'driver_compliance', label: 'Driver compliance'      },
  { key: 'compliance_report', label: 'Compliance report'      },
  { key: 'documents',         label: 'Documents'              },
  { key: 'admin',             label: 'User management'        },
]

type Permission = 'none' | 'view' | 'edit'

const DEFAULT_PERMISSIONS: Record<string, Record<string, Permission>> = {
  admin:              { fleet:'edit', drivers:'edit', maintenance:'edit', speed_events:'edit', incidents:'edit', driver_compliance:'edit', compliance_report:'edit', documents:'edit', admin:'edit' },
  operations_manager: { fleet:'view', drivers:'view', maintenance:'view', speed_events:'view', incidents:'edit', driver_compliance:'view', compliance_report:'edit', documents:'view', admin:'none' },
  manager:            { fleet:'view', drivers:'view', maintenance:'view', speed_events:'view', incidents:'edit', driver_compliance:'view', compliance_report:'view', documents:'view', admin:'none' },
  safety:             { fleet:'none', drivers:'edit', maintenance:'none', speed_events:'view', incidents:'edit', driver_compliance:'edit', compliance_report:'view', documents:'edit', admin:'none' },
  workshop:           { fleet:'edit', drivers:'view', maintenance:'edit', speed_events:'none', incidents:'view', driver_compliance:'none', compliance_report:'none', documents:'edit', admin:'none' },
  tracker:            { fleet:'view', drivers:'view', maintenance:'none', speed_events:'edit', incidents:'none', driver_compliance:'none', compliance_report:'none', documents:'none', admin:'none' },
  upper_management:   { fleet:'view', drivers:'view', maintenance:'view', speed_events:'view', incidents:'view', driver_compliance:'view', compliance_report:'view', documents:'view', admin:'none' },
  supervisor:         { fleet:'view', drivers:'view', maintenance:'edit', speed_events:'edit', incidents:'edit', driver_compliance:'view', compliance_report:'view', documents:'edit', admin:'none' },
  viewer:             { fleet:'view', drivers:'view', maintenance:'view', speed_events:'view', incidents:'view', driver_compliance:'view', compliance_report:'view', documents:'view', admin:'none' },
}

function getRoleConfig(key: string) {
  return ROLES.find(r => r.key === key) ?? { key, label: key, color: '#5a6282', bg: '#f1f3f8', description: '', fixed: false }
}

// ── Permission cell ───────────────────────────────────────────────────
function PermCell({ value, onChange, disabled }: { value: Permission; onChange: (v: Permission) => void; disabled?: boolean }) {
  const cycle: Permission[] = ['none', 'view', 'edit']
  const next = () => {
    if (disabled) return
    const i = cycle.indexOf(value)
    onChange(cycle[(i + 1) % cycle.length])
  }
  const cfg = {
    none: { bg: '#f1f3f8', color: '#c0c4d4', label: '—',    icon: null },
    view: { bg: '#e8eeff', color: '#2044b0', label: 'View',  icon: <Eye size={10}/> },
    edit: { bg: '#e6f4ea', color: '#1a6b2e', label: 'Edit',  icon: <Edit3 size={10}/> },
  }[value]
  return (
    <button
      onClick={next}
      disabled={disabled}
      title={disabled ? 'Admin always has full access' : `Click to cycle: none → view → edit`}
      style={{ background: cfg.bg, color: cfg.color, border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: '0.03em', textTransform: 'uppercase', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
    >
      {cfg.icon}{cfg.label}
    </button>
  )
}

// ── Role card ─────────────────────────────────────────────────────────
function RoleCard({ roleKey, userCount }: { roleKey: string; userCount: number }) {
  const [expanded, setExpanded] = useState(false)
  const [perms, setPerms] = useState<Record<string, Permission>>(
    DEFAULT_PERMISSIONS[roleKey] ?? Object.fromEntries(MODULES.map(m => [m.key, 'none' as Permission]))
  )
  const cfg = getRoleConfig(roleKey)

  function setPermission(module: string, value: Permission) {
    setPerms(p => ({ ...p, [module]: value }))
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden', marginBottom: 10 }}>

      {/* Header */}
      <div
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Shield size={16} style={{ color: cfg.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: '#05114C' }}>{cfg.label}</span>
            <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
              {userCount} user{userCount !== 1 ? 's' : ''}
            </span>
            {cfg.fixed && (
              <span style={{ background: '#fdecea', color: '#b33020', fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>System</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#9aa0b8', marginTop: 2 }}>{cfg.description}</div>
        </div>

        {/* Permission summary pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 280 }}>
          {MODULES.filter(m => perms[m.key] !== 'none').map(m => (
            <span key={m.key} style={{ fontSize: 9, fontWeight: 600, color: perms[m.key] === 'edit' ? '#1a6b2e' : '#2044b0', background: perms[m.key] === 'edit' ? '#e6f4ea' : '#e8eeff', padding: '2px 6px', borderRadius: 10, whiteSpace: 'nowrap' }}>
              {m.label}
            </span>
          ))}
        </div>

        <div style={{ flexShrink: 0, color: '#9aa0b8' }}>
          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </div>

      {/* Permissions table */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(5,17,76,0.06)', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Module permissions — click cells to toggle None / View / Edit
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {MODULES.map(mod => (
              <div key={mod.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F7F6F3', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ fontSize: 12, color: '#05114C', fontWeight: 500 }}>{mod.label}</span>
                <PermCell
                  value={perms[mod.key] ?? 'none'}
                  onChange={v => setPermission(mod.key, v)}
                  disabled={roleKey === 'admin'}
                />
              </div>
            ))}
          </div>
          {roleKey !== 'admin' && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPerms(Object.fromEntries(MODULES.map(m => [m.key, 'view' as Permission])))}
                style={{ fontSize: 11, color: '#2044b0', background: '#e8eeff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}
              >
                Set all to View
              </button>
              <button
                onClick={() => setPerms(Object.fromEntries(MODULES.map(m => [m.key, 'edit' as Permission])))}
                style={{ fontSize: 11, color: '#1a6b2e', background: '#e6f4ea', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}
              >
                Set all to Edit
              </button>
              <button
                onClick={() => setPerms(Object.fromEntries(MODULES.map(m => [m.key, 'none' as Permission])))}
                style={{ fontSize: 11, color: '#5a6282', background: '#f1f3f8', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}
              >
                Clear all
              </button>
              <button
                onClick={() => setPerms(DEFAULT_PERMISSIONS[roleKey] ?? {})}
                style={{ fontSize: 11, color: '#05114C', background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}
              >
                Reset to default
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── User row ──────────────────────────────────────────────────────────
function UserRow({ user, onEdit, onDelete }: { user: any; onEdit: (u: any) => void; onDelete: (id: string) => void }) {
  const cfg = getRoleConfig(user.role)
  return (
    <tr style={{ borderBottom: '1px solid rgba(5,17,76,0.04)' }}>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#05114C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, color: '#fff' }}>
              {user.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, color: '#05114C' }}>{user.full_name}</div>
            <div style={{ fontSize: 11, color: '#9aa0b8', marginTop: 1 }}>{user.email}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {cfg.label}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: user.is_active ? '#1a6b2e' : '#b33020', background: user.is_active ? '#e6f4ea' : '#fdecea', padding: '2px 8px', borderRadius: 20 }}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa0b8' }}>
        {new Date(user.created_at).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(user)}
            style={{ fontSize: 11, color: '#05114C', background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            Edit
          </button>
          <button onClick={() => onDelete(user.id)}
            style={{ fontSize: 11, color: '#b33020', background: '#fdecea', border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            Remove
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Create / edit user modal ──────────────────────────────────────────
function UserModal({ user, onClose }: { user?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const isEdit = !!user
  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    email:     user?.email     ?? '',
    password:  '',
    role:      user?.role      ?? 'viewer',
    is_active: user?.is_active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!form.full_name || !form.email) { setError('Name and email are required.'); return }
    if (!isEdit && !form.password)      { setError('Password is required for new users.'); return }
    setBusy(true)
    setError('')
    try {
      if (isEdit) {
        await api.patch(`/auth/users/${user.id}`, {
          full_name: form.full_name,
          role:      form.role,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        })
      } else {
        await api.post('/auth/users', {
          full_name: form.full_name,
          email:     form.email,
          password:  form.password,
          role:      form.role,
        })
      }
      qc.invalidateQueries({ queryKey: ['users-admin'] })
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Failed to save user')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40,
    border: '1.5px solid rgba(5,17,76,0.13)', borderRadius: 9,
    padding: '0 12px', fontSize: 13, color: '#05114C',
    background: '#fff', outline: 'none',
    fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#05114C', marginBottom: 5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,17,76,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto' }}>

        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(5,17,76,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: '#05114C', margin: 0 }}>
            {isEdit ? `Edit — ${user.full_name}` : 'Create new user'}
          </h3>
          <button onClick={onClose} style={{ background: 'rgba(5,17,76,0.06)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} color="#05114C" />
          </button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Full name <span style={{ color: '#b33020' }}>*</span></label>
              <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. John Banda" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email <span style={{ color: '#b33020' }}>*</span></label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={isEdit} placeholder="you@inzu-mcs.com"
                style={{ ...inputStyle, background: isEdit ? '#F7F6F3' : '#fff', color: isEdit ? '#9aa0b8' : '#05114C' }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Role <span style={{ color: '#b33020' }}>*</span></label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
              {ROLES.map(r => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            {/* Role description */}
            <div style={{ marginTop: 6, padding: '8px 12px', background: getRoleConfig(form.role).bg, borderRadius: 8, fontSize: 12, color: getRoleConfig(form.role).color }}>
              {getRoleConfig(form.role).description}
            </div>
          </div>

          <div>
            <label style={labelStyle}>{isEdit ? 'New password' : 'Password'} {!isEdit && <span style={{ color: '#b33020' }}>*</span>}</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? 'Leave blank to keep current password' : 'Set a strong password'}
              style={inputStyle} />
          </div>

          {isEdit && (
            <div>
              <label style={labelStyle}>Account status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[true, false].map(val => (
                  <button key={String(val)} onClick={() => setForm(f => ({ ...f, is_active: val }))}
                    style={{ flex: 1, height: 38, borderRadius: 9, border: `1.5px solid ${form.is_active === val ? (val ? '#1a6b2e' : '#b33020') : 'rgba(5,17,76,0.12)'}`, background: form.is_active === val ? (val ? '#e6f4ea' : '#fdecea') : 'transparent', color: form.is_active === val ? (val ? '#1a6b2e' : '#b33020') : '#9aa0b8', fontSize: 13, fontWeight: form.is_active === val ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.15s' }}>
                    {val ? 'Active' : 'Inactive'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#fdecea', border: '1px solid #f5c6c2', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#b33020' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{ height: 42, background: 'rgba(5,17,76,0.06)', color: '#05114C', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
            <button onClick={submit} disabled={busy}
              style={{ height: 42, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab]           = useState<'users' | 'roles'>('users')
  const [search, setSearch]     = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [modalUser, setModalUser]   = useState<any | null | 'new'>(null)
  const qc = useQueryClient()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-admin'],
    queryFn:  () => api.get('/auth/users-list').then(r => r.data),
  })

  const filtered = users.filter((u: any) => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = !filterRole || u.role === filterRole
    return matchSearch && matchRole
  })

  const usersByRole = ROLES.reduce((acc, r) => {
    acc[r.key] = users.filter((u: any) => u.role === r.key).length
    return acc
  }, {} as Record<string, number>)

  async function deleteUser(id: string) {
    if (!confirm('Remove this user? They will no longer be able to log in.')) return
    try {
      await api.delete(`/auth/users/${id}`)
      qc.invalidateQueries({ queryKey: ['users-admin'] })
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Failed to remove user')
    }
  }

  return (
    <div style={{ padding: '24px 28px 40px', width: '100%', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: '#05114C', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
            User management
          </h1>
          <p style={{ fontSize: 12, color: '#9aa0b8', margin: 0 }}>
            {users.length} users · {ROLES.length} roles · No self-registration
          </p>
        </div>
        <button onClick={() => setModalUser('new')}
          style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Plus size={14} /> Add user
        </button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 2, background: '#fff', borderRadius: 10, border: '1px solid rgba(5,17,76,0.08)', padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {[
          { key: 'users' as const, label: `Users (${users.length})` },
          { key: 'roles' as const, label: 'Roles & permissions'     },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '7px 18px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", background: tab === t.key ? '#05114C' : 'transparent', color: tab === t.key ? '#fff' : '#5a6282', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Users tab ── */}
      {tab === 'users' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', height: 38 }}>
              <Search size={13} style={{ color: '#9aa0b8', flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..."
                style={{ border: 'none', outline: 'none', fontSize: 13, color: '#05114C', background: 'transparent', width: '100%', fontFamily: "'DM Sans',sans-serif" }} />
            </div>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              style={{ height: 38, border: '1px solid rgba(5,17,76,0.12)', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#05114C', background: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}>
              <option value="">All roles</option>
              {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>

          {/* Role summary chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {ROLES.filter(r => usersByRole[r.key] > 0).map(r => (
              <div key={r.key}
                onClick={() => setFilterRole(filterRole === r.key ? '' : r.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: filterRole === r.key ? r.bg : '#fff', border: `1.5px solid ${filterRole === r.key ? r.color : 'rgba(5,17,76,0.1)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: r.color }}>{r.label}</span>
                <span style={{ fontSize: 10, color: r.color, opacity: 0.7 }}>{usersByRole[r.key]}</span>
              </div>
            ))}
          </div>

          {/* Users table */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(5,17,76,0.08)', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0b8', fontSize: 13 }}>Loading users...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <Users size={28} style={{ color: '#9aa0b8', margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: '#9aa0b8', margin: '0 0 16px' }}>
                  {search || filterRole ? 'No users match your filter.' : 'No users yet.'}
                </p>
                {!search && !filterRole && (
                  <button onClick={() => setModalUser('new')}
                    style={{ height: 38, background: '#D97757', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif", cursor: 'pointer' }}>
                    + Add first user
                  </button>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F6F3' }}>
                    {['User', 'Role', 'Status', 'Created', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#9aa0b8', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(5,17,76,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u: any) => (
                    <UserRow key={u.id} user={u} onEdit={setModalUser} onDelete={deleteUser} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Roles tab ── */}
      {tab === 'roles' && (
        <div>
          <div style={{ background: 'rgba(5,17,76,0.04)', border: '1px solid rgba(5,17,76,0.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#5a6282', lineHeight: 1.6 }}>
            <strong style={{ color: '#05114C' }}>How permissions work:</strong> Each role has a default set of module permissions. Click any role to expand it and adjust. <strong>None</strong> = no access to that page. <strong>View</strong> = read-only. <strong>Edit</strong> = full create/edit access. Changes here are visual — wire them to your API middleware in Phase 3.
          </div>
          {ROLES.map(r => (
            <RoleCard key={r.key} roleKey={r.key} userCount={usersByRole[r.key] ?? 0} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalUser && (
        <UserModal
          user={modalUser === 'new' ? undefined : modalUser}
          onClose={() => setModalUser(null)}
        />
      )}
    </div>
  )
}