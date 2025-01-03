import { useControls as useLevaControls, button, folder } from 'leva'
import type { SimulationControls, SunData } from './types'
import { useState } from 'react'
import * as THREE from 'three'

// Calculate star color based on mass (using approximate stellar classification)
function getStarColorAndSize(mass: number): { color: string, emissiveColor: string, size: number } {
  // Mass is in simulation units, let's convert to solar masses (rough approximation)
  const solarMassRatio = mass / 100000

  // Temperature based on mass (rough approximation)
  const temperature = 5778 * Math.pow(solarMassRatio, 0.5) // Base temperature of Sun = 5778K

  // Calculate color based on temperature (approximation of blackbody radiation)
  let r, g, b
  if (temperature < 3500) {
    // Red stars
    r = 1
    g = 0.5 * (temperature / 3500)
    b = 0.2 * (temperature / 3500)
  } else if (temperature < 5000) {
    // Orange to yellow stars
    r = 1
    g = 0.7 + 0.3 * ((temperature - 3500) / 1500)
    b = 0.4 * (temperature / 5000)
  } else if (temperature < 6000) {
    // Yellow to white stars
    r = 1
    g = 1
    b = 0.6 + 0.4 * ((temperature - 5000) / 1000)
  } else if (temperature < 7500) {
    // White to blue-white stars
    r = 1 - 0.2 * ((temperature - 6000) / 1500)
    g = 1 - 0.1 * ((temperature - 6000) / 1500)
    b = 1
  } else {
    // Blue stars
    r = 0.8 - 0.3 * Math.min(1, (temperature - 7500) / 20000)
    g = 0.9 - 0.3 * Math.min(1, (temperature - 7500) / 20000)
    b = 1
  }

  // Convert to hex color
  const color = new THREE.Color(r, g, b)
  const emissiveColor = new THREE.Color(r * 0.8, g * 0.8, b * 0.8)

  // Calculate size based on mass using more accurate mass-radius relationship
  // R ∝ M^0.8 for main sequence stars
  // Scale factor of 10 to make stars visible at simulation scale
  const size = 10 * Math.pow(solarMassRatio, 0.8)

  return {
    color: '#' + color.getHexString(),
    emissiveColor: '#' + emissiveColor.getHexString(),
    size
  }
}

// Calculate orbital parameters for a new star
function calculateOrbitalParameters(existingSuns: SunData[], orbitRadius: number = 50): [THREE.Vector3, THREE.Vector3] {
  if (existingSuns.length === 0) {
    return [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.00001,
        (Math.random() - 0.5) * 0.00001,
        (Math.random() - 0.5) * 0.00001
      )
    ]
  }

  // Calculate center of mass and system radius
  const totalMass = existingSuns.reduce((sum, sun) => sum + sun.mass, 0)
  const centerOfMass = existingSuns.reduce((com, sun) => {
    return com.add(new THREE.Vector3(...sun.position).multiplyScalar(sun.mass / totalMass))
  }, new THREE.Vector3())

  // Calculate maximum distance from center of mass to determine system size
  const systemRadius = existingSuns.reduce((maxDist, sun) => {
    const pos = new THREE.Vector3(...sun.position)
    const dist = pos.distanceTo(centerOfMass)
    return Math.max(maxDist, dist)
  }, 0)

  // Place new star outside the existing system with some margin
  const safeOrbitRadius = Math.max(orbitRadius, systemRadius * 2)
  const angle = Math.random() * Math.PI * 2
  const inclination = (Math.random() - 0.5) * Math.PI * 0.05 // ±4.5° inclination

  const position = new THREE.Vector3(
    Math.cos(angle) * Math.cos(inclination) * safeOrbitRadius,
    Math.sin(inclination) * safeOrbitRadius,
    Math.sin(angle) * Math.cos(inclination) * safeOrbitRadius
  ).add(centerOfMass)

  // Calculate velocity for a stable orbit
  const relativePos = position.clone().sub(centerOfMass)
  const orbitAxis = new THREE.Vector3(0, 1, 0)
  const velocity = new THREE.Vector3().crossVectors(orbitAxis, relativePos).normalize()
  
  // Calculate orbital speed for a stable orbit
  // v = sqrt(GM/r) for circular orbit
  const G = 1000 // Gravitational constant in simulation units
  const centralMass = totalMass
  const distance = relativePos.length()
  const circularSpeed = Math.sqrt(G * centralMass / distance)
  const scaleFactor = 0.0005 // Scale down for visual stability
  velocity.multiplyScalar(circularSpeed * scaleFactor)

  return [position, velocity]
}

export function useControls(): SimulationControls {
  const [stars, setStars] = useState<SunData[]>([
    // Initial star (Sun-like)
    {
      mass: 100000, // 1 solar mass in simulation units
      color: '#ffff80',
      emissiveColor: '#ffdd44',
      position: [0, 0, 0],
      velocity: [0, 0, 0]
    }
  ])

  const simSettings = useLevaControls('Simulation', {
    particleCount: { value: 300, min: 1, max: 2000, step: 1 },
    gravityStrength: { value: 1000, min: 0, max: 10000, step: 100 },
    timeScale: { value: 1, min: 0.1, max: 10, step: 0.1 },
    showTrails: true,
    trailLength: { value: 50, min: 1, max: 200, step: 1 },
    worldSize: { value: 1000, min: 100, max: 5000, step: 100 }
  })

  const particleSettings = useLevaControls('Particles', {
    particleSize: { value: 1, min: 0.1, max: 5, step: 0.1 },
    elasticity: { value: 0.3, min: 0, max: 1, step: 0.1 },
    minLength: { value: 5, min: 1, max: 20, step: 1 },
    maxLength: { value: 15, min: 1, max: 20, step: 1 },
    minSides: { value: 3, min: 3, max: 8, step: 1 },
    maxSides: { value: 6, min: 3, max: 8, step: 1 },
    minRadius: { value: 1, min: 0.1, max: 5, step: 0.1 },
    maxRadius: { value: 3, min: 0.1, max: 5, step: 0.1 }
  })

  useLevaControls('Stars', {
    'Star Management': folder({
      'Reset to Single Star': button(() => {
        setStars([{
          mass: 100000,
          color: '#ffff80',
          emissiveColor: '#ffdd44',
          position: [0, 0, 0],
          velocity: [0, 0, 0]
        }])
      }),
      'Add Star': button(() => {
        if (stars.length >= 10) return

        const baseRadius = 50
        const orbitRadius = baseRadius * (1 + Math.floor(stars.length))
        const [position, velocity] = calculateOrbitalParameters(stars, orbitRadius)
        
        // Random mass between 0.5 and 5 solar masses
        const mass = 50000 + Math.random() * 450000
        const { color, emissiveColor } = getStarColorAndSize(mass)

        const newStar: SunData = {
          mass,
          color,
          emissiveColor,
          position: [position.x, position.y, position.z],
          velocity: [velocity.x, velocity.y, velocity.z]
        }

        setStars(prev => [...prev, newStar])
      }),
      'Star List': folder(
        Object.fromEntries(
          stars.map((star, index) => [
            `Star ${index + 1}`,
            folder({
              mass: {
                value: star.mass,
                min: 10000, // 0.1 solar masses
                max: 500000, // 5 solar masses
                step: 10000,
                onChange: (value: number) => {
                  setStars(prev => prev.map((s, i) => {
                    if (i === index) {
                      const { color, emissiveColor } = getStarColorAndSize(value)
                      return { ...s, mass: value, color, emissiveColor }
                    }
                    return s
                  }))
                }
              },
              color: { value: star.color, disabled: true },
              emissiveColor: { value: star.emissiveColor, disabled: true },
              remove: button(() => {
                setStars(prev => {
                  const newStars = prev.filter((_, i) => i !== index)
                  if (newStars.length > 0) {
                    return newStars.map((star, i) => {
                      if (i === 0) return star
                      const [position, velocity] = calculateOrbitalParameters(newStars.slice(0, i), 50 * (i + 1))
                      return {
                        ...star,
                        position: [position.x, position.y, position.z],
                        velocity: [velocity.x, velocity.y, velocity.z]
                      }
                    })
                  }
                  return newStars
                })
              })
            })
          ])
        )
      )
    })
  })

  return {
    ...simSettings,
    ...particleSettings,
    suns: stars
  }
} 