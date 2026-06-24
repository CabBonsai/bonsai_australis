'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CollectionPage() {
  const [trees, setTrees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchTrees() }, [])

  async function fetchTrees() {
    setLoading(true)
    const { data } = await supabase
      .from('collection')
      .select('*')
      .order('tree_number', { ascending: true })
    setTrees(data || [])
    setLoading(false)
  }

  async function handleAddTree() {
    const { data, error } = await supabase
      .from('collection')
      .insert({ display_name: 'New Tree', in_collection: true })
      .select()
      .single()
    if (error) { alert('Error: ' + error.message); return }
    window.location.href = \`/collection/\${data.collection_id}\`
  }

  function isOverdue(dateStr: string | null) {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  const filtered = trees.filter(t =>
    !search.trim() ||
    (t.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.tree_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.species || '').toLowerCase().includes(search.toLowerCase())
  )

  const healthColor: Record<string, string> = {
    'Excellent': '#16a34a',
    'Good': '#65a30d',
    'Stressed': '#d97706',
    'Recovering': '#9333ea',
    'Critical': '#dc2626',
  }

  const statusColor: Record<string, string> = {
    'Developing': '#3b82f6',
    'Refining': '#8b5cf6',
    'Show Ready': '#16a34a',
    'Maintenance': '#6b7280',
  }

  return (
    <main style={{maxWidth:'680px',margin:'0 auto',padding:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div>
          <a href="/" style={{fontSize:'13px',color:'#6b7280',textDecoration:'none'}}>← Admin Home</a>
          <h1 style={{fontSize:'24px',fontWeight:'700',margin:'4px 0 0'}}>My Bonsai Collection</h1>
        </div>
        <button
          onClick={handleAddTree}
          style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:'8px',padding:'10px 16px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}
        >
          + Add Tree
        </button>
      </div>

      <input
        type="text"
        placeholder="Search trees..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'12px 16px',fontSize:'15px',marginBottom:'12px',boxSizing:'border-box'}}
      />

      <p style={{fontSize:'13px',color:'#9ca3af',marginBottom:'12px'}}>{filtered.length} tree{filtered.length !== 1 ? 's' : ''}</p>

      {loading && <p style={{color:'#9ca3af',textAlign:'center',padding:'40px'}}>Loading...</p>}

      {!loading && filtered.map(t => {
        const overdue = isOverdue(t.next_repot_due) || isOverdue(t.next_fertilise_due) || isOverdue(t.due_prune_date) || isOverdue(t.date_check_wire)
        return (
          
            key={t.collection_id}
            href={\`/collection/\${t.collection_id}\`}
            style={{display:'block',textDecoration:'none',color:'inherit',background:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',marginBottom:'10px',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}
          >
            <div style={{display:'flex',gap:'12px',alignItems:'stretch'}}>
              {t.image_url ? (
                <img
                  src={t.image_url}
                  alt={t.display_name}
                  style={{width:'90px',height:'90px',objectFit:'cover',flexShrink:0}}
                />
              ) : (
                <div style={{width:'90px',height:'90px',background:'#f1f5f9',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px'}}>
                  🌿
                </div>
              )}
              <div style={{flex:1,padding:'10px 12px 10px 0',minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <span style={{fontWeight:'700',fontSize:'16px'}}>{t.display_name}</span>
                    {t.tree_number && <span style={{fontSize:'12px',color:'#9ca3af',marginLeft:'8px'}}>#{t.tree_number}</span>}
                  </div>
                  {overdue && <span style={{fontSize:'11px',background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:'6px',padding:'2px 6px',flexShrink:0}}>⚠ Overdue</span>}
                </div>
                {t.tree_name && <p style={{fontSize:'13px',color:'#6b7280',margin:'2px 0',fontStyle:'italic'}}>"{t.tree_name}"</p>}
                {t.species && <p style={{fontSize:'13px',color:'#374151',margin:'2px 0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.species}</p>}
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'6px'}}>
                  {t.status && (
                    <span style={{fontSize:'11px',fontWeight:'600',padding:'2px 8px',borderRadius:'20px',background:(statusColor[t.status] || '#6b7280')+'22',color:statusColor[t.status] || '#6b7280'}}>
                      {t.status}
                    </span>
                  )}
                  {t.health_status && (
                    <span style={{fontSize:'11px',fontWeight:'600',padding:'2px 8px',borderRadius:'20px',background:(healthColor[t.health_status] || '#6b7280')+'22',color:healthColor[t.health_status] || '#6b7280'}}>
                      {t.health_status}
                    </span>
                  )}
                  {t.is_favourite && <span style={{fontSize:'12px'}}>⭐</span>}
                </div>
              </div>
            </div>
          </a>
        )
      })}
    </main>
  )
}
