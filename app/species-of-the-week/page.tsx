'use client'

import SpeciesOfTheWeekPicker from '@/components/SpeciesOfTheWeekPicker'

export default function SpeciesOfTheWeekPage() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '18px' }}>
        Species of the Week
      </h1>
      <SpeciesOfTheWeekPicker />
    </div>
  )
}
