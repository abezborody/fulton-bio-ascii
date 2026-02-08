// ASCII Image Effect with brightness control
// Based on character density mapping with real-time brightness adjustment

let asciiContainer = null
let currentImageUrl = null
let isActive = false
let imageElement = null
let brightnessValue = 0
let animationId = null
let animationStartTime = null
const ANIMATION_DURATION = 10000 // 6 seconds
const BRIGHTNESS_MIN = -0.2
const BRIGHTNESS_MAX = 0.5

// Default character set (from dark to light)
const charSet = ' .:-=+*#%@'

// Cached character brightness values
const charBrightnessMap = {}

// Analyze character brightness
function analyzeChars() {
  const canvas = document.createElement('canvas')
  const width = 10 | 0
  const height = 10 | 0
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    console.error('Failed to get 2D context for character analysis')
    return
  }

  for (const char of charSet) {
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#000'
    ctx.font = '10px monospace'
    ctx.fillText(char, 1, 8)

    try {
      // Use explicit integer conversion to avoid "not of type long" error
      const data = ctx.getImageData(0 | 0, 0 | 0, width | 0, height | 0).data
      let total = 0
      for (let i = 3; i < data.length; i += 4) {
        total += data[i]
      }
      charBrightnessMap[char] = total / (width * height * 255)
    } catch (error) {
      console.error('Error analyzing character brightness:', error)
      charBrightnessMap[char] = 0.5 // Default fallback
    }
  }
}

// Initialize the ASCII effect
export function initAsciiEffect(containerId, imageUrl) {
  asciiContainer = document.getElementById(containerId)
  if (!asciiContainer) {
    asciiContainer = document.createElement('div')
    asciiContainer.id = containerId
    document.getElementById('app').appendChild(asciiContainer)
  }

  currentImageUrl = imageUrl

  // Apply styles - fullscreen
  asciiContainer.style.display = 'none'
  asciiContainer.style.justifyContent = 'center'
  asciiContainer.style.alignItems = 'center'
  asciiContainer.style.width = '100%'
  asciiContainer.style.height = '100%'
  asciiContainer.style.overflow = 'auto'
  asciiContainer.style.background = '#fff'
  asciiContainer.style.padding = '20px'

  // Analyze characters
  analyzeChars()
}

// Show ASCII effect and render the image
export function showAsciiEffect(brightness = 0) {
  if (!asciiContainer || !currentImageUrl) return

  isActive = true
  brightnessValue = brightness
  asciiContainer.style.display = 'flex'

  if (imageElement?.complete) {
    renderAscii()
  } else {
    loadImageAndRender()
  }
}

// Load image and render
function loadImageAndRender() {
  imageElement = new Image()
  imageElement.crossOrigin = 'anonymous'
  imageElement.src = currentImageUrl
  imageElement.onload = () => {
    if (isActive) renderAscii()
  }
}

// Render ASCII art with brightness control
function renderAscii() {
  if (!imageElement || !isActive) return

  // Validate image dimensions
  if (!imageElement.width || !imageElement.height || imageElement.width <= 0 || imageElement.height <= 0) {
    console.error('Invalid image dimensions:', imageElement.width, imageElement.height)
    return
  }

  const width = Math.floor(120)
  const height = Math.floor((imageElement.height / imageElement.width) * width / 1.9)

  // Ensure minimum dimensions and valid values
  const finalWidth = Math.max(1, width | 0)
  const finalHeight = Math.max(1, (height | 0))

  const canvas = document.createElement('canvas')
  canvas.width = finalWidth
  canvas.height = finalHeight
  const ctx = canvas.getContext('2d')

  // Check if canvas context is valid
  if (!ctx) {
    console.error('Failed to get 2D context')
    return
  }

  try {
    ctx.drawImage(imageElement, 0, 0, finalWidth, finalHeight)
    // Ensure all parameters are proper integers (unsigned long)
    const imageData = ctx.getImageData(0, 0, finalWidth >>> 0, finalHeight >>> 0)
    const data = imageData.data

    // Build ASCII output
    let asciiOutput = ''

    for (let y = 0; y < finalHeight; y++) {
      let line = ''
      for (let x = 0; x < finalWidth; x++) {
        const i = (y * finalWidth + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3] / 255

        // Calculate brightness
        let brightness = (r + g + b) / 765 * a + (1 - a)

        // Apply brightness adjustment (-1 to 1 range)
        brightness = brightness + brightnessValue
        brightness = Math.max(0, Math.min(1, brightness))

        // Map to character
        const charIndex = Math.floor((1 - brightness) * (charSet.length - 1))
        line += charSet[Math.max(0, Math.min(charSet.length - 1, charIndex))]
      }
      asciiOutput += `${line}
`
    }

    // Render to DOM
    asciiContainer.innerHTML = ''
    const pre = document.createElement('pre')
    pre.textContent = asciiOutput
    pre.style.fontFamily = "'Courier New', monospace"
    pre.style.fontSize = '8px'
    pre.style.lineHeight = '8px'
    pre.style.letterSpacing = '0'
    pre.style.whiteSpace = 'pre'
    pre.style.margin = '0'
    pre.style.padding = '0'
    pre.style.color = '#000'

    asciiContainer.appendChild(pre)
  } catch (error) {
    console.error('Error in renderAscii:', error)
  }
}

// Update brightness and re-render
export function updateBrightness(brightness) {
  brightnessValue = brightness
  if (isActive && imageElement) {
    renderAscii()
  }
}

// Hide ASCII effect
export function hideAsciiEffect() {
  isActive = false
  stopBrightnessAnimation()
  if (asciiContainer) {
    asciiContainer.style.display = 'none'
  }
}

// Start brightness animation loop (3 second cycle)
export function startBrightnessAnimation(onBrightnessChange) {
  stopBrightnessAnimation()
  animationStartTime = performance.now()

  function animate(currentTime) {
    if (!isActive) return

    const elapsed = currentTime - animationStartTime
    const progress = (elapsed % ANIMATION_DURATION) / ANIMATION_DURATION

    // Sine wave: goes from 0 to 0.7 over 6 seconds
    const sineValue = Math.sin(progress * Math.PI * 2)
    const brightness = BRIGHTNESS_MIN + (sineValue + 1) / 2 * (BRIGHTNESS_MAX - BRIGHTNESS_MIN)

    brightnessValue = brightness
    renderAscii()

    if (onBrightnessChange) {
      onBrightnessChange(brightness)
    }

    animationId = requestAnimationFrame(animate)
  }

  animationId = requestAnimationFrame(animate)
}

// Stop brightness animation
export function stopBrightnessAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  animationStartTime = null
}

// Check if ASCII effect is currently active
export function isAsciiActive() {
  return isActive
}
