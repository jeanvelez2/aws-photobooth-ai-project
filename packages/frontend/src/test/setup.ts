import '@testing-library/jest-dom'

// Mock browser APIs that might be missing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

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
          if (key) this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''))
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

// Mock navigator
Object.defineProperty(window, 'navigator', {
  writable: true,
  value: {
    userAgent: 'test',
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getVideoTracks: () => [],
        getAudioTracks: () => [],
      }),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  },
})

// Mock problematic modules
vi.mock('webidl-conversions', () => ({
  default: {},
}))

vi.mock('whatwg-url', () => ({
  URL: global.URL || class URL {
    constructor(public href: string) {}
    toString() { return this.href }
  },
  URLSearchParams: global.URLSearchParams || class URLSearchParams {
    constructor() {}
    get() { return null }
    set() {}
    toString() { return '' }
  },
}))

// Suppress console errors for expected test failures
const originalError = console.error
console.error = (...args: any[]) => {
  // Suppress specific errors that are expected in tests
  const message = args[0]?.toString() || ''
  if (
    message.includes('webidl-conversions') ||
    message.includes('whatwg-url') ||
    message.includes('Cannot read properties of undefined')
  ) {
    return
  }
  originalError(...args)
}