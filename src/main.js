import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Pane } from 'tweakpane'

// Scene setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xffffff)

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.z = 5

// Offscreen renderer (not added to DOM)
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// 2D ASCII Canvas (visible)
const asciiCanvas = document.createElement('canvas')
const asciiCtx = asciiCanvas.getContext('2d')
asciiCanvas.style.position = 'absolute'
asciiCanvas.style.top = '0'
asciiCanvas.style.left = '0'
asciiCanvas.style.width = '100%'
asciiCanvas.style.height = '100%'
asciiCanvas.width = window.innerWidth
asciiCanvas.height = window.innerHeight
document.getElementById('app').appendChild(asciiCanvas)

// ASCII configuration
const asciiChars = ' .:-=+*#%@1234567890'

// Lighting with enhanced contrast for model details
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

// Main directional light - high angle to create surface detail shadows
const mainLight = new THREE.DirectionalLight(0xffffff, 1.5)
mainLight.position.set(5, 15, 8)
mainLight.castShadow = false // No floor shadows
scene.add(mainLight)

// Fill light from side for detail
const fillLight = new THREE.DirectionalLight(0xffffff, 0.8)
fillLight.position.set(-8, 5, 3)
scene.add(fillLight)

// Back light for rim/silhouette
const backLight = new THREE.DirectionalLight(0xffffff, 0.6)
backLight.position.set(0, 5, -10)
scene.add(backLight)
const loader = new GLTFLoader()
let model = null

// Model parameters for Tweakpane
const params = {
  scale: 4.9,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  autoRotate: true,
  rotationSpeed: 0.001,
  backgroundColor: '#ffffff',
  brightness: 0.5,
  contrast: 1.0,
  asciiEnabled: true,
  asciiResolution: 0.27,
  asciiFontSize: 22,
  asciiCharSet: ' .:-=+*#%@',
  fps: 0
}

// Create Tweakpane
const pane = new Pane()

// Add inputs directly to pane
pane.addBinding(params, 'scale', { min: 0.1, max: 5, step: 0.1, label: 'Scale' })
pane.addBinding(params, 'rotationX', { min: 0, max: Math.PI * 2, step: 0.01, label: 'Rotation X' })
pane.addBinding(params, 'rotationY', { min: 0, max: Math.PI * 2, step: 0.01, label: 'Rotation Y' })
pane.addBinding(params, 'rotationZ', { min: 0, max: Math.PI * 2, step: 0.01, label: 'Rotation Z' })
pane.addBinding(params, 'positionX', { min: -5, max: 5, step: 0.1, label: 'Position X' })
pane.addBinding(params, 'positionY', { min: -5, max: 5, step: 0.1, label: 'Position Y' })
pane.addBinding(params, 'positionZ', { min: -5, max: 5, step: 0.1, label: 'Position Z' })
pane.addBinding(params, 'autoRotate', { label: 'Auto Rotate' })
pane.addBinding(params, 'rotationSpeed', { min: 0, max: 0.05, step: 0.001, label: 'Rotation Speed' })
pane.addBinding(params, 'backgroundColor', { view: 'color', label: 'Background' })
pane.addBinding(params, 'brightness', { min: 0, max: 2, step: 0.1, label: 'Brightness' })
pane.addBinding(params, 'contrast', { min: 0.1, max: 3, step: 0.1, label: 'Contrast' })

// ASCII Effect controls
pane.addBinding(params, 'asciiEnabled', { label: 'ASCII Effect' })
pane.addBinding(params, 'asciiResolution', { min: 0.05, max: 0.5, step: 0.01, label: 'ASCII Resolution' })
pane.addBinding(params, 'asciiFontSize', { min: 8, max: 30, step: 1, label: 'ASCII Font Size' })
pane.addBinding(params, 'asciiCharSet', { label: 'ASCII Character Set' })

// FPS Monitor
pane.addBinding(params, 'fps', { label: 'FPS', readonly: true })

// Listen for changes
pane.on('change', (ev) => {
  if (!model) return
  
  const key = ev.target.key
  
  if (key === 'scale') {
    model.scale.setScalar(params.scale)
  } else if (key === 'rotationX') {
    model.rotation.x = params.rotationX
  } else if (key === 'rotationY') {
    model.rotation.y = params.rotationY
  } else if (key === 'rotationZ') {
    model.rotation.z = params.rotationZ
  } else if (key === 'positionX') {
    model.position.x = params.positionX
  } else if (key === 'positionY') {
    model.position.y = params.positionY
  } else if (key === 'positionZ') {
    model.position.z = params.positionZ
  } else if (key === 'backgroundColor') {
    scene.background = new THREE.Color(params.backgroundColor)
  } else if (key === 'brightness') {
    ambientLight.intensity = params.brightness
  } else if (key === 'contrast') {
    mainLight.intensity = 1.5 * params.contrast
    fillLight.intensity = 0.8 * params.contrast
    backLight.intensity = 0.6 * params.contrast
  }
})

// Load the model
loader.load(
  './cell.glb',
  (gltf) => {
    console.log('Model loaded successfully:', gltf)
    model = gltf.scene
    scene.add(model)
    
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    model.position.sub(center)
    
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const initialScale = 5 / maxDim
    model.scale.multiplyScalar(initialScale)
    
    // Update initial scale in params
    params.scale = initialScale
    
    // Enable mesh self-shadowing for detail
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  },
  (xhr) => {
    console.log(`${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`)
  },
  (error) => {
    console.error('An error happened loading the model:', error)
    loader.load(
      '/covid-19.glb',
      (gltf) => {
        console.log('Model loaded with alternative path:', gltf)
        model = gltf.scene
        scene.add(model)
        
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)
        
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const initialScale = 2 / maxDim
        model.scale.multiplyScalar(initialScale)
        
        // Enable mesh self-shadowing for detail (alternative path)
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
      },
      (xhr) => {
        console.log(`${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded (alternative path)`)
      },
      (error) => {
        console.error('Alternative path also failed:', error)
      }
    )
  }
)

// ASCII rendering function
function renderASCII() {
  if (!params.asciiEnabled) return
  
  const width = renderer.domElement.width
  const height = renderer.domElement.height
  
  // Get pixel data from 3D render
  const gl = renderer.getContext()
  const pixels = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  
  // Clear 2D canvas with white background
  asciiCtx.fillStyle = '#ffffff'
  asciiCtx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height)
  
  // Set font with black color
  const fontSize = params.asciiFontSize * params.asciiResolution
  asciiCtx.font = `${fontSize}px monospace`
  asciiCtx.fillStyle = 'black'
  asciiCtx.textBaseline = 'top'
  
  const charSet = params.asciiCharSet || asciiChars
  
  // Calculate step size based on resolution
  const stepX = Math.max(1, Math.floor(width / (asciiCanvas.width / fontSize)))
  const stepY = Math.max(1, Math.floor(height / (asciiCanvas.height / fontSize)))
  
  // Draw ASCII characters
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = ((height - 1 - y) * width + x) * 4
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      
      // Calculate brightness
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      
      // Only draw if pixel is dark enough (part of model, not white background)
      if (brightness < 0.9) {
        const charIndex = Math.floor((1 - brightness) * (charSet.length - 1))
        const char = charSet[charIndex] || ' '
        
        // Draw character
        const drawX = (x / width) * asciiCanvas.width
        const drawY = (y / height) * asciiCanvas.height
        asciiCtx.fillText(char, drawX, drawY)
      }
    }
  }
}

// FPS tracking
let lastTime = performance.now()
let frameCount = 0

// Animation loop
function animate() {
  requestAnimationFrame(animate)
  
  // Calculate FPS
  const currentTime = performance.now()
  frameCount++
  
  if (currentTime - lastTime >= 1000) {
    params.fps = frameCount
    frameCount = 0
    lastTime = currentTime
    pane.refresh()
  }
  
  // Auto-rotate if enabled
  if (params.autoRotate) {
    scene.rotation.y += params.rotationSpeed
  }
  
  // Render 3D scene offscreen
  renderer.render(scene, camera)
  
  // Convert to ASCII
  renderASCII()
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  
  // Update 2D canvas size
  asciiCanvas.width = window.innerWidth
  asciiCanvas.height = window.innerHeight
  
  // Update 3D renderer to full resolution
  renderer.setSize(window.innerWidth, window.innerHeight)
})

animate()
