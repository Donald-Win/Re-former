/**
 * PhotoAttachStep — shared wizard step for attaching photos to a PDF.
 *
 * Props:
 *   photos   – array of { dataUrl: string, name: string }
 *   onChange – setter: (updaterFn) => void  (called with prev => [...prev, newItem])
 *   accent   – optional hex colour string for branding
 */
import React, { useRef } from 'react'
import { Camera, X, ImageIcon } from 'lucide-react'

export function PhotoAttachStep({ photos = [], onChange, accent = '#4f46e5' }) {
  const inputRef = useRef(null)

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        onChange(prev => [...prev, { dataUrl: ev.target.result, name: file.name }])
      }
      reader.readAsDataURL(file)
    })
    // Reset so the same file can be re-added if removed and re-selected
    e.target.value = ''
  }

  const removePhoto = (idx) => {
    onChange(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
        Select photos to attach at the end of the PDF.
        Each photo appears on its own full page — landscape photos are automatically placed on a landscape page.
      </p>

      {/* Hidden file input — accepts any image, allows multiples, prefers camera on iOS */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        style={{ display: 'none' }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 10,
          border: `2px dashed ${accent}`,
          background: accent + '18',
          color: accent,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Camera size={18} />
        {photos.length === 0 ? 'Add Photos' : 'Add More Photos'}
      </button>

      {photos.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 0',
          color: '#d1d5db',
        }}>
          <ImageIcon size={44} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
          <div style={{ fontSize: 13 }}>No photos attached — tap above to add photos from your camera roll or take a new photo.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {photos.map((photo, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#f3f4f6',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                }}
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.name || `Photo ${idx + 1}`}
                  style={{
                    width: '100%',
                    aspectRatio: '4/3',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {/* Remove button */}
                <button
                  onClick={() => removePhoto(idx)}
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    background: 'rgba(0,0,0,0.65)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 26,
                    height: 26,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <X size={14} />
                </button>
                {/* Filename label */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                  color: '#fff',
                  fontSize: 10,
                  padding: '8px 6px 4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  📷 {photo.name || `Photo ${idx + 1}`}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 14,
            padding: '10px 14px',
            background: accent + '12',
            border: `1px solid ${accent}40`,
            borderRadius: 8,
            fontSize: 13,
            color: accent,
            fontWeight: 600,
            textAlign: 'center',
          }}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''} will be appended to the PDF
          </div>
        </>
      )}
    </div>
  )
}
