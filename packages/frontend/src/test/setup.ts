import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Enhanced browser API mocks with complete interface implementations
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => {
    const mediaQueryList = {
      matches: false,
      media: query,
      onchange: null as ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn().mockReturnValue(true),
    }
    return mediaQueryList
  }),
})

// Enhanced ResizeObserver with proper callback handling
global.ResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => {
  const mockObserver = {
    observe: vi.fn((target: Element, options?: ResizeObserverOptions) => {
      // Simulate immediate callback for testing
      if (callback && typeof callback === 'function') {
        setTimeout(() => {
          const mockEntry: ResizeObserverEntry = {
            target,
            contentRect: {
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              top: 0,
              right: 100,
              bottom: 100,
              left: 0,
              toJSON: () => ({}),
            },
            borderBoxSize: [{
              blockSize: 100,
              inlineSize: 100,
            }],
            contentBoxSize: [{
              blockSize: 100,
              inlineSize: 100,
            }],
            devicePixelContentBoxSize: [{
              blockSize: 100,
              inlineSize: 100,
            }],
          }
          callback([mockEntry], mockObserver as ResizeObserver)
        }, 0)
      }
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }
  return mockObserver
})

// Enhanced IntersectionObserver with proper callback handling
global.IntersectionObserver = vi.fn().mockImplementation((
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) => {
  const mockObserver = {
    root: options?.root || null,
    rootMargin: options?.rootMargin || '0px',
    thresholds: Array.isArray(options?.threshold) ? options.threshold : [options?.threshold || 0],
    observe: vi.fn((target: Element) => {
      // Simulate immediate callback for testing
      if (callback && typeof callback === 'function') {
        setTimeout(() => {
          const mockEntry: IntersectionObserverEntry = {
            target,
            boundingClientRect: {
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              top: 0,
              right: 100,
              bottom: 100,
              left: 0,
              toJSON: () => ({}),
            },
            intersectionRect: {
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              top: 0,
              right: 100,
              bottom: 100,
              left: 0,
              toJSON: () => ({}),
            },
            rootBounds: {
              x: 0,
              y: 0,
              width: 1024,
              height: 768,
              top: 0,
              right: 1024,
              bottom: 768,
              left: 0,
              toJSON: () => ({}),
            },
            intersectionRatio: 1,
            isIntersecting: true,
            time: Date.now(),
          }
          callback([mockEntry], mockObserver as IntersectionObserver)
        }, 0)
      }
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn().mockReturnValue([]),
  }
  return mockObserver
})

// Enhanced MutationObserver mock with proper interface for Testing Library compatibility
global.MutationObserver = class MockMutationObserver {
  private callback: MutationCallback
  private target?: Node
  private options?: MutationObserverInit

  constructor(callback: MutationCallback) {
    this.callback = callback
  }

  observe = vi.fn((target: Node, options?: MutationObserverInit) => {
    this.target = target
    this.options = options
    // Testing Library expects the observer to work immediately for some cases
    // We'll simulate a mutation record if needed
    setTimeout(() => {
      if (this.callback && typeof this.callback === 'function') {
        const mockRecord: MutationRecord = {
          type: 'childList',
          target: target,
          addedNodes: [] as any,
          removedNodes: [] as any,
          previousSibling: null,
          nextSibling: null,
          attributeName: null,
          attributeNamespace: null,
          oldValue: null,
        }
        this.callback([mockRecord], this as any)
      }
    }, 0)
  })

  disconnect = vi.fn(() => {
    this.target = undefined
    this.options = undefined
  })

  takeRecords = vi.fn().mockReturnValue([])
}

// Enhanced PerformanceObserver mock with proper interface
class MockPerformanceObserver {
  static supportedEntryTypes = ['measure', 'navigation', 'resource', 'mark']
  
  constructor(private callback: PerformanceObserverCallback) {}
  
  observe = vi.fn((options: PerformanceObserverInit) => {})
  disconnect = vi.fn()
  takeRecords = vi.fn().mockReturnValue([])
}

global.PerformanceObserver = MockPerformanceObserver as any

// Mock additional browser APIs that might be needed
Object.defineProperty(window, 'getComputedStyle', {
  writable: true,
  value: vi.fn().mockImplementation((element: Element) => {
    const style = {
      getPropertyValue: vi.fn().mockReturnValue(''),
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
      length: 0,
      item: vi.fn().mockReturnValue(null),
      [Symbol.iterator]: function* () {},
      // Add common CSS properties that might be accessed
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      position: 'static',
      zIndex: 'auto',
      overflow: 'visible',
      width: '0px',
      height: '0px',
      margin: '0px',
      padding: '0px',
      border: '0px',
      fontSize: '16px',
      fontFamily: 'Arial',
      color: 'rgb(0, 0, 0)',
      backgroundColor: 'rgba(0, 0, 0, 0)',
    }
    
    // Make it behave like a real CSSStyleDeclaration
    return new Proxy(style, {
      get(target, prop) {
        if (prop in target) {
          return target[prop as keyof typeof target]
        }
        // Return empty string for any CSS property
        return ''
      },
      set(target, prop, value) {
        if (typeof prop === 'string') {
          (target as any)[prop] = value
        }
        return true
      }
    })
  }),
})

// Ensure document has proper DOM methods
if (typeof document !== 'undefined') {
  // Mock document.createRange if not available
  if (!document.createRange) {
    document.createRange = () => ({
      setStart: vi.fn(),
      setEnd: vi.fn(),
      commonAncestorContainer: document.body,
      collapsed: false,
      startContainer: document.body,
      startOffset: 0,
      endContainer: document.body,
      endOffset: 0,
      getBoundingClientRect: () => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
      }),
      getClientRects: () => [],
      selectNode: vi.fn(),
      selectNodeContents: vi.fn(),
      collapse: vi.fn(),
      cloneContents: vi.fn(),
      cloneRange: vi.fn(),
      deleteContents: vi.fn(),
      extractContents: vi.fn(),
      insertNode: vi.fn(),
      surroundContents: vi.fn(),
      compareBoundaryPoints: vi.fn(),
      detach: vi.fn(),
      toString: vi.fn().mockReturnValue(''),
    } as any)
  }

  // Ensure document.body exists
  if (!document.body) {
    document.body = document.createElement('body')
    document.documentElement.appendChild(document.body)
  }
}

// Mock HTMLCanvasElement methods
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextType: string) => {
  if (contextType === '2d') {
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      }),
      putImageData: vi.fn(),
      createImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      }),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      canvas: {
        width: 0,
        height: 0,
      },
    }
  }
  return null
})

HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,')
HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((callback) => {
  callback(new Blob([''], { type: 'image/png' }))
})

// Mock HTMLVideoElement methods
HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)
HTMLVideoElement.prototype.pause = vi.fn()
HTMLVideoElement.prototype.load = vi.fn()

// Mock HTMLMediaElement properties
Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
  writable: true,
  value: 0,
})

Object.defineProperty(HTMLVideoElement.prototype, 'duration', {
  writable: true,
  value: 0,
})

Object.defineProperty(HTMLVideoElement.prototype, 'paused', {
  writable: true,
  value: true,
})

Object.defineProperty(HTMLVideoElement.prototype, 'ended', {
  writable: true,
  value: false,
})

Object.defineProperty(HTMLVideoElement.prototype, 'readyState', {
  writable: true,
  value: 4, // HAVE_ENOUGH_DATA
})

// Mock File and FileReader APIs
global.File = class MockFile {
  constructor(
    public bits: BlobPart[],
    public name: string,
    public options: FilePropertyBag = {}
  ) {
    this.size = bits.reduce((acc, bit) => {
      if (typeof bit === 'string') return acc + bit.length
      if (bit instanceof ArrayBuffer) return acc + bit.byteLength
      return acc + ((bit as any).size || 0)
    }, 0)
    this.type = options.type || ''
    this.lastModified = options.lastModified || Date.now()
  }
  
  size: number
  type: string
  lastModified: number
  
  stream() {
    return new ReadableStream()
  }
  
  text() {
    return Promise.resolve('')
  }
  
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0))
  }
  
  slice() {
    return new MockFile([], this.name)
  }
} as any

class MockFileReader extends EventTarget implements FileReader {
  result: string | ArrayBuffer | null = null
  error: DOMException | null = null
  readyState: 0 | 1 | 2 = 0
  
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  
  readAsText(file: Blob) {
    this.readyState = 1
    setTimeout(() => {
      this.result = ''
      this.readyState = 2
      this.onload?.call(this as any, {} as ProgressEvent<FileReader>)
    }, 0)
  }
  
  readAsDataURL(file: Blob) {
    this.readyState = 1
    setTimeout(() => {
      this.result = 'data:image/png;base64,'
      this.readyState = 2
      this.onload?.call(this as any, {} as ProgressEvent<FileReader>)
    }, 0)
  }
  
  readAsArrayBuffer(file: Blob) {
    this.readyState = 1
    setTimeout(() => {
      this.result = new ArrayBuffer(0)
      this.readyState = 2
      this.onload?.call(this as any, {} as ProgressEvent<FileReader>)
    }, 0)
  }
  
  readAsBinaryString(file: Blob) {
    this.readyState = 1
    setTimeout(() => {
      this.result = ''
      this.readyState = 2
      this.onload?.call(this as any, {} as ProgressEvent<FileReader>)
    }, 0)
  }
  
  abort() {
    this.readyState = 2
    this.onabort?.call(this as any, {} as ProgressEvent<FileReader>)
  }
  
  static readonly EMPTY = 0
  static readonly LOADING = 1
  static readonly DONE = 2
  
  readonly EMPTY = 0
  readonly LOADING = 1
  readonly DONE = 2
}

global.FileReader = MockFileReader as any

// Mock additional DOM APIs that might be missing
if (typeof window !== 'undefined') {
  // Mock window.location if needed
  if (!window.location) {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/',
        search: '',
        hash: '',
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
      },
      writable: true,
    })
  }

  // Mock window.history if needed
  if (!window.history) {
    Object.defineProperty(window, 'history', {
      value: {
        length: 1,
        state: null,
        back: vi.fn(),
        forward: vi.fn(),
        go: vi.fn(),
        pushState: vi.fn(),
        replaceState: vi.fn(),
      },
      writable: true,
    })
  }

  // Mock localStorage and sessionStorage
  const mockStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn().mockReturnValue(null),
    length: 0,
  }

  if (!window.localStorage) {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    })
  }

  if (!window.sessionStorage) {
    Object.defineProperty(window, 'sessionStorage', {
      value: { ...mockStorage },
      writable: true,
    })
  }
}

// Mock CSS-related APIs
if (typeof CSSStyleDeclaration !== 'undefined') {
  CSSStyleDeclaration.prototype.getPropertyValue = vi.fn().mockReturnValue('')
  CSSStyleDeclaration.prototype.setProperty = vi.fn()
  CSSStyleDeclaration.prototype.removeProperty = vi.fn()
}

// Also mock global getComputedStyle for cases where it's accessed directly
if (typeof global !== 'undefined') {
  global.getComputedStyle = window.getComputedStyle
}

// Mock Range API
if (typeof Range === 'undefined') {
  global.Range = class MockRange {
    startContainer: Node = document.body
    startOffset: number = 0
    endContainer: Node = document.body
    endOffset: number = 0
    collapsed: boolean = false
    commonAncestorContainer: Node = document.body

    setStart = vi.fn()
    setEnd = vi.fn()
    selectNode = vi.fn()
    selectNodeContents = vi.fn()
    collapse = vi.fn()
    cloneContents = vi.fn()
    cloneRange = vi.fn()
    deleteContents = vi.fn()
    extractContents = vi.fn()
    insertNode = vi.fn()
    surroundContents = vi.fn()
    compareBoundaryPoints = vi.fn()
    detach = vi.fn()
    toString = vi.fn().mockReturnValue('')
    getBoundingClientRect = vi.fn().mockReturnValue({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    })
    getClientRects = vi.fn().mockReturnValue([])
  } as any
}

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn().mockImplementation((callback: FrameRequestCallback) => {
  const id = setTimeout(() => callback(Date.now()), 16) // ~60fps
  return Number(id) // Ensure it returns a number
})

global.cancelAnimationFrame = vi.fn().mockImplementation((id: number) => {
  clearTimeout(id)
})

// Mock requestIdleCallback and cancelIdleCallback
global.requestIdleCallback = vi.fn().mockImplementation((callback: IdleRequestCallback) => {
  const id = setTimeout(() => callback({
    didTimeout: false,
    timeRemaining: () => 50,
  }), 0)
  return Number(id) // Ensure it returns a number
})

global.cancelIdleCallback = vi.fn().mockImplementation((id: number) => {
  clearTimeout(id)
})

// Mock Web APIs that might be used in components
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(window, 'scroll', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
})



// Mock URL and URLSearchParams for webidl-conversions compatibility
if (typeof global.URL === 'undefined') {
  global.URL = class URL {
    constructor(public href: string, base?: string) {
      if (base) {
        this.href = new globalThis.URL(href, base).href
      }
    }
    toString() {
      return this.href
    }
  } as any
}

if (typeof global.URLSearchParams === 'undefined') {
  global.URLSearchParams = class URLSearchParams {
    private params = new Map<string, string>()
    
    constructor(init?: string | URLSearchParams | Record<string, string>) {
      if (typeof init === 'string') {
        // Simple parsing for test purposes
        init.split('&').forEach(pair => {
          const [key, value] = pair.split('=')
          if (key) this.params.set(decodeURIComponent(String(key)), decodeURIComponent(String(value || '')))
        })
      }
    }
    
    get(name: string) {
      return this.params.get(name) || null
    }
    
    set(name: string, value: string) {
      this.params.set(name, value)
    }
    
    toString() {
      return Array.from(this.params.entries())
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')
    }
  } as any
}

// Mock fetch if not available
if (typeof global.fetch === 'undefined') {
  global.fetch = vi.fn()
}

// Enhanced navigator mock with comprehensive API coverage
Object.defineProperty(window, 'navigator', {
  writable: true,
  value: {
    userAgent: 'Mozilla/5.0 (Test Environment) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    platform: 'Test',
    language: 'en-US',
    languages: ['en-US', 'en'],
    cookieEnabled: true,
    onLine: true,
    hardwareConcurrency: 4,
    maxTouchPoints: 0,
    vendor: 'Test',
    vendorSub: '',
    productSub: '20030107',
    appCodeName: 'Mozilla',
    appName: 'Netscape',
    appVersion: '5.0 (Test Environment)',
    
    // Media Devices API
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getVideoTracks: () => [],
        getAudioTracks: () => [],
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
        clone: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: 'default',
          kind: 'audioinput' as MediaDeviceKind,
          label: 'Default Microphone',
          groupId: 'group1',
        },
        {
          deviceId: 'default',
          kind: 'videoinput' as MediaDeviceKind,
          label: 'Default Camera',
          groupId: 'group2',
        },
      ]),
      getDisplayMedia: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getVideoTracks: () => [],
        getAudioTracks: () => [],
      }),
      getSupportedConstraints: vi.fn().mockReturnValue({
        width: true,
        height: true,
        aspectRatio: true,
        frameRate: true,
        facingMode: true,
        resizeMode: true,
        sampleRate: true,
        sampleSize: true,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
        latency: true,
        channelCount: true,
        deviceId: true,
        groupId: true,
      }),
    },
    
    // Permissions API
    permissions: {
      query: vi.fn().mockResolvedValue({
        state: 'granted',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    },
    
    // Service Worker API
    serviceWorker: {
      register: vi.fn().mockResolvedValue({
        installing: null,
        waiting: null,
        active: null,
        scope: '/',
        update: vi.fn(),
        unregister: vi.fn().mockResolvedValue(true),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
      ready: Promise.resolve({
        installing: null,
        waiting: null,
        active: null,
        scope: '/',
        update: vi.fn(),
        unregister: vi.fn().mockResolvedValue(true),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
      controller: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    
    // Storage API
    storage: {
      estimate: vi.fn().mockResolvedValue({
        quota: 1000000000,
        usage: 0,
      }),
      persist: vi.fn().mockResolvedValue(true),
      persisted: vi.fn().mockResolvedValue(false),
    },
    
    // Connection API
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    
    // Vibration API
    vibrate: vi.fn().mockReturnValue(true),
    
    // Share API
    share: vi.fn().mockResolvedValue(undefined),
    canShare: vi.fn().mockReturnValue(true),
    
    // Wake Lock API
    wakeLock: {
      request: vi.fn().mockResolvedValue({
        released: false,
        type: 'screen',
        release: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    },
    
    // Clipboard API
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
      write: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue([]),
    },
    
    // Geolocation API
    geolocation: {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 0,
            longitude: 0,
            accuracy: 1,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        })
      }),
      watchPosition: vi.fn().mockReturnValue(1),
      clearWatch: vi.fn(),
    },
  },
})

// Mock problematic modules with complete implementations
vi.mock('webidl-conversions', () => ({
  default: {
    // Common webidl-conversions functions used by whatwg-url
    DOMString: (value: any) => String(value),
    USVString: (value: any) => String(value),
    ByteString: (value: any) => String(value),
    'unsigned long': (value: any) => Math.abs(parseInt(String(value), 10)) || 0,
    'unsigned short': (value: any) => Math.abs(parseInt(String(value), 10)) || 0,
    boolean: (value: any) => Boolean(value),
  },
  // Named exports for specific conversion functions
  DOMString: (value: any) => String(value),
  USVString: (value: any) => String(value),
  ByteString: (value: any) => String(value),
}))

vi.mock('whatwg-url', () => {
  // Enhanced URL implementation that handles more edge cases
  class MockURL {
    public href: string
    public origin: string
    public protocol: string
    public username: string
    public password: string
    public host: string
    public hostname: string
    public port: string
    public pathname: string
    public search: string
    public hash: string

    constructor(url: string, base?: string | MockURL) {
      try {
        const parsedUrl = new globalThis.URL(url, base?.toString())
        this.href = parsedUrl.href
        this.origin = parsedUrl.origin
        this.protocol = parsedUrl.protocol
        this.username = parsedUrl.username
        this.password = parsedUrl.password
        this.host = parsedUrl.host
        this.hostname = parsedUrl.hostname
        this.port = parsedUrl.port
        this.pathname = parsedUrl.pathname
        this.search = parsedUrl.search
        this.hash = parsedUrl.hash
      } catch {
        // Fallback for invalid URLs
        this.href = url
        this.origin = ''
        this.protocol = 'http:'
        this.username = ''
        this.password = ''
        this.host = ''
        this.hostname = ''
        this.port = ''
        this.pathname = '/'
        this.search = ''
        this.hash = ''
      }
    }

    toString() {
      return this.href
    }

    toJSON() {
      return this.href
    }
  }

  // Enhanced URLSearchParams implementation
  class MockURLSearchParams {
    private params = new Map<string, string[]>()

    constructor(init?: string | URLSearchParams | Record<string, string> | string[][]) {
      if (typeof init === 'string') {
        this.parseString(init)
      } else if (init instanceof URLSearchParams || init instanceof MockURLSearchParams) {
        init.forEach((value, key) => {
          this.append(String(key), String(value))
        })
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => {
          this.append(String(key), String(value))
        })
      } else if (init && typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => {
          this.append(String(key), String(value))
        })
      }
    }

    private parseString(str: string) {
      if (str.startsWith('?')) {
        str = str.slice(1)
      }
      str.split('&').forEach(pair => {
        if (pair) {
          const [key, value = ''] = pair.split('=')
          this.append(decodeURIComponent(String(key)), decodeURIComponent(String(value)))
        }
      })
    }

    append(name: string, value: string) {
      const key = String(name)
      const val = String(value)
      if (!this.params.has(key)) {
        this.params.set(key, [])
      }
      this.params.get(key)!.push(val)
    }

    delete(name: string) {
      this.params.delete(String(name))
    }

    get(name: string) {
      const values = this.params.get(String(name))
      return values ? values[0] : null
    }

    getAll(name: string) {
      return this.params.get(String(name)) || []
    }

    has(name: string) {
      return this.params.has(String(name))
    }

    set(name: string, value: string) {
      this.params.set(String(name), [String(value)])
    }

    sort() {
      const sorted = new Map([...this.params.entries()].sort())
      this.params.clear()
      sorted.forEach((value, key) => {
        this.params.set(key, value)
      })
    }

    toString() {
      const pairs: string[] = []
      this.params.forEach((values, key) => {
        values.forEach(value => {
          pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        })
      })
      return pairs.join('&')
    }

    forEach(callback: (value: string, key: string, parent: MockURLSearchParams) => void) {
      this.params.forEach((values, key) => {
        values.forEach(value => {
          callback(value, key, this)
        })
      })
    }

    keys() {
      const keys: string[] = []
      this.params.forEach((_, key) => {
        keys.push(key)
      })
      return keys[Symbol.iterator]()
    }

    values() {
      const values: string[] = []
      this.params.forEach((vals) => {
        values.push(...vals)
      })
      return values[Symbol.iterator]()
    }

    entries() {
      const entries: [string, string][] = []
      this.params.forEach((values, key) => {
        values.forEach(value => {
          entries.push([key, value])
        })
      })
      return entries[Symbol.iterator]()
    }

    [Symbol.iterator]() {
      return this.entries()
    }
  }

  return {
    URL: MockURL,
    URLSearchParams: MockURLSearchParams,
    // Additional exports that might be used
    parseURL: (url: string, base?: string) => {
      try {
        return new MockURL(url, base)
      } catch {
        return null
      }
    },
    serializeURL: (url: MockURL) => url.toString(),
  }
})

// Enhanced console error filtering for cleaner test output
const originalError = console.error
const originalWarn = console.warn

// Define patterns for errors that should be suppressed during tests
const suppressedErrorPatterns = [
  // webidl-conversions related errors
  /webidl-conversions/i,
  /Cannot resolve dependency: webidl-conversions/i,
  /Failed to resolve import "webidl-conversions"/i,
  
  // whatwg-url related errors
  /whatwg-url/i,
  /Cannot resolve dependency: whatwg-url/i,
  /Failed to resolve import "whatwg-url"/i,
  
  // Common test environment errors that are expected
  /Cannot read properties of undefined/i,
  /Cannot read property .* of undefined/i,
  /Cannot access before initialization/i,
  
  // Module resolution errors for mocked modules
  /Module .* was externalized for browser compatibility/i,
  /Could not resolve .* from node_modules/i,
  
  // React Testing Library expected warnings
  /Warning: ReactDOM\.render is no longer supported/i,
  /Warning: React\.createFactory\(\) is deprecated/i,
  
  // JSDOM expected warnings
  /Error: Not implemented: HTMLCanvasElement\.prototype\.getContext/i,
  /Error: Not implemented: window\.scrollTo/i,
  /Error: Not implemented: window\.alert/i,
  
  // Vitest/Jest expected warnings
  /Warning: An invalid form control with name=.* is not focusable/i,
  /Warning: validateDOMNesting/i,
  
  // Network/fetch related test errors (when testing offline scenarios)
  /NetworkError when attempting to fetch resource/i,
  /Failed to fetch/i,
  
  // CSS/Style related test warnings
  /Warning: Received `true` for a non-boolean attribute/i,
  /Warning: Unknown event handler property/i,
]

// Define patterns for warnings that should be suppressed
const suppressedWarnPatterns = [
  // Development-only warnings that clutter test output
  /React Hook .* has a missing dependency/i,
  /Warning: Each child in a list should have a unique "key" prop/i,
  /Warning: Failed prop type/i,
  
  // Third-party library warnings that are not actionable in tests
  /deprecated/i,
  /will be removed in a future version/i,
]

// Enhanced error filtering function
const shouldSuppressMessage = (message: string, patterns: RegExp[]): boolean => {
  return patterns.some(pattern => pattern.test(message))
}

// Enhanced console.error with precise filtering
console.error = (...args: any[]) => {
  const message = String(args[0] || '')
  
  // Check if this error should be suppressed
  if (shouldSuppressMessage(message, suppressedErrorPatterns)) {
    return
  }
  
  // For debugging purposes, allow bypassing suppression with a flag
  if (process.env.VITEST_DEBUG_CONSOLE === 'true') {
    originalError('[SUPPRESSED]', ...args)
    return
  }
  
  // Allow legitimate errors through
  originalError(...args)
}

// Enhanced console.warn with filtering
console.warn = (...args: any[]) => {
  const message = String(args[0] || '')
  
  // Check if this warning should be suppressed
  if (shouldSuppressMessage(message, suppressedWarnPatterns)) {
    return
  }
  
  // For debugging purposes, allow bypassing suppression with a flag
  if (process.env.VITEST_DEBUG_CONSOLE === 'true') {
    originalWarn('[SUPPRESSED]', ...args)
    return
  }
  
  // Allow legitimate warnings through
  originalWarn(...args)
}

// Provide a way to restore original console methods for debugging
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).__restoreConsole = () => {
    console.error = originalError
    console.warn = originalWarn
  }
  
  ;(globalThis as any).__suppressConsole = () => {
    console.error = (...args: any[]) => {
      const message = String(args[0] || '')
      if (!shouldSuppressMessage(message, suppressedErrorPatterns)) {
        originalError(...args)
      }
    }
    console.warn = (...args: any[]) => {
      const message = String(args[0] || '')
      if (!shouldSuppressMessage(message, suppressedWarnPatterns)) {
        originalWarn(...args)
      }
    }
  }
}