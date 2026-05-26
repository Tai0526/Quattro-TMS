import { can } from '@/lib/permissions'
import type { Permission } from '@/lib/permissions'
import { ShieldAlert } from 'lucide-react'

interface Props {
  module: string
  level?: Permission
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function CanAccess({ module, level = 'view', children, fallback }: Props) {
  if (can(module, level)) return <>{children}</>

  return fallback ? <>{fallback}</> : (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: '#fdecea', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <ShieldAlert size={24} style={{ color: '#b33020' }} />
      </div>
      <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: '#05114C', margin: '0 0 8px' }}>
        Access restricted
      </h2>
      <p style={{ fontSize: 13, color: '#9aa0b8', margin: 0, maxWidth: 320 }}>
        Your role does not have permission to view this page. Contact your administrator if you need access.
      </p>
    </div>
  )
}