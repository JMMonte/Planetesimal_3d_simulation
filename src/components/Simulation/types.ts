import type { RigidBody } from '@dimforge/rapier3d-compat'

export interface SunData {
  mass: number
  color: string
  emissiveColor: string
  position: [number, number, number]
  velocity: [number, number, number]
}

export interface SimulationRefs {
  rigidBodies: RigidBody[]
  accelerations: number[]
  maxAcceleration: number
  sunBodies: RigidBody[]
}

export type PhysicsUpdate = {
  id: number
  position: [number, number, number]
  velocity: [number, number, number]
  acceleration: number
}

export type WorkerMessage = {
  type: 'update'
  particles: {
    id: number
    position: [number, number, number]
    velocity: [number, number, number]
    mass: number
  }[]
  gravityStrength: number
  deltaTime: number
  timeScale: number
  sunMass: number
}

export interface SimulationControls {
  particleCount: number
  gravityStrength: number
  timeScale: number
  showTrails: boolean
  trailLength: number
  worldSize: number
  particleSize: number
  elasticity: number
  minLength: number
  maxLength: number
  minSides: number
  maxSides: number
  minRadius: number
  maxRadius: number
  suns: SunData[]
}

export interface ParticleData {
  position: [number, number, number]
  rotation: [number, number, number]
  velocity: [number, number, number]
  angularVelocity: [number, number, number]
  mass: number
  dimensions: {
    radius: number
    length: number
    sides: number
  }
} 