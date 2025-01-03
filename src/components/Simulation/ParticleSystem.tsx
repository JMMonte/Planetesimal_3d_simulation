import React, { type FC, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { SimulationControls, ParticleData } from './types'
import { InstancedRigidBodies } from '@react-three/rapier'
import { calculateInitialParticleVelocity } from './physics'

interface ParticleSystemProps {
  controls: SimulationControls
  getColorByAcceleration: (id: number) => THREE.Color
}

function generateParticleData(_: number, controls: SimulationControls): ParticleData {
  const {
    minLength, maxLength,
    minSides, maxSides,
    minRadius, maxRadius,
    worldSize, suns,
    gravityStrength
  } = controls

  // Random dimensions
  const length = minLength + Math.random() * (maxLength - minLength)
  const sides = Math.floor(minSides + Math.random() * (maxSides - minSides + 1))
  const radius = minRadius + Math.random() * (maxRadius - minRadius)

  // Random position in spherical distribution
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  const minR = 30 // Minimum distance from sun
  const r = minR + Math.pow(Math.random(), 1/3) * (worldSize * 0.4 - minR) // Use 40% of world size for initial distribution
  const position = new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  )

  // Calculate initial velocity using physics utils
  const velocity = calculateInitialParticleVelocity(position, suns, gravityStrength)

  // Random rotation axis and initial rotation
  const rotationAxis = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  ).normalize()
  
  const euler = new THREE.Euler().setFromVector3(
    rotationAxis.multiplyScalar(Math.random() * Math.PI * 2)
  )

  // Angular velocity around rotation axis (very small)
  const baseAngularSpeed = 0.01 * (Math.random() * 0.5 + 0.5) / (radius * radius)
  const angularVel = rotationAxis.multiplyScalar(baseAngularSpeed)

  // Calculate mass based on dimensions (small mass for better interactions)
  const particleMass = radius * radius * length

  return {
    position: [position.x, position.y, position.z],
    rotation: [euler.x, euler.y, euler.z],
    velocity: [velocity.x, velocity.y, velocity.z],
    angularVelocity: [angularVel.x, angularVel.y, angularVel.z],
    mass: particleMass,
    dimensions: { radius, length, sides }
  }
}

const ParticleSystem: FC<ParticleSystemProps> = ({ controls, getColorByAcceleration }) => {
  const { particleCount, particleSize, elasticity } = controls
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)

  // Memoize particle data generation
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => generateParticleData(i, controls))
  }, [particleCount, controls.worldSize, controls.minLength, controls.maxLength, 
      controls.minSides, controls.maxSides, controls.minRadius, controls.maxRadius])

  // Create instances data
  const instances = useMemo(() => {
    return particles.map((data) => ({
      key: Math.random(),
      position: data.position as [number, number, number],
      rotation: data.rotation as [number, number, number],
      scale: [
        data.dimensions.radius * particleSize,
        data.dimensions.length * particleSize, // Height is Y axis for cylinder
        data.dimensions.radius * particleSize
      ] as [number, number, number],
      mass: data.mass,
      linearVelocity: data.velocity,
      angularVelocity: data.angularVelocity
    }))
  }, [particles, particleSize])

  // Update colors in instance mesh
  useFrame(() => {
    if (!instancedMeshRef.current) return
    const mesh = instancedMeshRef.current

    for (let i = 0; i < particleCount; i++) {
      const color = getColorByAcceleration(i)
      mesh.setColorAt(i, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  // Create base geometry and material
  const geometry = useMemo(() => {
    // Use the minimum number of sides from controls for the base geometry
    return new THREE.CylinderGeometry(1, 1, 1, controls.minSides)
  }, [controls.minSides])
  
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0.1,
    envMapIntensity: 0.2,
    flatShading: true,
    vertexColors: true
  }), [])

  return (
    <InstancedRigidBodies
      instances={instances}
      colliders="cuboid"
      restitution={elasticity}
      friction={0.7}
      gravityScale={0}
      linearDamping={0}
      angularDamping={0}
      lockRotations={false}
      ccd
      onCollisionEnter={() => {}}
      onCollisionExit={() => {}}
    >
      <instancedMesh
        ref={instancedMeshRef}
        args={[geometry, material, particleCount]}
        castShadow
        receiveShadow
      />
    </InstancedRigidBodies>
  )
}

export default React.memo(ParticleSystem) 