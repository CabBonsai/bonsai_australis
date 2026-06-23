'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      window.location.href = '/'
    } else {
      setError('Incorrect password')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: '#f9fafb' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '380px', backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.png" alt="Bonsai Australis" style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>Bonsai Australis</h1>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>Enter password to continue</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 16px', fontSize: '16px', marginBottom: '12px', boxSizing: 'border-box' }}
        />
        {error && <p style={{ color: '#dc2626', fontSize: '14px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', backgroundColor: loading ? '#93c5fd' : '#2563eb', color: '#fff', padding: '12px', borderRadius: '8px', fontWeight: '600', fontSize: '16px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Checking...' : 'Log In'}
        </button>
      </form>
    </div>
  )
}