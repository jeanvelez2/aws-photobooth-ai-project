import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { document } from 'postcss'
import { MutationObserver } from '@tanstack/react-query'
import { document } from 'postcss'
import { document } from 'postcss'
import { describe, it, expect, vi } from 'vitest'

/**
 * Test Setup Verification Suite
 * 
 * This test file validates that the test environment setup is working correctly.
 * It verifies that all mocked browser APIs are available and functional,
 * and that problematic modules can be imported without errors.
 * 
 * Requirements covered: 1.3, 2.1, 2.2, 2.3, 2.4, 3.3, 3.4
 */

describe('Test Environment Setup Verification', () => {
  describe('Browser API Mocks', () => {
    it('should have functional matchMedia mock', () => {
      // Test that matchMedia is available and returns expected interface
      expect(window.matchMedia).toBeDefined()
      
      const mediaQuery = window.matchMedia('(min-width: 768px)')
      expect(mediaQuery).toHaveProperty('matches')
      expect(mediaQuery).toHaveProperty('media')
      expect(mediaQuery).toHaveProperty('addEventListener')
      expect(mediaQuery).toHaveProperty('removeEventListener')
      expect(mediaQuery.media).toBe('(min-width: 768px)')
      
      // Test that it's properly mocked
      expect(vi.isMockFunction(window.matchMedia)).toBe(true)
    })

    it('should have functional ResizeObserver mock', () => {
      // Test that ResizeObserver is available
      expect(global.ResizeObserver).toBeDefined()
      
      const callback = vi.fn()
      const observer = new ResizeObserver(callback)
      
      // Test observer methods are available
      expect(observer.observe).toBeDefined()
      expect(observer.unobserve).toBeDefined()
      expect(observer.disconnect).toBeDefined()
      
      // Test that methods are mocked functions
      expect(vi.isMockFunction(observer.observe)).toBe(true)
      expect(vi.isMockFunction(observer.unobserve)).toBe(true)
      expect(vi.isMockFunction(observer.disconnect)).toBe(true)
      
      // Test that observe triggers callback
      const element = document.createElement('div')
      observer.observe(element)
      
      // Wait for async callback
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(callback).toHaveBeenCalled()
          resolve()
        }, 10)
      })
    })

    it('should have functional IntersectionObserver mock', () => {
      // Test that IntersectionObserver is available
      expect(global.IntersectionObserver).toBeDefined()
      
      const callback = vi.fn()
      const observer = new IntersectionObserver(callback, {
        threshold: 0.5,
        rootMargin: '10px'
      })
      
      // Test observer methods are available
      expect(observer.observe).toBeDefined()
      expect(observer.unobserve).toBeDefined()
      expect(observer.disconnect).toBeDefined()
      expect(observer.takeRecords).toBeDefined()
      
      // Test configuration is preserved
      expect(observer.thresholds).toEqual([0.5])
      expect(observer.rootMargin).toBe('10px')
      
      // Test that observe triggers callback
      const element = document.createElement('div')
      observer.observe(element)
      
      // Wait for async callback
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(callback).toHaveBeenCalled()
          const [entries] = callback.mock.calls[0]
          expect(entries).toHaveLength(1)
          expect(entries[0]).toHaveProperty('isIntersecting', true)
          resolve()
        }, 10)
      })
    })

    it('should have functional MutationObserver mock', () => {
      // Test that MutationObserver is available
      expect(global.MutationObserver).toBeDefined()
      
      const callback = vi.fn()
      const observer = new MutationObserver(callback)
      
      // Test observer methods are available
      expect(observer.observe).toBeDefined()
      expect(observer.disconnect).toBeDefined()
      expect(observer.takeRecords).toBeDefined()
      
      // Test that methods are mocked functions
      expect(vi.isMockFunction(observer.observe)).toBe(true)
      expect(vi.isMockFunction(observer.disconnect)).toBe(true)
      expect(vi.isMockFunction(observer.takeRecords)).toBe(true)
    })

    it('should have functional PerformanceObserver mock', () => {
      // Test that PerformanceObserver is available
      expect(global.PerformanceObserver).toBeDefined()
      
      const callback = vi.fn()
      const observer = new PerformanceObserver(callback)
      
      // Test observer methods are available
      expect(observer.observe).toBeDefined()
      expect(observer.disconnect).toBeDefined()
      expect(observer.takeRecords).toBeDefined()
      
      // Test static property
      expect(PerformanceObserver.supportedEntryTypes).toEqual(['measure', 'navigation', 'resource', 'mark'])
    })

    it('should have functional getComputedStyle mock', () => {
      // Test that getComputedStyle is available
      expect(window.getComputedStyle).toBeDefined()
      
      const element = document.createElement('div')
      const styles = window.getComputedStyle(element)
      
      // Test that it returns expected interface
      expect(styles).toHaveProperty('getPropertyValue')
      expect(styles).toHaveProperty('setProperty')
      expect(styles).toHaveProperty('removeProperty')
      expect(styles).toHaveProperty('display')
      
      // Test that methods work
      expect(styles.getPropertyValue('color')).toBe('')
      expect(styles.display).toBe('block')
    })
  })

  describe('DOM API Mocks', () => {
    it('should have functional document.createRange mock', () => {
      // Test that createRange is available
      expect(document.createRange).toBeDefined()
      
      const range = document.createRange()
      
      // Test range methods are available
      expect(range.setStart).toBeDefined()
      expect(range.setEnd).toBeDefined()
      expect(range.toString).toBeDefined()
      
      // Test that range methods work (they may be native jsdom or our mocks)
      expect(() => range.setStart(document.body, 0)).not.toThrow()
      expect(() => range.setEnd(document.body, 0)).not.toThrow()
      expect(() => range.toString()).not.toThrow()
      
      // Test getBoundingClientRect if available (might not be in all setups)
      if (range.getBoundingClientRect) {
        expect(range.getBoundingClientRect).toBeDefined()
        expect(() => range.getBoundingClientRect()).not.toThrow()
      }
    })

    it('should have functional canvas context mock', () => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      // Test that context is available
      expect(context).not.toBeNull()
      expect(context).toHaveProperty('fillRect')
      expect(context).toHaveProperty('clearRect')
      expect(context).toHaveProperty('measureText')
      
      // Test canvas methods
      expect(canvas.toDataURL).toBeDefined()
      expect(canvas.toBlob).toBeDefined()
      expect(vi.isMockFunction(canvas.toDataURL)).toBe(true)
    })

    it('should have functional File and FileReader mocks', () => {
      // Test File constructor
      expect(global.File).toBeDefined()
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      expect(file.name).toBe('test.txt')
      expect(file.type).toBe('text/plain')
      
      // Test FileReader
      expect(global.FileReader).toBeDefined()
      const reader = new FileReader()
      expect(reader.readAsText).toBeDefined()
      expect(reader.readAsDataURL).toBeDefined()
      expect(reader.readAsArrayBuffer).toBeDefined()
    })
  })

  describe('Web API Mocks', () => {
    it('should have functional navigator mock with comprehensive APIs', () => {
      // Test basic navigator properties
      expect(navigator.userAgent).toContain('Test Environment')
      expect(navigator.language).toBe('en-US')
      expect(navigator.onLine).toBe(true)
      
      // Test Media Devices API
      expect(navigator.mediaDevices).toBeDefined()
      expect(navigator.mediaDevices.getUserMedia).toBeDefined()
      expect(navigator.mediaDevices.enumerateDevices).toBeDefined()
      
      // Test Permissions API
      expect(navigator.permissions).toBeDefined()
      expect(navigator.permissions.query).toBeDefined()
      
      // Test Service Worker API
      expect(navigator.serviceWorker).toBeDefined()
      expect(navigator.serviceWorker.register).toBeDefined()
      
      // Test Clipboard API
      expect(navigator.clipboard).toBeDefined()
      expect(navigator.clipboard.writeText).toBeDefined()
      expect(navigator.clipboard.readText).toBeDefined()
      
      // Test Geolocation API
      expect(navigator.geolocation).toBeDefined()
      expect(navigator.geolocation.getCurrentPosition).toBeDefined()
    })

    it('should have functional storage APIs', () => {
      // Test localStorage
      expect(window.localStorage).toBeDefined()
      expect(window.localStorage.getItem).toBeDefined()
      expect(window.localStorage.setItem).toBeDefined()
      
      // Test that storage methods work (they may be native jsdom implementations)
      expect(() => window.localStorage.setItem('test', 'value')).not.toThrow()
      expect(() => window.localStorage.getItem('test')).not.toThrow()
      
      // Test sessionStorage
      expect(window.sessionStorage).toBeDefined()
      expect(window.sessionStorage.getItem).toBeDefined()
      expect(window.sessionStorage.setItem).toBeDefined()
      
      // Test that sessionStorage methods work
      expect(() => window.sessionStorage.setItem('test', 'value')).not.toThrow()
      expect(() => window.sessionStorage.getItem('test')).not.toThrow()
    })

    it('should have functional animation frame APIs', () => {
      // Test requestAnimationFrame
      expect(global.requestAnimationFrame).toBeDefined()
      expect(global.cancelAnimationFrame).toBeDefined()
      expect(vi.isMockFunction(global.requestAnimationFrame)).toBe(true)
      
      // Test requestIdleCallback
      expect(global.requestIdleCallback).toBeDefined()
      expect(global.cancelIdleCallback).toBeDefined()
      expect(vi.isMockFunction(global.requestIdleCallback)).toBe(true)
    })

    it('should have functional scroll APIs', () => {
      // Test window scroll methods
      expect(window.scrollTo).toBeDefined()
      expect(window.scroll).toBeDefined()
      expect(vi.isMockFunction(window.scrollTo)).toBe(true)
      
      // Test element scroll method
      const element = document.createElement('div')
      expect(element.scrollIntoView).toBeDefined()
      expect(vi.isMockFunction(element.scrollIntoView)).toBe(true)
    })
  })

  describe('Problematic Module Imports', () => {
    it('should be able to import webidl-conversions without errors', async () => {
      // Test that webidl-conversions can be imported
      let importError: Error | null = null
      
      try {
        const webidlConversions = await import('webidl-conversions')
        expect(webidlConversions).toBeDefined()
        expect(webidlConversions.default).toBeDefined()
        
        // Test that conversion functions work
        if (webidlConversions.default.DOMString) {
          expect(webidlConversions.default.DOMString('test')).toBe('test')
        }
      } catch (error) {
        importError = error as Error
      }
      
      // Should not throw an error
      expect(importError).toBeNull()
    })

    it('should be able to import whatwg-url without errors', async () => {
      // Test that whatwg-url can be imported
      let importError: Error | null = null
      
      try {
        const whatwgUrl = await import('whatwg-url')
        expect(whatwgUrl).toBeDefined()
        expect(whatwgUrl.URL).toBeDefined()
        expect(whatwgUrl.URLSearchParams).toBeDefined()
        
        // Test that URL constructor works
        const url = new whatwgUrl.URL('https://example.com/path?query=value')
        expect(url.href).toBe('https://example.com/path?query=value')
        expect(url.hostname).toBe('example.com')
        
        // Test that URLSearchParams works
        const params = new whatwgUrl.URLSearchParams('key=value&foo=bar')
        expect(params.get('key')).toBe('value')
        expect(params.get('foo')).toBe('bar')
      } catch (error) {
        importError = error as Error
      }
      
      // Should not throw an error
      expect(importError).toBeNull()
    })
  })

  describe('Global URL APIs', () => {
    it('should have functional global URL and URLSearchParams', () => {
      // Test global URL
      expect(global.URL).toBeDefined()
      const url = new URL('https://example.com/path')
      expect(url.href).toBe('https://example.com/path')
      expect(url.toString()).toBe('https://example.com/path')
      
      // Test global URLSearchParams
      expect(global.URLSearchParams).toBeDefined()
      const params = new URLSearchParams('key=value')
      expect(params.get('key')).toBe('value')
      expect(params.toString()).toBe('key=value')
    })

    it('should have functional fetch mock', () => {
      // Test that fetch is available
      expect(global.fetch).toBeDefined()
      
      // Test that fetch can be called (it may be a native jsdom implementation or our mock)
      expect(() => global.fetch('https://example.com')).not.toThrow()
      
      // Verify it's callable and returns a promise-like object
      const result = global.fetch('https://example.com')
      expect(result).toBeDefined()
    })
  })

  describe('Test Environment Configuration', () => {
    it('should be running in jsdom environment', () => {
      // Test that we're in a browser-like environment
      expect(typeof window).toBe('object')
      expect(typeof document).toBe('object')
      expect(typeof navigator).toBe('object')
      
      // Test that document has expected properties
      expect(document.body).toBeDefined()
      expect(document.createElement).toBeDefined()
      expect(document.querySelector).toBeDefined()
    })

    it('should have proper global definitions', () => {
      // Test that globals are properly defined
      expect(typeof global).toBe('object')
      expect(typeof globalThis).toBe('object')
      expect(process.env.NODE_ENV).toBe('test')
    })

    it('should support both local and CI environments', () => {
      // Test that the environment works regardless of where it's running
      // This test should pass in both local development and CI
      
      // Basic functionality that should work everywhere
      expect(vi).toBeDefined()
      expect(expect).toBeDefined()
      
      // DOM manipulation should work
      const element = document.createElement('div')
      element.textContent = 'test'
      expect(element.textContent).toBe('test')
      
      // Mocked APIs should be available
      expect(window.matchMedia).toBeDefined()
      expect(global.ResizeObserver).toBeDefined()
      
      // Console should be available (even if filtered)
      expect(console.log).toBeDefined()
      expect(console.error).toBeDefined()
    })
  })

  describe('Testing Library Integration', () => {
    it('should have @testing-library/jest-dom matchers available', () => {
      // Test that jest-dom matchers are available
      const element = document.createElement('div')
      element.textContent = 'Hello World'
      document.body.appendChild(element)
      
      // These matchers should be available from @testing-library/jest-dom
      expect(element).toBeInTheDocument()
      expect(element).toHaveTextContent('Hello World')
      expect(element).toBeVisible()
      
      // Clean up
      document.body.removeChild(element)
    })

    it('should support React Testing Library patterns', () => {
      // Test that the environment supports typical React Testing Library usage
      const element = document.createElement('button')
      element.textContent = 'Click me'
      element.setAttribute('role', 'button')
      document.body.appendChild(element)
      
      // Test common queries would work
      expect(element).toHaveTextContent('Click me')
      expect(element).toHaveAttribute('role', 'button')
      
      // Clean up
      document.body.removeChild(element)
    })
  })

  describe('Error Handling and Console Filtering', () => {
    it('should handle expected errors gracefully', () => {
      // Test that the setup handles common test errors without breaking
      let errorThrown = false
      
      try {
        // This might throw in some environments, but should be handled
        const nonExistentProperty = (window as any).someNonExistentAPI
        expect(nonExistentProperty).toBeUndefined()
      } catch {
        errorThrown = true
      }
      
      // Should not break the test
      expect(errorThrown).toBe(false)
    })

    it('should have console methods available', () => {
      // Test that console methods are available (even if filtered)
      expect(console.log).toBeDefined()
      expect(console.error).toBeDefined()
      expect(console.warn).toBeDefined()
      
      // These should not throw errors
      expect(() => console.log('test')).not.toThrow()
      expect(() => console.warn('test warning')).not.toThrow()
    })
  })
})