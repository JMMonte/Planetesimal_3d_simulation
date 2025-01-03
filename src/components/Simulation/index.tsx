import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Physics } from '@react-three/rapier'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat'

import { useControls } from './Controls'
import ParticleSystem from './ParticleSystem'
import SunSystem from './SunSystem'
import { TrailManager, TrailRenderer } from './TrailSystem'
import FPSCounter from './FPSCounter'
import type { SimulationRefs, SunData } from './types'
import { StarControls } from './StarControls'
import { calculateOrbitalParameters, getStarColorAndSize } from './starUtils'

const Simulation = () => {
  // Simulation refs
  const refs = useRef<SimulationRefs>({
    rigidBodies: [],
    accelerations: [],
    maxAcceleration: 0,
    sunBodies: []
  })

  const trailManagerRef = useRef<TrailManager>()
  const controls = useControls()
  const lastUpdateTime = useRef(performance.now())
  const [stars, setStars] = useState<SunData[]>([
    // Initial star (Sun-like)
    {
      mass: 100000,
      color: '#ffff80',
      emissiveColor: '#ffdd44',
      position: [0, 0, 0],
      velocity: [0, 0, 0]
    }
  ])

  // Initialize trail manager immediately
  useEffect(() => {
    // Always create trail manager, just don't render trails if disabled
    trailManagerRef.current = new TrailManager(controls.particleCount, controls.trailLength)
    
    return () => {
      if (trailManagerRef.current) {
        trailManagerRef.current.clearTrails()
        trailManagerRef.current = undefined
      }
    }
  }, [controls.particleCount, controls.trailLength])

  // Handle trail toggle
  useEffect(() => {
    // Only clear trails when explicitly turning them off
    if (controls.showTrails === false && trailManagerRef.current) {
      trailManagerRef.current.clearTrails()
    } else if (controls.showTrails === true && trailManagerRef.current) {
      // When turning trails on, initialize with current positions but don't clear existing trails
      refs.current.rigidBodies.forEach((body, index) => {
        if (body) {
          const pos = body.translation()
          // Only initialize if trail is empty
          if (trailManagerRef.current?.getTrailLength(index) === 0) {
          trailManagerRef.current?.resetTrail(index, [pos.x, pos.y, pos.z])
          }
        }
      })
    }
  }, [controls.showTrails])

  // Memoize color calculation
  const getColorByAcceleration = useCallback((id: number) => {
    // If no acceleration data yet, return a default color
    if (!refs.current.accelerations.length || !refs.current.maxAcceleration) {
      return new THREE.Color(0x444444)
    }

    const acceleration = refs.current.accelerations[id] || 0
    const maxAcc = Math.max(refs.current.maxAcceleration, 0.001)
    
    // Ensure values are in valid range
    const minRatio = 0.05
    const rawRatio = Math.max(0, Math.min(acceleration / maxAcc, 1))
    const t = minRatio + (1 - minRatio) * Math.pow(rawRatio, 0.5)

    // Ensure HSL values are in valid range
    return new THREE.Color().setHSL(
      Math.max(0, Math.min((1 - t) * 0.7, 1)), // hue: 0 to 1
      0.9,  // saturation: fixed at 0.9
      Math.max(0, Math.min(0.3 + t * 0.4, 1))  // lightness: 0 to 1
    )
  }, [])

  // Handle sun creation
  const handleSunCreated = useCallback((index: number, body: RapierRigidBody) => {
    refs.current.sunBodies[index] = body
  }, [])

  // Handle sun removal
  const handleSunRemoved = useCallback((index: number) => {
    if (refs.current.sunBodies[index]) {
      refs.current.sunBodies = refs.current.sunBodies.filter((_, i) => i !== index)
    }
  }, [])

  // Star management handlers
  const handleAddStar = () => {
    if (stars.length >= 10) return

    const baseRadius = 50
    const orbitRadius = baseRadius * (1 + Math.floor(stars.length))
    const [position, velocity] = calculateOrbitalParameters(stars, orbitRadius)
    
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
  }

  const handleRemoveStar = (index: number) => {
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
  }

  const handleUpdateStar = (index: number, mass: number) => {
    setStars(prev => prev.map((s, i) => {
      if (i === index) {
        const { color, emissiveColor } = getStarColorAndSize(mass)
        return { ...s, mass, color, emissiveColor }
      }
      return s
    }))
  }

  const handleReset = () => {
    setStars([{
      mass: 100000,
      color: '#ffff80',
      emissiveColor: '#ffdd44',
      position: [0, 0, 0],
      velocity: [0, 0, 0]
    }])
  }

  // Apply gravitational forces and update trails with delta time
  useFrame(() => {
    const currentTime = performance.now()
    const deltaTime = Math.min((currentTime - lastUpdateTime.current) / 1000, 0.1)
    lastUpdateTime.current = currentTime

    const bodies = refs.current.rigidBodies
    const sunBodies = refs.current.sunBodies
    if (!bodies.length) return

    // Apply time scale to delta time instead of gravity
    const timeScale = Math.min(controls.timeScale, 10.0)
    const scaledDeltaTime = deltaTime * timeScale
    const scaledGravity = controls.gravityStrength

    // Update physics substeps for higher timescales
    const physicsSteps = Math.ceil(timeScale)
    const subStepDelta = scaledDeltaTime / physicsSteps

    // Run multiple physics steps for higher timescales
    for (let step = 0; step < physicsSteps; step++) {
      // Get sun positions and initialize forces
      const sunPositions = sunBodies.map(body => body.translation())
      const sunTotalForces = sunBodies.map(() => new THREE.Vector3(0, 0, 0))

      // Calculate gravitational forces between suns
      for (let i = 0; i < sunBodies.length; i++) {
        for (let j = i + 1; j < sunBodies.length; j++) {
          const posA = sunPositions[i]
          const posB = sunPositions[j]

          const dx = posB.x - posA.x
          const dy = posB.y - posA.y
          const dz = posB.z - posA.z
          const distSq = dx * dx + dy * dy + dz * dz
          const dist = Math.sqrt(distSq)

          if (dist > 30) {
            const force = Math.min(
              scaledGravity * controls.suns[i].mass * controls.suns[j].mass / distSq,
              1e6
            )
            const dirX = dx / dist
            const dirY = dy / dist
            const dirZ = dz / dist

            const forceVector = new THREE.Vector3(
              force * dirX,
              force * dirY,
              force * dirZ
            )
            sunTotalForces[i].add(forceVector)
            sunTotalForces[j].sub(forceVector)
          }
        }
      }

      // Update physics for particles
    for (let i = 0; i < bodies.length; i++) {
      const bodyA = bodies[i]
      if (!bodyA) continue

        try {
      const posA = bodyA.translation()
      let totalForce = new THREE.Vector3(0, 0, 0)
      let maxForce = 0

          // If there are suns, calculate forces between particle and all suns
          if (sunBodies.length > 0) {
            for (let j = 0; j < sunBodies.length; j++) {
              const sunPos = sunPositions[j]
              const dx = sunPos.x - posA.x
              const dy = sunPos.y - posA.y
              const dz = sunPos.z - posA.z
      const distSq = dx * dx + dy * dy + dz * dz
      const dist = Math.sqrt(distSq)

              const minDist = Math.max(10, bodyA.mass() * 0.01)
      if (dist > minDist) {
                const force = Math.min(
                  scaledGravity * bodyA.mass() * controls.suns[j].mass / distSq,
                  1e6
                )
                
        const dirX = dx / dist
        const dirY = dy / dist
        const dirZ = dz / dist
        
                if (!isNaN(force) && !isNaN(dirX) && !isNaN(dirY) && !isNaN(dirZ)) {
                  const forceVector = new THREE.Vector3(
          force * dirX,
          force * dirY,
          force * dirZ
                  )

                  totalForce.add(forceVector)
        maxForce = Math.max(maxForce, force)
                  sunTotalForces[j].sub(forceVector)
                }
              }
            }
          } else {
            // When no suns, calculate forces between particles
            for (let j = i + 1; j < bodies.length; j++) {
              const bodyB = bodies[j]
              if (!bodyB) continue

              const posB = bodyB.translation()
              const dx = posB.x - posA.x
              const dy = posB.y - posA.y
              const dz = posB.z - posA.z
              const distSq = dx * dx + dy * dy + dz * dz
              const dist = Math.sqrt(distSq)

              const minDist = Math.max(10, (bodyA.mass() + bodyB.mass()) * 0.01)
              if (dist > minDist) {
                const force = Math.min(
                  scaledGravity * bodyA.mass() * bodyB.mass() / distSq,
                  1e6
                )
                
                const dirX = dx / dist
                const dirY = dy / dist
                const dirZ = dz / dist
                
                if (!isNaN(force) && !isNaN(dirX) && !isNaN(dirY) && !isNaN(dirZ)) {
                  const forceVector = new THREE.Vector3(
                    force * dirX,
                    force * dirY,
                    force * dirZ
                  )
                  
                  totalForce.add(forceVector)
                  maxForce = Math.max(maxForce, force)
                  
                  // Apply equal and opposite force to the other particle
                  const oppositeForce = forceVector.clone().negate()
                  bodyB.addForce(
                    { x: oppositeForce.x * subStepDelta, y: oppositeForce.y * subStepDelta, z: oppositeForce.z * subStepDelta },
                    true
                  )
                }
              }
            }
          }

          // Apply forces to particle
          const forceMagnitude = totalForce.length()
          if (!isNaN(forceMagnitude) && forceMagnitude < 1e6) {
            const scaledForce = totalForce.multiplyScalar(subStepDelta)
            bodyA.addForce({ x: scaledForce.x, y: scaledForce.y, z: scaledForce.z }, true)

            const acceleration = Math.min(maxForce / bodyA.mass(), 1e4)
      refs.current.accelerations[i] = acceleration
      refs.current.maxAcceleration = Math.max(
        refs.current.maxAcceleration,
        acceleration
      )
          }
        } catch (error) {
          console.warn('Error in physics calculation for particle', i, error)
          continue
        }
      }

      // Apply forces to suns
      sunBodies.forEach((sunBody, index) => {
        const force = sunTotalForces[index]
        const forceMagnitude = force.length()
        if (!isNaN(forceMagnitude) && forceMagnitude < 1e6) {
          const scaledForce = force.multiplyScalar(subStepDelta)
          sunBody.addForce(
            { x: scaledForce.x, y: scaledForce.y, z: scaledForce.z },
            true
          )
        }
      })
    }

    // Update trails
    const trailManager = trailManagerRef.current
    if (trailManager) {
      bodies.forEach((body, i) => {
        if (body) {
          const pos = body.translation()
          const vel = body.linvel()
          if (Math.abs(vel.x) > 0.001 || Math.abs(vel.y) > 0.001 || Math.abs(vel.z) > 0.001) {
            trailManager.updateTrail(i, [pos.x, pos.y, pos.z])
          }
        }
      })
    }
  })

  // Memoize camera settings
  const cameraSettings = useMemo(() => ({
    position: [0, 400, 400] as [number, number, number],
    fov: 60,
    far: 1e10,
    near: 0.1
  }), [])

  return (
    <>
      <color attach="background" args={['#000000']} />
      
      <PerspectiveCamera 
        makeDefault 
        position={cameraSettings.position}
        fov={cameraSettings.fov}
        far={cameraSettings.far}
        near={cameraSettings.near}
      />
      
      <OrbitControls 
        makeDefault 
        minDistance={1}
        maxDistance={Infinity}
        enableDamping
        dampingFactor={0.05}
        screenSpacePanning
        zoomSpeed={Math.log10(controls.worldSize / 100)}
      />

      <Physics 
        gravity={[0, 0, 0]}
        timeStep={1/120}
        interpolate={true}
        colliders={false}
      >
        <group>
          <SunSystem 
            controls={{ ...controls, suns: stars }}
            onSunCreated={handleSunCreated}
            onSunRemoved={handleSunRemoved}
          />
          
          <ParticleSystem 
            controls={{ ...controls, suns: stars }}
            getColorByAcceleration={getColorByAcceleration}
          />
        </group>
      </Physics>

      {controls.showTrails && trailManagerRef.current && (
        <TrailRenderer 
          trailManager={trailManagerRef.current}
          getColor={getColorByAcceleration}
        />
      )}

      <EffectComposer>
        <Bloom 
          intensity={1.5}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>

      <StarControls
        stars={stars}
        onAddStar={handleAddStar}
        onRemoveStar={handleRemoveStar}
        onUpdateStar={handleUpdateStar}
        onReset={handleReset}
      />

      <FPSCounter />
    </>
  )
}

export default React.memo(Simulation) 