# AI Photobooth Frontend

React-based frontend application for the AI Photobooth with mobile-first design and accessibility features.

## Features

- **Camera Integration**: WebRTC with mobile optimization and face/rear camera switching
- **Theme Selection**: Interactive theme browser with gender-adaptive recommendations
- **Real-time Processing**: Live status updates with progress indicators
- **Offline Support**: Service worker with request queuing and background sync
- **Mobile Optimized**: Touch gestures, responsive design, and optimized performance
- **Accessibility**: ARIA labels, keyboard navigation, and screen reader support
- **Performance**: Bundle size budgets, Web Vitals monitoring, and optimization

## Technology Stack

- **React 18** with TypeScript 5.7
- **Vite 7.1** for fast development and building
- **Tailwind CSS 4.1** for responsive styling
- **TanStack Query v5** for state management and caching
- **Playwright** for E2E testing across browsers and devices

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
npm run test:e2e

# Check performance budgets
npm run performance:budget
```

## Performance Budgets

- Bundle size: 500KB maximum
- First Contentful Paint: 1.5s
- Largest Contentful Paint: 2.5s
- Cumulative Layout Shift: 0.1
- First Input Delay: 100ms

## Mobile Features

- Touch gesture support (tap, swipe, pinch)
- Camera optimization for mobile devices
- Responsive grid layouts
- Offline queue management
- Progressive Web App capabilities

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader optimized
- High contrast support
- Focus management

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Environment Variables

```bash
VITE_API_URL=/api                    # API base URL
VITE_BUNDLE_SIZE=450                 # Bundle size for monitoring
```