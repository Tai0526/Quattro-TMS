import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

export default function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      localStorage.setItem('user_role', payload.role)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    border: '1.5px solid rgba(5,17,76,0.13)',
    borderRadius: 10,
    padding: '0 14px',
    fontSize: 13,
    color: '#000000',
    background: '#fff',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: "'DM Sans',sans-serif",
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      {/* ───────────────── LEFT PANEL ───────────────── */}
      <div
        style={{
          flex: '0 0 52%',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#000000',
        }}
      >
        {/* Centered image */}
        {/* Floating centered image */}
<div
  style={{
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'flex-start', // pushes image higher
    justifyContent: 'center',
    paddingTop: '70px', // controls height position
    zIndex: 0,
    pointerEvents: 'none',
  }}
>
  <img
    src="/login-bg.png"
    alt=""
    style={{
      width: '80%',
      maxWidth: '900px',
      height: 'auto',
      objectFit: 'contain',

      // makes it feel elevated
      filter: `
        drop-shadow(0 25px 45px rgba(0,0,0,0.45))
      `,

      // optional slight scale
      transform: 'scale(1.05)',
    }}
  />
</div>

        {/* Top content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding:
              'clamp(28px,4vw,44px) clamp(28px,4vw,44px) 0',
          }}
        >
          <img
            src="/logo.png"
            alt="INZU MCS"
            style={{
              height: 52,
              objectFit: 'contain',
              display: 'block',
            }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display =
                'none'
            }}
          />

          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 17,
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              Quattro Co Ltd
            </div>

            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.6)',
                marginTop: 2,
              }}
            >
              Transport Management System
            </div>
          </div>
        </div>

        {/* Bottom content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding:
              '0 clamp(28px,4vw,44px) clamp(28px,4vw,44px)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 3,
              borderRadius: 2,
              background: '#D97757',
              marginBottom: 14,
            }}
          />

          <p
            style={{
              fontFamily: "'Syne',sans-serif",
              fontSize: 'clamp(18px,2.2vw,24px)',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              margin: '0 0 8px',
            }}
          >
            Fleet operations,
            <br />
            built to serve FQM Trident.
          </p>

          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              margin: '0 0 18px',
            }}
          >
            Kalumbila, Zambia
          </p>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              🔒 Custom internal software developed for Quattro Co Ltd. Unauthorised access is strictly
              prohibited.
            </p>
          </div>
        </div>
      </div>

      {/* ───────────────── RIGHT PANEL ───────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F7F6F3',
          padding:
            'clamp(20px,3vw,48px) clamp(20px,4vw,60px)',
          overflow: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 28 }}>
            <h1
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 'clamp(20px,2.8vw,26px)',
                fontWeight: 700,
                color: '#000000',
                letterSpacing: '-0.02em',
                margin: '0 0 6px',
              }}
            >
              Sign in
            </h1>

            <p
              style={{
                fontSize: 13,
                color: '#9aa0b8',
                margin: 0,
              }}
            >
              Enter your credentials to access the portal
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 15 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#000000',
                  marginBottom: 6,
                }}
              >
                Email address
              </label>

              <input
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@quattro.co.zm"
                style={inputStyle}
                onFocus={(e) =>
                  (e.target.style.borderColor = '#D97757')
                }
                onBlur={(e) =>
                  (e.target.style.borderColor =
                    'rgba(5,17,76,0.13)')
                }
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#000000',
                  marginBottom: 6,
                }}
              >
                Password
              </label>

              <input
                type="password"
                value={password}
                required
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="••••••••"
                style={inputStyle}
                onFocus={(e) =>
                  (e.target.style.borderColor = '#D97757')
                }
                onBlur={(e) =>
                  (e.target.style.borderColor =
                    'rgba(5,17,76,0.13)')
                }
              />
            </div>

            {error && (
              <div
                style={{
                  background: '#fdecea',
                  border: '1px solid #f5c6c2',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 12,
                  color: '#b33020',
                  marginBottom: 15,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 44,
                background: loading
                  ? '#9aa0b8'
                  : '#D97757',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'Syne',sans-serif",
                cursor: loading
                  ? 'not-allowed'
                  : 'pointer',
                letterSpacing: '0.02em',
                transition: 'background 0.2s',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  (e.target as HTMLButtonElement).style.background = '#b85e3e'
              }}
              onMouseLeave={(e) => {
                if (!loading)
                  (e.target as HTMLButtonElement).style.background = '#D97757'
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div
            style={{
              marginTop: 24,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'rgba(5,17,76,0.04)',
              border:
                '1px solid rgba(5,17,76,0.07)',
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: '#9aa0b8',
                lineHeight: 1.65,
                margin: 0,
                textAlign: 'center',
              }}
            >
              Custom software developed for Quattro Co Ltd.
              <br />
              For access issues contact the system administrator.
            </p>
          </div>

          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              color: '#c4c8d8',
              textAlign: 'center',
            }}
          >
            © {new Date().getFullYear()} Quattro Co Ltd ·
            Confidential
          </p>
        </div>
      </div>
    </div>
  )
}