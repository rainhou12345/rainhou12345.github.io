import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

type Motion = 'stand' | 'walk' | 'sprint' | 'jump' | 'rest'
type Leg = { side: THREE.Group; hip: THREE.Group; knee: THREE.Group; phase: number }
type LoadState = 'loading' | 'ready' | 'error'
const actions: Motion[] = ['walk', 'sprint', 'jump', 'rest', 'stand']
const modelRoot = '/models/robot-dog'

export function RobotDog() {
  const mount = useRef<HTMLDivElement>(null)
  const current = useRef<Motion>('stand')
  const started = useRef(0)
  const [motion, setMotion] = useState<Motion>('stand')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const select = (next: Motion) => { current.current = next; started.current = performance.now(); setMotion(next) }

  useEffect(() => {
    const host = mount.current
    if (!host) return
    let disposed = false
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf1f2ef)
    const camera = new THREE.PerspectiveCamera(33, 1, .1, 1400)
    camera.position.set(520, 310, 610)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
    host.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = .06; controls.enablePan = false; controls.minDistance = 340; controls.maxDistance = 1000
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.6))
    const key = new THREE.DirectionalLight(0xffffff, 4); key.position.set(220, 300, 240); key.castShadow = true; scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 1.5); rim.position.set(-210, 90, -180); scene.add(rim)
    const shell = new THREE.MeshStandardMaterial({ color: 0xd9d9d6, roughness: .48, metalness: .05 })
    const hipMaterial = new THREE.MeshStandardMaterial({ color: 0x335f8a, roughness: .52, metalness: .1 })
    const upperMaterial = new THREE.MeshStandardMaterial({ color: 0xd87835, roughness: .55, metalness: .08 })
    const lowerMaterial = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: .55, metalness: .12 })
    const detailMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .4, metalness: .15 })
    const robot = new THREE.Group(); scene.add(robot)
    const assembly = new THREE.Group(); assembly.rotation.x = -Math.PI / 2; robot.add(assembly)
    const legs: Leg[] = []
    let head: THREE.Group | undefined, tail: THREE.Group | undefined, standingY = 0
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), new THREE.ShadowMaterial({ color: 0x000000, opacity: .1 }))
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.6; floor.receiveShadow = true; scene.add(floor)

    const loader = new STLLoader()
    const files = ['main_lower_chassis', 'top_cover', 'head', 'hc_sr04_sensor_holder', 'tail', 'hip_bracket_left', 'hip_bracket_right', 'upper_leg_left', 'upper_leg_right', 'lower_leg_left', 'lower_leg_right'] as const
    const loadModels = async () => {
      try {
        const loaded = await Promise.all(files.map(async name => [name, await loader.loadAsync(`${modelRoot}/${name}.stl`)] as const))
        if (disposed) return
        const geometry = Object.fromEntries(loaded) as Record<(typeof files)[number], THREE.BufferGeometry>
        Object.values(geometry).forEach(value => value.computeVertexNormals())
        const part = (name: (typeof files)[number], material: THREE.Material) => { const mesh = new THREE.Mesh(geometry[name], material); mesh.castShadow = true; mesh.receiveShadow = true; return mesh }
        assembly.add(part('main_lower_chassis', shell))
        const cover = part('top_cover', shell); cover.position.z = 56; assembly.add(cover)
        head = new THREE.Group(); head.position.set(134, 0, 10); assembly.add(head)
        head.add(part('head', shell))
        const sensor = part('hc_sr04_sensor_holder', detailMaterial); sensor.position.set(13, 0, 17); head.add(sensor)
        tail = new THREE.Group(); tail.position.set(-89.1, 0, 31.4); tail.rotation.z = Math.PI; assembly.add(tail)
        tail.add(part('tail', shell))
        const makeLeg = (sx: 1 | -1, sy: 1 | -1, phase: number): Leg => {
          const side = sy > 0 ? 'left' : 'right'
          const leg = new THREE.Group(); leg.position.set(sx * 118.5, sy * 55.8, 24); leg.scale.x = sx; assembly.add(leg)
          leg.add(part(side === 'left' ? 'hip_bracket_left' : 'hip_bracket_right', hipMaterial))
          const hip = new THREE.Group(); leg.add(hip)
          const upper = part(side === 'left' ? 'upper_leg_left' : 'upper_leg_right', upperMaterial)
          upper.position.set(0, sy * 55.9, -30)
          const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
          const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
          upper.quaternion.copy(qY).multiply(qX); hip.add(upper)
          const knee = new THREE.Group(); knee.position.set(0, sy * 35.8, -60); hip.add(knee)
          const lower = part(side === 'left' ? 'lower_leg_left' : 'lower_leg_right', lowerMaterial); lower.rotation.z = -Math.PI / 2; knee.add(lower)
          return { side: leg, hip, knee, phase }
        }
        legs.push(makeLeg(1, 1, 0), makeLeg(1, -1, .5), makeLeg(-1, 1, .5), makeLeg(-1, -1, 0))
        assembly.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(robot), center = box.getCenter(new THREE.Vector3())
        robot.position.x -= center.x; robot.position.z -= center.z; robot.updateMatrixWorld(true)
        const grounded = new THREE.Box3().setFromObject(robot), size = grounded.getSize(new THREE.Vector3())
        standingY = -grounded.min.y + 1; robot.position.y = standingY
        const largest = Math.max(size.x, size.y, size.z)
        camera.position.set(largest * 1.55, largest * .9, largest * 1.8); controls.target.set(0, size.y * .3, 0); controls.update()
        setLoadState('ready')
      } catch (error) { console.error('Unable to load robot STL parts', error); if (!disposed) setLoadState('error') }
    }
    void loadModels()

    const resize = () => { const { clientWidth: w, clientHeight: h } = host; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix() }
    const observer = new ResizeObserver(resize); observer.observe(host); resize()
    const lerp = (a: number, b: number, n = .14) => a + (b - a) * n
    const pose = (leg: Leg, hipAngle: number, kneeAngle: number, side = 0, speed = .16) => { leg.hip.rotation.y = lerp(leg.hip.rotation.y, hipAngle, speed); leg.knee.rotation.y = lerp(leg.knee.rotation.y, kneeAngle, speed); leg.side.rotation.x = lerp(leg.side.rotation.x, side, speed) }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate)
      const t = (now - started.current) / 1000, mode = current.current
      if (legs.length) {
        if (mode === 'walk' || mode === 'sprint') {
          const fast = mode === 'sprint', rate = fast ? 2.3 : 1.45, amp = fast ? .7 : .34
          legs.forEach(leg => { const a = Math.sin((t * rate + leg.phase) * Math.PI * 2); pose(leg, a * amp, -Math.max(0, -a) * (fast ? .9 : .65), a * .025, fast ? .34 : .2) })
          robot.position.y = lerp(robot.position.y, standingY + Math.abs(Math.sin(t * rate * Math.PI * 2)) * (fast ? 13 : 3), .25); robot.rotation.z = lerp(robot.rotation.z, Math.sin(t * rate * Math.PI * 2) * (fast ? .1 : .018), .2)
          if (tail) tail.rotation.z = Math.PI + Math.sin(t * rate * Math.PI * 2) * (fast ? .32 : .2)
        } else if (mode === 'rest') {
          legs.forEach((leg, index) => pose(leg, 0, -.12, index % 2 ? 1.25 : -1.25, .1)); robot.position.y = lerp(robot.position.y, standingY - 62, .08)
          if (head) head.rotation.y = lerp(head.rotation.y, -.1, .1); if (tail) tail.rotation.z = Math.PI + Math.sin(t * 7) * .35
        } else if (mode === 'jump') {
          const progress = Math.min(t / 1.65, 1), y = progress < .25 ? -22 * Math.sin(progress / .25 * Math.PI / 2) : progress < .72 ? Math.sin((progress - .25) / .47 * Math.PI) * 82 : 0
          robot.position.y = lerp(robot.position.y, standingY + y, .3); const tuck = Math.sin(progress * Math.PI); legs.forEach(leg => pose(leg, .35 * tuck, -1.05 * tuck, 0, .25)); if (progress === 1) select('stand')
        } else {
          legs.forEach(leg => pose(leg, 0, 0, 0, .1)); robot.position.y = lerp(robot.position.y, standingY, .1); robot.rotation.z = lerp(robot.rotation.z, 0, .1)
          if (head) head.rotation.y = lerp(head.rotation.y, 0, .1); if (tail) tail.rotation.z = lerp(tail.rotation.z, Math.PI, .1)
        }
      }
      if (reduced && mode !== 'stand') current.current = 'stand'
      controls.update(); renderer.render(scene, camera)
    }
    started.current = performance.now(); animate(started.current)
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); renderer.dispose(); scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); if (Array.isArray(object.material)) object.material.forEach(value => value.dispose()); else object.material.dispose() } }); host.removeChild(renderer.domElement) }
  }, [])

  return <div className="robot-stage" aria-label="Interactive 3D quadruped assembled from the project’s real STL parts"><div ref={mount} className="robot-canvas"/><div className="robot-label"><span>QUADRUPED / STL ASSEMBLY</span><b>Real parts in motion</b></div><p className="robot-hint">Drag to rotate · scroll to zoom</p>{loadState !== 'ready' && <div className={`robot-loader ${loadState}`} role="status"><span>{loadState === 'loading' ? 'Loading 11 fabricated parts' : '3D parts unavailable'}</span><i/></div>}<div className="robot-controls" aria-label="Robot motion controls">{actions.map(id => <button key={id} type="button" disabled={loadState !== 'ready'} className={motion === id && id !== 'stand' ? 'active' : ''} aria-pressed={motion === id && id !== 'stand'} onClick={() => select(id)}>{id === 'stand' ? 'Reset' : id}</button>)}</div></div>
}
