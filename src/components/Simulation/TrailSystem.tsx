import { type FC, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export type Trail = Array<[number, number, number]>

export class TrailManager {
  private trails: Trail[] = []
  private maxPoints: number

  constructor(particleCount: number, maxPoints: number = 50) {
    this.trails = Array(particleCount).fill(null).map(() => [])
    this.maxPoints = maxPoints
  }

  updateTrail(particleId: number, position: [number, number, number]) {
    if (!this.trails[particleId]) {
      this.trails[particleId] = []
    }

    // Check if the position has changed significantly from the last point
    const lastPoint = this.trails[particleId][this.trails[particleId].length - 1]
    if (lastPoint) {
      const [x1, y1, z1] = lastPoint
      const [x2, y2, z2] = position
      const distSq = (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1) + (z2-z1)*(z2-z1)
      // Only skip if practically no movement
      if (distSq < 0.0001) {
        return
      }
    }

    this.trails[particleId].push(position)
    if (this.trails[particleId].length > this.maxPoints) {
      this.trails[particleId].shift()
    }
  }

  clearTrails() {
    this.trails = this.trails.map(() => [])
  }

  resetTrail(particleId: number, position: [number, number, number]) {
    this.trails[particleId] = [position]
  }

  getTrailLength(particleId: number): number {
    return this.trails[particleId]?.length || 0
  }

  getTrails() {
    return this.trails
  }
}

interface TrailRendererProps {
  trailManager: TrailManager
  getColor: (id: number) => THREE.Color
}

export const TrailRenderer: FC<TrailRendererProps> = ({ trailManager, getColor }) => {
  const trails = trailManager.getTrails()

  // Create lines with useMemo
  const lines = useMemo(() => {
    return trails.map(() => {
      const geometry = new THREE.BufferGeometry()
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(0xffffff),
        transparent: true,
        opacity: 0.8,
        linewidth: 1.5,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending
      })
      const line = new THREE.Line(geometry, material)
      line.frustumCulled = false
      return line
    })
  }, [trails.length])

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      lines.forEach(line => {
        line.geometry.dispose()
        ;(line.material as THREE.LineBasicMaterial).dispose()
      })
    }
  }, [lines])

  // Update line positions and colors each frame
  useFrame(() => {
    trails.forEach((trail, index) => {
      const line = lines[index]
      if (!line || trail.length < 2) return

      // Update positions
      const positions = new Float32Array(trail.flatMap(p => p))
      if (positions.length > 0) {
        line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        line.geometry.attributes.position.needsUpdate = true
      }

      // Update color
      let color
      try {
        color = getColor(index)
        if (isNaN(color.r) || isNaN(color.g) || isNaN(color.b)) {
          color = new THREE.Color(0xffffff)
        }
      } catch (e) {
        color = new THREE.Color(0xffffff)
      }

      const material = line.material as THREE.LineBasicMaterial
      material.color = color
      material.opacity = 0.8
      material.needsUpdate = true
    })
  })

  return (
    <group>
      {lines.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
    </group>
  )
} 