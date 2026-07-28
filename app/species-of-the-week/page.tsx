'use client'

import Link from 'next/link'
import SpeciesOfTheWeekPicker from '@/components/SpeciesOfTheWeekPicker'

export default function SpeciesOfTheWeekPage() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <Link
        href="/"
        style={{ display: 'inline-block', fontSize: 14, color: '#6b7280', marginBottom: 16, textDecoration: 'none' }}
      >
        &larr; Dashboard
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '18px' }}>
        Species of the Week
      </h1>
      <SpeciesOfTheWeekPicker />
    </div>
  )
}
