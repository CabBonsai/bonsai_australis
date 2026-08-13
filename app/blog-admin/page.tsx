'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { uploadPhoto } from '@/lib/uploadPhoto'

const inputClass = "w-full border rounded px-4 py-3 text-base min-h-[48px]"

type Post = {
  id: number
  title: string
  slug: string
  body: string
  linked_sp_no: number | null
  linked_gallery_id: number | null
  photos: string[]
  is_published: boolean
  published_at: string | null
}

type GalleryOption = { id: number, title: string }

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function BlogAdmin() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPostId, setEditingPostId] = useState<number | 'new' | null>(null)

  useEffect(() => { fetchPosts() }, [])

  async function fetchPosts() {
    setLoading(true)
    const res = await fetch('/api/blog-posts')
    const data = res.ok ? await res.json() : []
    setPosts(data || [])
    setLoading(false)
  }

  if (loading) return <main className="max-w-2xl mx-auto p-4"><p>Loading...</p></main>

  if (editingPostId !== null) {
    const post = editingPostId === 'new' ? null : posts.find(p => p.id === editingPostId) || null
    return <PostEditor post={post} onDone={() => { setEditingPostId(null); fetchPosts() }} />
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <Link
        href="/"
        style={{ display: 'inline-block', fontSize: 14, color: '#6b7280', marginBottom: 16, textDecoration: 'none' }}
      >
        &larr; Dashboard
      </Link>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Blog Posts</h1>
        <button onClick={() => setEditingPostId('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">+ New Post</button>
      </div>
      <div className="space-y-2">
        {posts.map(post => (
          <button
            key={post.id}
            onClick={() => setEditingPostId(post.id)}
            className="w-full flex justify-between items-center border rounded-lg p-3 text-left"
          >
            <div>
              <p className="font-medium text-sm">{post.title}</p>
              <p className="text-xs text-gray-400">/{post.slug}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${post.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {post.is_published ? 'Published' : 'Draft'}
            </span>
          </button>
        ))}
        {posts.length === 0 && <p className="text-sm text-gray-400">No posts yet.</p>}
      </div>
    </main>
  )
}

function PostEditor({ post, onDone }: { post: Post | null, onDone: () => void }) {
  const [title, setTitle] = useState(post?.title || '')
  const [slug, setSlug] = useState(post?.slug || '')
  const [slugTouched, setSlugTouched] = useState(!!post)
  const [body, setBody] = useState(post?.body || '')
  const [linkedSpNo, setLinkedSpNo] = useState<number | null>(post?.linked_sp_no ?? null)
  const [linkedGalleryId, setLinkedGalleryId] = useState<number | null>(post?.linked_gallery_id ?? null)
  const [photos, setPhotos] = useState<string[]>(post?.photos || [])
  const [isPublished, setIsPublished] = useState(post?.is_published ?? false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [speciesResults, setSpeciesResults] = useState<any[]>([])
  const [speciesLabel, setSpeciesLabel] = useState('')
  const [galleryOptions, setGalleryOptions] = useState<GalleryOption[]>([])

  useEffect(() => {
    supabase.from('public_gallery').select('id, title').eq('is_published', true).order('title')
      .then(({ data }) => setGalleryOptions(data || []))

    if (post?.linked_sp_no) {
      supabase.from('species').select('species').eq('sp_no', post.linked_sp_no).single()
        .then(({ data }) => { if (data) setSpeciesLabel(data.species) })
    }
  }, [])

  useEffect(() => {
    if (!title || slugTouched) return
    setSlug(slugify(title))
  }, [title, slugTouched])

  useEffect(() => {
    if (!speciesQuery.trim()) { setSpeciesResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('species').select('sp_no, species').ilike('species', `%${speciesQuery}%`).limit(20)
      setSpeciesResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [speciesQuery])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const publicUrl = await uploadPhoto(file, 'tree-photos', 'blog_')
      setPhotos(prev => [...prev, publicUrl])
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removePhoto(url: string) {
    setPhotos(prev => prev.filter(p => p !== url))
  }

  async function handleSave() {
    if (!title.trim() || !slug.trim() || !body.trim()) {
      alert('Title, slug and body are required.')
      return
    }
    setSaving(true)
    const payload = {
      title,
      slug,
      body,
      linked_sp_no: linkedSpNo,
      linked_gallery_id: linkedGalleryId,
      photos,
      is_published: isPublished,
      published_at: isPublished ? (post?.published_at || new Date().toISOString()) : post?.published_at || null,
      updated_at: new Date().toISOString(),
    }
    const res = post
      ? await fetch('/api/blog-posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: post.id, ...payload }),
        })
      : await fetch('/api/blog-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert('Save failed: ' + (data.error || res.status))
      return
    }
    onDone()
  }

  async function handleDelete() {
    if (!post) return
    if (!confirm('Delete this post permanently?')) return
    const res = await fetch(`/api/blog-posts?id=${post.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert('Delete failed: ' + (data.error || res.status))
      return
    }
    onDone()
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <button onClick={onDone} className="text-sm text-gray-500 mb-4">&larr; Back to list</button>
      <h1 className="text-xl font-semibold mb-4">{post ? 'Edit Post' : 'New Post'}</h1>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Title</span>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
      </label>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Slug (URL)</span>
        <input type="text" value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }} className={inputClass} />
        <span className="text-xs text-gray-400">/blog/{slug || '...'}</span>
      </label>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Body</span>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} className={inputClass} />
      </label>

      <div className="mb-3">
        <span className="text-gray-500 block mb-1 text-sm">Link a species (optional)</span>
        {speciesLabel && !speciesQuery && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm bg-gray-100 px-3 py-2 rounded">{speciesLabel}</span>
            <button type="button" onClick={() => { setLinkedSpNo(null); setSpeciesLabel('') }} className="text-red-500 text-sm">✕</button>
          </div>
        )}
        <input
          type="text"
          placeholder="Search species..."
          value={speciesQuery}
          onChange={e => setSpeciesQuery(e.target.value)}
          className={inputClass}
        />
        {speciesResults.length > 0 && (
          <div className="border rounded mt-1 max-h-48 overflow-y-auto">
            {speciesResults.map(s => (
              <button
                key={s.sp_no}
                type="button"
                onClick={() => { setLinkedSpNo(s.sp_no); setSpeciesLabel(s.species); setSpeciesQuery(''); setSpeciesResults([]) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b"
              >
                {s.species}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Link a published gallery tree (optional)</span>
        <select value={linkedGalleryId ?? ''} onChange={e => setLinkedGalleryId(e.target.value ? parseInt(e.target.value) : null)} className={inputClass}>
          <option value="">None</option>
          {galleryOptions.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </label>

      <div className="mb-3">
        <span className="text-gray-500 block mb-2 text-sm">Photos for this post</span>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {photos.map(url => (
            <div key={url} className="relative">
              <img src={url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8 }} />
              <button type="button" onClick={() => removePhoto(url)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs">✕</button>
            </div>
          ))}
        </div>
        <label className="inline-block bg-gray-100 border rounded px-3 py-2 text-sm cursor-pointer">
          {uploading ? 'Uploading...' : '📷 Add Photo'}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm mb-6">
        <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
        Published (visible on public site)
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold w-full text-lg disabled:opacity-50 mb-3"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>

      {post && (
        <button onClick={handleDelete} className="text-red-500 text-sm w-full text-center">
          Delete this post
        </button>
      )}
    </main>
  )
}
