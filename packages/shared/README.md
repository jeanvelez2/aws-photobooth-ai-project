# AI Photobooth Shared

Shared TypeScript types and utilities used across frontend and backend packages.

## Features

- **Type Definitions**: Comprehensive TypeScript interfaces for all data models
- **API Contracts**: Request/response types for type-safe API communication
- **Validation Schemas**: Zod schemas for runtime type validation
- **Utility Functions**: Common helpers for data transformation and validation

## Types

### Core Models

```typescript
// Theme system with gender-adaptive variants
interface Theme {
  id: string;
  name: string;
  description: string;
  category: string;
  variants: ThemeVariant[];
}

interface ThemeVariant {
  id: string;
  name: string;
  description: string;
  templateUrl: string;
  maskUrl: string;
  thumbnailUrl: string;
  gender?: 'Male' | 'Female';
}

// Processing job lifecycle
interface ProcessingJob {
  jobId: string;
  status: JobStatus;
  imageUrl: string;
  themeId: string;
  variantId?: string;
  resultUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
```

### API Types

```typescript
// Request/response contracts
interface ProcessingRequest {
  photoId: string;
  themeId: string;
  variantId?: string;
  outputFormat: 'jpeg' | 'png';
  userId?: string;
  originalImageUrl: string;
}

interface FaceDetectionResult {
  faces: DetectedFace[];
  imageWidth: number;
  imageHeight: number;
  gender?: 'Male' | 'Female';
  confidence?: number;
}

interface DetectedFace {
  boundingBox: BoundingBox;
  confidence: number;
  landmarks: FaceLandmark[];
  gender: GenderAnalysis;
  ageRange: AgeRange;
}
```

## Usage

```typescript
// Import types in frontend
import { Theme, ProcessingJob, JobStatus } from 'shared/types';

// Import types in backend
import { ProcessingRequest, FaceDetectionResult } from 'shared/types';

// Use validation schemas
import { processRequestSchema } from 'shared/validation';
const result = processRequestSchema.parse(requestData);
```

## Development

```bash
# Build shared package
npm run build

# Watch for changes
npm run dev

# Type checking
npm run type-check
```

## Type Safety

- Strict TypeScript configuration
- Runtime validation with Zod schemas
- Comprehensive error types
- API contract enforcement
- Gender-aware type definitions

## Validation

- Input sanitization helpers
- File type validation
- Image format checking
- Request size validation
- URL validation for SSRF protection