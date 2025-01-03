import * as THREE from 'three'
import type { SunData } from './types'

/**
 * Calculate the center of mass of a system of stars
 */
export function calculateSystemCenterOfMass(suns: SunData[]): THREE.Vector3 {
  if (suns.length === 0) return new THREE.Vector3(0, 0, 0)
  
  const totalMass = suns.reduce((sum, sun) => sum + sun.mass, 0)
  return suns.reduce((com, sun) => {
    return com.add(new THREE.Vector3(...sun.position).multiplyScalar(sun.mass / totalMass))
  }, new THREE.Vector3())
}

/**
 * Calculate total mass of a system of stars
 */
export function calculateSystemMass(suns: SunData[]): number {
  return suns.reduce((sum, sun) => sum + sun.mass, 0)
}

/**
 * Calculate circular orbit velocity at a given distance from a central mass
 * @param gravityStrength - The gravitational constant G
 * @param centralMass - The mass of the central body (or system)
 * @param distance - Distance from the central mass
 * @returns The velocity needed for a circular orbit
 */
export function calculateCircularOrbitVelocity(
  distance: number,
  centralMass: number,
  gravityStrength: number
): number {
  return Math.sqrt(gravityStrength * centralMass / distance)
}

/**
 * Calculate escape velocity at a given distance from a central mass
 */
export function calculateEscapeVelocity(
  distance: number,
  centralMass: number,
  gravityStrength: number
): number {
  return Math.sqrt(2 * gravityStrength * centralMass / distance)
}

/**
 * Calculate initial velocity for a stable orbit
 * @param position - Position vector relative to center of mass
 * @param gravityStrength - The gravitational constant G
 * @param centralMass - Mass of the central body or system
 * @param eccentricity - Desired orbital eccentricity (0 = circular, 0-1 = elliptical)
 * @returns Velocity vector for the orbit
 */
export function calculateOrbitalVelocity(
  position: THREE.Vector3,
  centralMass: number,
  gravityStrength: number,
  velocityScale: number = 0.1 // 10% of circular orbit velocity by default
): THREE.Vector3 {
  const distance = position.length()
  const circularVelocity = calculateCircularOrbitVelocity(distance, centralMass, gravityStrength)
  
  // Create a random orbit axis perpendicular to position vector
  const orbitAxis = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  ).normalize()

  // Calculate velocity vector perpendicular to both position and orbit axis
  return new THREE.Vector3()
    .crossVectors(orbitAxis, position)
    .normalize()
    .multiplyScalar(circularVelocity * velocityScale)
}

/**
 * Calculate initial velocity for a particle in a system with multiple stars
 */
export function calculateInitialParticleVelocity(
  position: THREE.Vector3,
  suns: SunData[],
  gravityStrength: number
): THREE.Vector3 {
  if (suns.length === 0) {
    // When no suns, give particles very small velocities for interaction with each other
    return calculateOrbitalVelocity(
      position,
      1, // Use unit mass
      gravityStrength,
      0.001 // Very small velocity scale
    )
  }
  
  const centerOfMass = calculateSystemCenterOfMass(suns)
  const totalMass = calculateSystemMass(suns)
  const relativePos = position.clone().sub(centerOfMass)
  
  // Calculate velocity relative to center of mass
  return calculateOrbitalVelocity(
    relativePos,
    totalMass,
    gravityStrength,
    0.01 // Small velocity scale for stability
  )
} 