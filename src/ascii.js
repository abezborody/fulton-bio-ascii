// 2D Image ASCII Effect module using aalib.js
// No 3D rendering, pure 2D image to ASCII conversion

let asciiContainer = null
let currentImageUrl = null
let isActive = false

// Default configuration
const defaultConfig = {
  width: 300,
  height: 200,
  fontSize: '14px',
  lineHeight: '14px',
  color: '#000',
  background: '#fff',
  grayscale: true
}

// Initialize the ASCII effect
export function initAsciiEffect(containerId, imageUrl, config = {}) {
  const mergedConfig = { ...defaultConfig, ...config }
  
  // Create container if it doesn't exist
  asciiContainer = document.getElementById(containerId)
  if (!asciiContainer) {
    asciiContainer = document.createElement('div')
    asciiContainer.id = containerId
    document.getElementById('app').appendChild(asciiContainer)
  }
  
  // Store settings
  currentImageUrl = imageUrl
  
  // Apply styles - fullscreen
  asciiContainer.style.display = 'none'
  asciiContainer.style.justifyContent = 'center'
  asciiContainer.style.alignItems = 'center'
  asciiContainer.style.width = '100%'
  asciiContainer.style.height = '100%'
  asciiContainer.style.overflow = 'auto'
  asciiContainer.style.background = mergedConfig.background
  asciiContainer.style.padding = '0'
  
  return mergedConfig
}

// Show ASCII effect and render the image
export function showAsciiEffect(config = {}) {
  if (!asciiContainer || !currentImageUrl) return
  
  isActive = true
  asciiContainer.style.display = 'flex'
  asciiContainer.innerHTML = ''
  
  // Check if aalib is loaded
  if (typeof aalib === 'undefined') {
    console.error('aalib.js not loaded')
    return
  }
  
  aalib.read.image.fromURL(currentImageUrl)
    .map(aalib.aa({ 
      width: config.width || defaultConfig.width, 
      height: config.height || defaultConfig.height 
    }))
    .map(aalib.render.html())
    .subscribe(el => {
      if (!isActive) return
      
      // Style the rendered ASCII
      const pre = el.tagName === 'PRE' ? el : el.querySelector('pre') || el
      // Calculate gray color based on density (darker = more dense)
      const textContent = pre.textContent || ''
      const density = textContent.includes('@') || textContent.includes('#') || textContent.includes('%') ? 0.9 :
                      textContent.includes('+') || textContent.includes('*') || textContent.includes('=') ? 0.6 :
                      textContent.includes(':') || textContent.includes('-') ? 0.3 : 0.1
      
      // Map density to gray scale (black to gray)
      const grayValue = Math.floor(255 * (1 - density))
      const grayColor = `rgb(${grayValue}, ${grayValue}, ${grayValue})`
      
      pre.style.color = grayColor
      pre.style.fontSize = config.fontSize || defaultConfig.fontSize
      pre.style.lineHeight = config.lineHeight || defaultConfig.lineHeight
      pre.style.letterSpacing = '0'
      pre.style.whiteSpace = 'pre'
      pre.style.margin = '0'
      pre.style.padding = '0'
      pre.style.fontFamily = "'Courier New', monospace"
      
      asciiContainer.appendChild(el)
    })
}

// Hide ASCII effect
export function hideAsciiEffect() {
  isActive = false
  if (asciiContainer) {
    asciiContainer.style.display = 'none'
  }
}

// Toggle ASCII effect visibility
export function toggleAsciiEffect(show, config = {}) {
  if (show) {
    showAsciiEffect(config)
  } else {
    hideAsciiEffect()
  }
}

// Check if ASCII effect is currently active
export function isAsciiActive() {
  return isActive
}
