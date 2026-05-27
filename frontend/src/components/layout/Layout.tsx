import { useState, useEffect } from 'react'
import { can, getRole } from '@/lib/permissions'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Truck, Users, Zap, AlertTriangle,
  FileText, LogOut, ChevronRight, Menu, PanelLeftClose,
  PanelLeft, Wrench, ShieldCheck, BarChart2, Settings
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const ALL_NAV = [
  { to: '/',                  label: 'Dashboard',         icon: LayoutDashboard, module: 'fleet',             end: true  },
  { to: '/vehicles',          label: 'Fleet',             icon: Truck,           module: 'fleet',             end: false },
  { to: '/drivers',           label: 'Drivers',           icon: Users,           module: 'drivers',           end: false },
  { to: '/maintenance',       label: 'Maintenance',       icon: Wrench,          module: 'maintenance',       end: false },
  { to: '/speed-events',      label: 'Speed events',      icon: Zap,             module: 'speed_events',      end: false },
  { to: '/incidents',         label: 'Incidents',         icon: AlertTriangle,   module: 'incidents',         end: false },
  { to: '/driver-compliance', label: 'Driver compliance', icon: ShieldCheck,     module: 'driver_compliance', end: false },
  { to: '/compliance',        label: 'Compliance report', icon: BarChart2,       module: 'compliance_report', end: false },
  { to: '/documents',         label: 'Documents',         icon: FileText,        module: 'documents',         end: false },
  { to: '/admin',             label: 'User management',   icon: Settings,        module: 'admin',             end: false },
]

const FULL_W = 224
const ICON_W = 52
const BREAK  = 900

export default function Layout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const qc         = useQueryClient()
  const [expanded, setExpanded]     = useState(true)
  const [mobile, setMobile]         = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [role, setRole]             = useState<string>(getRole())

  // ── Fetch current user — refetch whenever the access token changes ──
  const token = localStorage.getItem('access_token')
  const { data: me } = useQuery({
    queryKey: ['me', token],           // key includes token so it refetches on login
    queryFn:  () => api.get('/auth/me').then(r => r.data),
    staleTime: 5 * 60 * 1000,         // 5 minutes — not infinity
    enabled:  !!token,
    retry: false,
  })

  // ── Sync role on every route change ──────────────────────────────────
  useEffect(() => {
    const newRole = getRole()
    setRole(newRole)
    // If token exists but me query has stale data, refetch
    if (localStorage.getItem('access_token')) {
      qc.invalidateQueries({ queryKey: ['me'] })
    }
  }, [location.pathname])

  // ── Listen for localStorage changes (cross-tab login) ────────────────
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'user_role' || e.key === 'access_token') {
        setRole(getRole())
        qc.invalidateQueries({ queryKey: ['me'] })
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const nav = ALL_NAV.filter(item => can(item.module, 'view'))

  useEffect(() => {
    function check() {
      const isMobile = window.innerWidth < BREAK
      setMobile(isMobile)
      if (isMobile) { setExpanded(false); setMobileOpen(false) }
      else setExpanded(true)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { if (mobile) setMobileOpen(false) }, [location.pathname])

  function logout() {
    localStorage.clear()
    qc.clear()          // clear ALL cached queries so next login starts fresh
    navigate('/login')
  }

  const sidebarW   = mobile ? FULL_W : expanded ? FULL_W : ICON_W
  const showLabels = mobile ? mobileOpen : expanded
  const activePage = nav.find(n => n.end ? location.pathname === '/' : location.pathname.startsWith(n.to))?.label ?? 'QUATTRO CO TMIS'

  const initials = me?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('') ?? '?'

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: "'DM Sans',sans-serif" }}>

      {mobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(5,17,76,0.5)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
      )}

      <aside style={{
        width: sidebarW, flexShrink: 0,
        background: '#000000',
        display: 'flex', flexDirection: 'column',
        position: mobile ? 'fixed' : 'relative',
        top: 0, left: 0, bottom: 0, zIndex: 50,
        transform: mobile ? (mobileOpen ? 'translateX(0)' : `translateX(-${FULL_W}px)`) : 'translateX(0)',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>

        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(217,119,87,0.07)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ padding: showLabels ? '20px 16px 18px' : '20px 0 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: showLabels ? 'flex-start' : 'center', gap: 10, minHeight: 76, flexShrink: 0 }}>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: showLabels ? 'auto' : '100%' }}>
            <img src="/logo.png" alt="Quattro"
              style={{ height: 30, width: 30, objectFit: 'contain', borderRadius: 6 }}
              onError={e => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                const fb = el.nextSibling as HTMLElement
                if (fb) fb.style.display = 'flex'
              }}
            />
            <div style={{ display: 'none', width: 30, height: 30, borderRadius: 6, background: '#D97757', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, color: '#fff' }}>IN</div>
          </div>
          {showLabels && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: '#fff' }}>Quattro Co Ltd</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Transport Management</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {showLabels && (
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.09em', textTransform: 'uppercase', padding: '6px 8px 4px', whiteSpace: 'nowrap' }}>
              Main menu
            </div>
          )}
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={!showLabels ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center',
                gap: showLabels ? 9 : 0,
                justifyContent: showLabels ? 'flex-start' : 'center',
                padding: showLabels ? '8px 10px' : '9px 0',
                borderRadius: 8, fontSize: 12, fontWeight: isActive ? 500 : 400,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                background: isActive ? 'rgba(217,119,87,0.18)' : 'transparent',
                borderLeft: isActive && showLabels ? '2.5px solid #D97757' : '2.5px solid transparent',
                transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative',
              })}
            >
              {({ isActive }) => (
                <>
                  {!showLabels && isActive && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: '#D97757', borderRadius: '0 2px 2px 0' }} />}
                  <Icon size={14} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }} />
                  {showLabels && <span style={{ flex: 1 }}>{label}</span>}
                  {showLabels && isActive && <ChevronRight size={11} style={{ opacity: 0.4, flexShrink: 0 }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Sign out */}
        <div style={{ padding: '8px 8px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>

          {showLabels && me && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px 12px' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#D97757', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 11, color: '#fff' }}>
                  {initials}
                </span>
              </div>
              <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {me.full_name}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                  {me.role?.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          )}

          {!showLabels && me && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
              <div
                title={`${me.full_name} — ${me.role?.replace(/_/g, ' ')}`}
                style={{ width: 30, height: 30, borderRadius: 8, background: '#D97757', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
              >
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 11, color: '#fff' }}>
                  {initials}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            title={!showLabels ? 'Sign out' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: showLabels ? 9 : 0, justifyContent: showLabels ? 'flex-start' : 'center', width: '100%', padding: showLabels ? '9px 10px' : '10px 0', borderRadius: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {showLabels && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ height: 48, flexShrink: 0, background: '#fff', borderBottom: '1px solid rgba(5,17,76,0.08)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
          <button
            onClick={() => mobile ? setMobileOpen(o => !o) : setExpanded(o => !o)}
            style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid rgba(5,17,76,0.1)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(5,17,76,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {mobile ? <Menu size={15} color="#000000" /> : expanded ? <PanelLeftClose size={15} color="#000000" /> : <PanelLeft size={15} color="#000000" />}
          </button>
          <div style={{ width: 1, height: 18, background: 'rgba(5,17,76,0.1)' }} />
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: '#000000' }}>{activePage}</span>
          <div style={{ flex: 1 }} />

          {me && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#000000', marginRight: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#D97757', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 10, color: '#fff' }}>{initials}</span>
              </div>
              <span style={{ fontWeight: 500, fontSize: 12, color: '#000000' }}>{me.full_name}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1a6b2e', background: '#e6f4ea', borderRadius: 20, padding: '4px 10px', flexShrink: 0 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1a6b2e' }} />
            System online
          </div>
        </div>

        <main style={{ flex: 1, overflow: 'auto', background: '#F7F6F3', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}