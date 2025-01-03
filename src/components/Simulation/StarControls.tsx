import React, { useState, useRef, useEffect } from 'react'
import { Html } from '@react-three/drei'
import type { SunData } from './types'

interface StarControlsProps {
  stars: SunData[]
  onAddStar: () => void
  onRemoveStar: (index: number) => void
  onUpdateStar: (index: number, mass: number) => void
  onReset: () => void
}

export const StarControls: React.FC<StarControlsProps> = ({
  stars,
  onAddStar,
  onRemoveStar,
  onUpdateStar,
  onReset
}) => {
  const [position, setPosition] = useState({ x: 16, y: 16 })
  const [isDragging, setIsDragging] = useState(false)
  const offset = useRef({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = windowRef.current?.getBoundingClientRect()
    if (rect) {
      offset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
      setIsDragging(true)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - offset.current.x
        const newY = e.clientY - offset.current.y
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <Html>
      <div 
        ref={windowRef}
        style={{ 
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 1000
        }}
        className="w-64 bg-black/90 backdrop-blur-sm shadow-xl rounded-lg overflow-hidden select-none"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div 
          className="bg-neutral-800 px-4 py-2 cursor-move flex justify-between items-center"
          onMouseDown={handleMouseDown}
        >
          <h2 className="text-sm font-medium text-neutral-200">Stars</h2>
          <div className="flex gap-1">
            <button 
              onClick={onAddStar} 
              disabled={stars.length >= 10}
              className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button 
              onClick={onReset}
              className="text-xs px-2 py-1 bg-neutral-700/50 hover:bg-neutral-700/70 text-neutral-300 rounded"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {stars.map((star, index) => (
            <div 
              key={index}
              className="px-4 py-3 border-b border-neutral-800 last:border-0"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-400">Star {index + 1}</span>
                <button 
                  onClick={() => onRemoveStar(index)}
                  className="text-xs px-2 py-0.5 text-red-400 hover:bg-red-500/20 rounded"
                >
                  Remove
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">Mass</span>
                  <input
                    type="number"
                    value={star.mass}
                    min={50000}
                    max={500000}
                    step={10000}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdateStar(index, Number(e.target.value))}
                    className="flex-1 text-xs bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">Colors</span>
                  <div className="flex gap-1">
                    <div 
                      className="w-4 h-4 rounded-sm border border-neutral-700"
                      style={{ background: star.color }}
                    />
                    <div 
                      className="w-4 h-4 rounded-sm border border-neutral-700"
                      style={{ background: star.emissiveColor }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Html>
  )
} 