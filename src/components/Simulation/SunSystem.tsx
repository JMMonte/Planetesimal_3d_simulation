import { type FC, useRef, useEffect } from 'react'
import type { SimulationControls } from './types'
import { RigidBody } from '@react-three/rapier'
import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SunSystemProps {
  controls: SimulationControls
  onSunCreated: (index: number, body: RapierRigidBody) => void
  onSunRemoved: (index: number) => void
}

const SunSystem: FC<SunSystemProps> = ({ controls, onSunCreated, onSunRemoved }) => {
  const { worldSize, suns } = controls
  const directionalLightRefs = useRef<THREE.DirectionalLight[]>([])
  const pointLightRefs = useRef<THREE.PointLight[]>([])
  const sunRefs = useRef<RapierRigidBody[]>([])
  const sunMeshRefs = useRef<THREE.Mesh[]>([])

  // Cleanup when number of suns changes
  useEffect(() => {
    // Remove references for removed suns
    if (sunRefs.current.length > suns.length) {
      for (let i = suns.length; i < sunRefs.current.length; i++) {
        if (sunRefs.current[i]) {
          onSunRemoved(i)
        }
      }
      sunRefs.current = sunRefs.current.slice(0, suns.length)
      sunMeshRefs.current = sunMeshRefs.current.slice(0, suns.length)
      directionalLightRefs.current = directionalLightRefs.current.slice(0, suns.length)
      pointLightRefs.current = pointLightRefs.current.slice(0, suns.length)
    }
  }, [suns.length, onSunRemoved])

  // Update light positions to follow suns
  useFrame(() => {
    sunRefs.current.forEach((sun, index) => {
      if (!sun) return
      const pos = sun.translation()
      const mesh = sunMeshRefs.current[index]
      
      // Update mesh position
      if (mesh) {
        mesh.position.set(pos.x, pos.y, pos.z)
      }
      
      // Update directional light
      const dirLight = directionalLightRefs.current[index]
      if (dirLight) {
        dirLight.position.copy(mesh.position)
      }

      // Update point light
      const pointLight = pointLightRefs.current[index]
      if (pointLight) {
        pointLight.position.copy(mesh.position)
      }
    })
  })

  if (suns.length === 0) {
    return null
  }

  return (
    <>
      {suns.map((sun, index) => (
        <group key={index}>
          {/* Sun body */}
          <RigidBody 
            position={sun.position}
            type="dynamic"
            colliders="ball"
            friction={0.7}
            restitution={0.3}
            mass={sun.mass}
            gravityScale={0}
            lockRotations
            linearVelocity={sun.velocity}
            ref={(body) => {
              if (body) {
                sunRefs.current[index] = body
                onSunCreated(index, body)
              }
            }}
          >
            <mesh ref={(mesh) => mesh && (sunMeshRefs.current[index] = mesh)}>
              <sphereGeometry args={[15, 64, 64]} />
              <meshStandardMaterial 
                color={sun.color}
                toneMapped={false}
                emissive={sun.emissiveColor}
                emissiveIntensity={4}
                metalness={0.0}
                roughness={0.2}
              />
            </mesh>
          </RigidBody>
          
          {/* Sun light */}
          <directionalLight
            ref={(light) => light && (directionalLightRefs.current[index] = light)}
            position={sun.position}
            intensity={20}
            color={sun.color}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0001}
          >
            <orthographicCamera 
              attach="shadow-camera"
              args={[-worldSize, worldSize, worldSize, -worldSize, 0.1, worldSize * 2]}
            />
          </directionalLight>
          
          {/* Inner glow light */}
          <pointLight
            ref={(light) => light && (pointLightRefs.current[index] = light)}
            position={sun.position}
            intensity={500000}
            distance={100000}
            decay={1.5}
            color={sun.emissiveColor}
          />
        </group>
      ))}
    </>
  )
}

export default SunSystem 