import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import './style.css'
import Simulation from './components/Simulation/index.tsx'

export default function App() {
  return (
    <Canvas>
      <Suspense fallback={null}>
        <Simulation />
      </Suspense>
    </Canvas>
  )
} 