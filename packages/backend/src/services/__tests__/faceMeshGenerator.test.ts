import { describe, it, expect, beforeEach } from 'vitest';
import { FaceMeshGenerator } from '../faceMeshGenerator.js';
import { FacialLandmark } from 'shared';

describe('FaceMeshGenerator', () => {
  let faceMeshGenerator: FaceMeshGenerator;
  let mockLandmarks: FacialLandmark[];

  beforeEach(() => {
    faceMeshGenerator = new FaceMeshGenerator();
    
    // Create mock facial landmarks for testing
    mockLandmarks = [
      { type: 'eyeLeft', x: 0.3, y: 0.4 },
      { type: 'eyeRight', x: 0.7, y: 0.4 },
      { type: 'nose', x: 0.5, y: 0.5 },
      { type: 'mouthLeft', x: 0.4, y: 0.7 },
      { type: 'mouthRight', x: 0.6, y: 0.7 },
      { type: 'chinBottom', x: 0.5, y: 0.9 },
      { type: 'leftEyeBrowLeft', x: 0.25, y: 0.35 },
      { type: 'leftEyeBrowRight', x: 0.35, y: 0.35 },
      { type: 'leftEyeBrowUp', x: 0.3, y: 0.3 },
      { type: 'rightEyeBrowLeft', x: 0.65, y: 0.35 },
      { type: 'rightEyeBrowRight', x: 0.75, y: 0.35 },
      { type: 'rightEyeBrowUp', x: 0.7, y: 0.3 },
      { type: 'leftEyeLeft', x: 0.25, y: 0.4 },
      { type: 'leftEyeRight', x: 0.35, y: 0.4 },
      { type: 'leftEyeUp', x: 0.3, y: 0.38 },
      { type: 'leftEyeDown', x: 0.3, y: 0.42 },
      { type: 'rightEyeLeft', x: 0.65, y: 0.4 },
      { type: 'rightEyeRight', x: 0.75, y: 0.4 },
      { type: 'rightEyeUp', x: 0.7, y: 0.38 },
      { type: 'rightEyeDown', x: 0.7, y: 0.42 },
      { type: 'noseLeft', x: 0.45, y: 0.5 },
      { type: 'noseRight', x: 0.55, y: 0.5 },
      { type: 'mouthUp', x: 0.5, y: 0.65 },
      { type: 'mouthDown', x: 0.5, y: 0.75 },
      { type: 'leftPupil', x: 0.3, y: 0.4 },
      { type: 'rightPupil', x: 0.7, y: 0.4 },
      { type: 'upperJawlineLeft', x: 0.2, y: 0.6 },
      { type: 'midJawlineLeft', x: 0.15, y: 0.75 },
      { type: 'midJawlineRight', x: 0.85, y: 0.75 },
      { type: 'upperJawlineRight', x: 0.8, y: 0.6 },
    ];
  });

  describe('generateMesh', () => {
    it('should generate a valid face mesh from landmarks', async () => {
      const mesh = await faceMeshGenerator.generateMesh(mockLandmarks);

      expect(mesh).toBeDefined();
      expect(mesh.vertices).toBeDefined();
      expect(mesh.triangles).toBeDefined();
      expect(mesh.uvMapping).toBeDefined();
      expect(mesh.normalMap).toBeDefined();
      expect(mesh.boundingBox).toBeDefined();
      
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.triangles.length).toBeGreaterThan(0);
      expect(mesh.uvMapping.length).toBeGreaterThan(0);
      expect(mesh.normalMap.length).toBeGreaterThan(0);
    });

    it('should generate 3D vertices with proper depth estimation', async () => {
      const mesh = await faceMeshGenerator.generateMesh(mockLandmarks);

      // Check that vertices have 3D coordinates
      for (const vertex of mesh.vertices) {
        expect(vertex.x).toBeDefined();
        expect(vertex.y).toBeDefined();
        expect(vertex.z).toBeDefined();
        expect(typeof vertex.z).toBe('number');
      }

      // Nose should have positive depth (protruding)
      const noseVertex = mesh.vertices[2]; // Nose landmark index
      expect(noseVertex.z).toBeGreaterThan(0);
    });

    it('should generate UV mapping coordinates', async () => {
      const mesh = await faceMeshGenerator.generateMesh(mockLandmarks);

      expect(mesh.uvMapping.length).toBe(mesh.vertices.length);
      
      for (const uv of mesh.uvMapping) {
        expect(uv.u).toBeGreaterThanOrEqual(0);
        expect(uv.u).toBeLessThanOrEqual(1);
        expect(uv.v).toBeGreaterThanOrEqual(0);
        expect(uv.v).toBeLessThanOrEqual(1);
      }
    });

    it('should calculate normal vectors', async () => {
      const mesh = await faceMeshGenerator.generateMesh(mockLandmarks);

      expect(mesh.normalMap.length).toBe(mesh.vertices.length);
      
      for (const normal of mesh.normalMap) {
        expect(normal.x).toBeDefined();
        expect(normal.y).toBeDefined();
        expect(normal.z).toBeDefined();
        
        // Normal vectors should be normalized (length ≈ 1)
        const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        expect(length).toBeCloseTo(1, 1);
      }
    });

    it('should calculate proper bounding box', async () => {
      const mesh = await faceMeshGenerator.generateMesh(mockLandmarks);

      expect(mesh.boundingBox.min).toBeDefined();
      expect(mesh.boundingBox.max).toBeDefined();
      
      expect(mesh.boundingBox.min.x).toBeLessThanOrEqual(mesh.boundingBox.max.x);
      expect(mesh.boundingBox.min.y).toBeLessThanOrEqual(mesh.boundingBox.max.y);
      expect(mesh.boundingBox.min.z).toBeLessThanOrEqual(mesh.boundingBox.max.z);
    });

    it('should handle different resolution options', async () => {
      const lowResMesh = await faceMeshGenerator.generateMesh(mockLandmarks, { resolution: 'low' });
      const highResMesh = await faceMeshGenerator.generateMesh(mockLandmarks, { resolution: 'high' });

      expect(highResMesh.vertices.length).toBeGreaterThan(lowResMesh.vertices.length);
    });

    it('should apply smoothing when requested', async () => {
      const unsmoothedMesh = await faceMeshGenerator.generateMesh(mockLandmarks, { smoothingIterations: 0 });
      const smoothedMesh = await faceMeshGenerator.generateMesh(mockLandmarks, { smoothingIterations: 3 });

      // Smoothed mesh should have different vertex positions
      expect(smoothedMesh.vertices).not.toEqual(unsmoothedMesh.vertices);
    });

    it('should throw error for insufficient landmarks', async () => {
      const insufficientLandmarks = mockLandmarks.slice(0, 5);
      
      await expect(faceMeshGenerator.generateMesh(insufficientLandmarks))
        .rejects.toThrow('MESH_GENERATION_FAILED');
    });

    it('should throw error for invalid landmark coordinates', async () => {
      const invalidLandmarks = [...mockLandmarks];
      invalidLandmarks[0].x = 2.0; // Invalid coordinate > 1
      
      await expect(faceMeshGenerator.generateMesh(invalidLandmarks))
        .rejects.toThrow('MESH_GENERATION_FAILED');
    });
  });

  describe('optimizeMesh', () => {
    it('should optimize mesh and improve quality', async () => {
      const originalMesh = await faceMeshGenerator.generateMesh(mockLandmarks);
      const optimizedMesh = await faceMeshGenerator.optimizeMesh(originalMesh);

      expect(optimizedMesh).toBeDefined();
      expect(optimizedMesh.optimizationLevel).toBeDefined();
      expect(optimizedMesh.qualityScore).toBeDefined();
      expect(optimizedMesh.vertexCount).toBeDefined();
      expect(optimizedMesh.triangleCount).toBeDefined();
      
      expect(optimizedMesh.qualityScore).toBeGreaterThan(0);
      expect(optimizedMesh.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should remove redundant vertices', async () => {
      const originalMesh = await faceMeshGenerator.generateMesh(mockLandmarks);
      const optimizedMesh = await faceMeshGenerator.optimizeMesh(originalMesh);

      // Optimized mesh should have same or fewer vertices
      expect(optimizedMesh.vertices.length).toBeLessThanOrEqual(originalMesh.vertices.length);
    });

    it('should maintain mesh integrity after optimization', async () => {
      const originalMesh = await faceMeshGenerator.generateMesh(mockLandmarks);
      const optimizedMesh = await faceMeshGenerator.optimizeMesh(originalMesh);

      // All triangle indices should be valid
      for (const triangle of optimizedMesh.triangles) {
        for (const vertexIndex of triangle.vertices) {
          expect(vertexIndex).toBeGreaterThanOrEqual(0);
          expect(vertexIndex).toBeLessThan(optimizedMesh.vertices.length);
        }
      }
    });
  });

  describe('validateMeshQuality', () => {
    it('should validate a good quality mesh', async () => {
      const mesh = await faceMeshGenerator.generateMesh(mockLandmarks);
      const validation = await faceMeshGenerator.validateMeshQuality(mesh);

      expect(validation).toBeDefined();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toBeDefined();
      expect(validation.warnings).toBeDefined();
      expect(validation.qualityMetrics).toBeDefined();
      
      expect(validation.errors.length).toBe(0);
      expect(validation.qualityMetrics.overallQuality).toBeGreaterThan(0);
    });

    it('should detect invalid mesh with no vertices', async () => {
      const invalidMesh = {
        vertices: [],
        triangles: [],
        uvMapping: [],
        normalMap: [],
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
      };

      const validation = await faceMeshGenerator.validateMeshQuality(invalidMesh);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('no vertices');
    });

    it('should detect invalid triangle indices', async () => {
      const mesh = await faceMeshGenerator.generateMesh(mockLandmarks);
      
      // Add invalid triangle with out-of-bounds vertex index
      mesh.triangles.push({ vertices: [0, 1, 999] });
      
      const validation = await faceMeshGenerator.validateMeshQuality(mesh);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid vertex index'))).toBe(true);
    });

    it('should calculate quality metrics', async () => {
      const mesh = await faceMeshGenerator.generateMesh(mockLandmarks);
      const validation = await faceMeshGenerator.validateMeshQuality(mesh);

      const metrics = validation.qualityMetrics;
      expect(metrics.vertexCount).toBe(mesh.vertices.length);
      expect(metrics.triangleCount).toBe(mesh.triangles.length);
      expect(metrics.aspectRatio).toBeGreaterThanOrEqual(0);
      expect(metrics.aspectRatio).toBeLessThanOrEqual(1);
      expect(metrics.symmetryScore).toBeGreaterThanOrEqual(0);
      expect(metrics.symmetryScore).toBeLessThanOrEqual(1);
      expect(metrics.smoothnessScore).toBeGreaterThanOrEqual(0);
      expect(metrics.smoothnessScore).toBeLessThanOrEqual(1);
      expect(metrics.topologyScore).toBeGreaterThanOrEqual(0);
      expect(metrics.topologyScore).toBeLessThanOrEqual(1);
      expect(metrics.overallQuality).toBeGreaterThanOrEqual(0);
      expect(metrics.overallQuality).toBeLessThanOrEqual(1);
    });
  });
});