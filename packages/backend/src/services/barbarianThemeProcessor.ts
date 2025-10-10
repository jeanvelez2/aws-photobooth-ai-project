import { logger } from '../utils/logger.js';
import { ModelManager, ModelType } from './modelManager.js';
import { onnxRuntimeService } from './onnxRuntimeService.js';
import { 
  FaceMeshData, 
  ProcessingOptions, 
  StyledResult, 
  TexturedResult, 
  LitResult,
  StyleFeatures,
  RGB,
  FacialStructureAdjustments,
  TextureData,
  LightingData,
  Vector3,
  LightSource,
  AmbientLighting,
  ShadowData,
  AtmosphericData,
  ParticleEffect,
  MistEffect,
  ColorGrading
} from './styleTransferEngine.js';

export interface BarbarianStyleConfig {
  ruggednessFactor: number; // 0.0 to 1.0
  weatheringIntensity: number; // 0.0 to 1.0
  scarDensity: number; // 0.0 to 1.0
  hairWildness: number; // 0.0 to 1.0
  beardEnhancement: boolean;
  dramaticLighting: boolean;
  battleHardened: boolean;
}

export interface BarbarianTextureEffects {
  ruggedSkin: TextureData;
  weatherMarks: TextureData;
  scars: ScarData[];
  wildHair: HairTextureData;
  facialHair: FacialHairData;
}

export interface ScarData {
  position: Vector3;
  length: number;
  width: number;
  depth: number;
  age: number; // 0.0 (fresh) to 1.0 (old)
  type: 'cut' | 'burn' | 'claw' | 'battle';
}

export interface HairTextureData {
  baseTexture: TextureData;
  roughnessMap: TextureData;
  flowMap: TextureData;
  colorVariation: RGB[];
}

export interface FacialHairData {
  beardTexture: TextureData;
  mustacheTexture: TextureData;
  density: number;
  roughness: number;
  color: RGB;
}

export interface BarbarianLightingConfig {
  harshShadows: boolean;
  dramaticContrast: number; // 0.0 to 2.0
  firelight: boolean;
  stormyAmbient: boolean;
  battlefieldAtmosphere: boolean;
}

/**
 * Barbarian Theme Processor
 * Implements rugged, weathered, battle-hardened transformations
 */
export class BarbarianThemeProcessor {
  private modelManager: ModelManager;
  private defaultConfig: BarbarianStyleConfig;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
    this.defaultConfig = {
      ruggednessFactor: 0.7,
      weatheringIntensity: 0.6,
      scarDensity: 0.3,
      hairWildness: 0.8,
      beardEnhancement: true,
      dramaticLighting: true,
      battleHardened: true
    };
  }

  /**
   * Apply barbarian style transfer to face mesh
   */
  async applyBarbarianStyle(
    faceMesh: FaceMeshData, 
    options: ProcessingOptions
  ): Promise<StyledResult> {
    logger.info('Applying barbarian style transfer', {
      styleIntensity: options.styleIntensity,
      quality: options.quality
    });

    try {
      // Load barbarian style transfer model
      const styleModel = await this.modelManager.getModel('barbarian', ModelType.STYLE_TRANSFER, options.quality);
      
      // Prepare input data for neural network
      const inputTensor = await this.prepareFaceMeshInput(faceMesh, options);
      
      // Run style transfer inference
      const styleOutput = await onnxRuntimeService.runInference(
        'barbarian-style-transfer',
        'barbarian',
        { 
          input_image: { data: inputTensor.imageTensor, dims: [1, 3, 512, 512], type: 'float32' },
          style_vector: { data: inputTensor.styleVector, dims: [1, 256], type: 'float32' }
        }
      );

      // Extract style features from neural network output
      const styleFeatures = await this.extractBarbarianFeatures(styleOutput, options);
      
      // Apply facial structure adjustments
      const adjustedMesh = await this.applyFacialStructureAdjustments(faceMesh, styleFeatures, options);
      
      // Generate transformation matrix
      const transformationMatrix = this.generateTransformationMatrix(styleFeatures, options);

      logger.info('Barbarian style transfer completed successfully');

      return {
        styledMesh: adjustedMesh,
        styleFeatures,
        transformationMatrix
      };

    } catch (error) {
      logger.error('Barbarian style transfer failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Barbarian style transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply barbarian texture adaptation
   */
  async adaptBarbarianTexture(
    styledResult: StyledResult, 
    options: ProcessingOptions
  ): Promise<TexturedResult> {
    logger.info('Applying barbarian texture adaptation');

    try {
      const config = this.getBarbarianConfig(options);
      
      // Generate rugged skin texture
      const ruggedSkin = await this.generateRuggedSkinTexture(styledResult.styledMesh, config);
      
      // Add weathering effects
      const weatheredSkin = await this.applyWeatheringEffects(ruggedSkin, config);
      
      // Generate and apply scars
      const scarredSkin = await this.generateScars(weatheredSkin, config);
      
      // Enhance hair texture
      const wildHair = await this.enhanceHairTexture(styledResult.styledMesh, config);
      
      // Add facial hair if enabled
      const facialHair = config.beardEnhancement ? 
        await this.generateFacialHair(styledResult.styledMesh, config) : null;

      // Combine all texture elements
      const finalTexture = await this.combineTextureElements(
        scarredSkin, 
        wildHair, 
        facialHair, 
        styledResult.styledMesh
      );

      return {
        texturedMesh: styledResult.styledMesh,
        baseTexture: finalTexture.baseTexture,
        normalTexture: finalTexture.normalTexture,
        specularTexture: finalTexture.specularTexture
      };

    } catch (error) {
      logger.error('Barbarian texture adaptation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Barbarian texture adaptation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply barbarian lighting effects
   */
  async adaptBarbarianLighting(
    texturedResult: TexturedResult, 
    originalImage: Buffer
  ): Promise<LitResult> {
    logger.info('Applying barbarian lighting adaptation');

    try {
      // Analyze original lighting
      const originalLighting = await this.analyzeLighting(originalImage);
      
      // Create dramatic barbarian lighting setup
      const barbarianLighting = await this.createBarbarianLighting(originalLighting);
      
      // Generate harsh shadows
      const shadows = await this.generateHarshShadows(texturedResult.texturedMesh, barbarianLighting);
      
      // Add atmospheric effects
      const atmosphere = await this.createBarbarianAtmosphere();
      
      return {
        finalMesh: texturedResult.texturedMesh,
        lightingData: {
          primaryLight: barbarianLighting.primaryLight,
          ambientLight: barbarianLighting.ambientLight,
          shadows
        },
        atmosphericEffects: atmosphere
      };

    } catch (error) {
      logger.error('Barbarian lighting adaptation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Barbarian lighting adaptation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prepare face mesh input for neural network
   */
  private async prepareFaceMeshInput(
    faceMesh: FaceMeshData, 
    options: ProcessingOptions
  ): Promise<{ imageTensor: Float32Array; styleVector: Float32Array }> {
    // Convert face mesh to image tensor (512x512x3)
    const imageSize = 512;
    const imageTensor = new Float32Array(1 * 3 * imageSize * imageSize);
    
    // Render face mesh to image tensor
    await this.renderMeshToTensor(faceMesh, imageTensor, imageSize);
    
    // Create barbarian style vector
    const styleVector = this.createBarbarianStyleVector(options);
    
    return { imageTensor, styleVector };
  }

  /**
   * Render face mesh to tensor for neural network input
   */
  private async renderMeshToTensor(
    faceMesh: FaceMeshData, 
    tensor: Float32Array, 
    size: number
  ): Promise<void> {
    // Simplified mesh rendering - in production this would use proper 3D rendering
    // For now, we'll create a placeholder that represents the face mesh data
    
    const vertexCount = faceMesh.vertices.length;
    const triangleCount = faceMesh.triangles.length;
    
    // Normalize vertices to image space
    for (let i = 0; i < vertexCount && i < tensor.length / 3; i++) {
      const vertex = faceMesh.vertices[i];
      const pixelIndex = Math.floor((vertex.y * size + vertex.x) * 3);
      
      if (pixelIndex >= 0 && pixelIndex < tensor.length - 2) {
        // Map 3D vertex to RGB values (normalized to 0-1)
        tensor[pixelIndex] = Math.max(0, Math.min(1, (vertex.x + 1) / 2)); // R
        tensor[pixelIndex + 1] = Math.max(0, Math.min(1, (vertex.y + 1) / 2)); // G
        tensor[pixelIndex + 2] = Math.max(0, Math.min(1, (vertex.z + 1) / 2)); // B
      }
    }
    
    logger.debug('Rendered face mesh to tensor', {
      vertexCount,
      triangleCount,
      tensorSize: tensor.length
    });
  }

  /**
   * Create barbarian-specific style vector
   */
  private createBarbarianStyleVector(options: ProcessingOptions): Float32Array {
    const styleVector = new Float32Array(256);
    const config = this.getBarbarianConfig(options);
    
    // Encode barbarian characteristics into style vector
    styleVector[0] = config.ruggednessFactor;
    styleVector[1] = config.weatheringIntensity;
    styleVector[2] = config.scarDensity;
    styleVector[3] = config.hairWildness;
    styleVector[4] = config.beardEnhancement ? 1.0 : 0.0;
    styleVector[5] = config.dramaticLighting ? 1.0 : 0.0;
    styleVector[6] = config.battleHardened ? 1.0 : 0.0;
    styleVector[7] = options.styleIntensity;
    styleVector[8] = options.preserveIdentity;
    
    // Fill remaining vector with barbarian-specific style parameters
    for (let i = 9; i < 256; i++) {
      styleVector[i] = Math.sin(i * 0.1) * config.ruggednessFactor;
    }
    
    return styleVector;
  }

  /**
   * Extract barbarian features from neural network output
   */
  private async extractBarbarianFeatures(
    styleOutput: Record<string, any>, 
    options: ProcessingOptions
  ): Promise<StyleFeatures> {
    const styledImageTensor = styleOutput.styled_image as Float32Array;
    
    // Extract color information from styled output
    const avgR = this.calculateAverageChannel(styledImageTensor, 0, 3);
    const avgG = this.calculateAverageChannel(styledImageTensor, 1, 3);
    const avgB = this.calculateAverageChannel(styledImageTensor, 2, 3);
    
    // Create barbarian-specific style features
    const config = this.getBarbarianConfig(options);
    
    return {
      skinTone: {
        r: Math.max(0.4, avgR * (1 + config.weatheringIntensity * 0.2)), // Weathered, tanned skin
        g: Math.max(0.3, avgG * (1 + config.weatheringIntensity * 0.1)),
        b: Math.max(0.2, avgB * (1 - config.weatheringIntensity * 0.1))
      },
      hairColor: {
        r: 0.3 + config.hairWildness * 0.2, // Dark, wild hair
        g: 0.2 + config.hairWildness * 0.1,
        b: 0.1 + config.hairWildness * 0.05
      },
      eyeColor: {
        r: 0.4 + (config.battleHardened ? 0.1 : 0), // Intense, battle-hardened eyes
        g: 0.3 + (config.battleHardened ? 0.1 : 0),
        b: 0.2 + (config.battleHardened ? 0.2 : 0)
      },
      facialStructure: {
        jawStrength: 0.7 + config.ruggednessFactor * 0.3, // Strong, rugged jaw
        cheekboneProminence: 0.6 + config.ruggednessFactor * 0.2,
        eyeSize: 1.0 - (config.battleHardened ? 0.1 : 0), // Slightly narrowed from battles
        noseShape: 1.0 + config.ruggednessFactor * 0.1, // Slightly broader nose
        lipFullness: 0.8 - config.ruggednessFactor * 0.1 // Thinner lips from harsh conditions
      },
      expressionIntensity: 0.8 + (config.battleHardened ? 0.2 : 0) // Intense, determined expression
    };
  }

  /**
   * Calculate average value for a specific channel
   */
  private calculateAverageChannel(tensor: Float32Array, channel: number, channels: number): number {
    let sum = 0;
    let count = 0;
    
    for (let i = channel; i < tensor.length; i += channels) {
      sum += tensor[i];
      count++;
    }
    
    return count > 0 ? sum / count : 0;
  }

  /**
   * Apply facial structure adjustments for barbarian look
   */
  private async applyFacialStructureAdjustments(
    faceMesh: FaceMeshData, 
    styleFeatures: StyleFeatures, 
    options: ProcessingOptions
  ): Promise<FaceMeshData> {
    const adjustedMesh = { ...faceMesh };
    const adjustments = styleFeatures.facialStructure;
    
    // Apply jaw strengthening
    adjustedMesh.vertices = faceMesh.vertices.map((vertex, index) => {
      // Identify jaw vertices (simplified - in production would use proper landmark mapping)
      const isJawVertex = vertex.y < -0.2 && Math.abs(vertex.x) > 0.3;
      
      if (isJawVertex) {
        return {
          x: vertex.x * (1 + (adjustments.jawStrength - 1) * 0.1),
          y: vertex.y,
          z: vertex.z * (1 + (adjustments.jawStrength - 1) * 0.05)
        };
      }
      
      // Apply cheekbone prominence
      const isCheekVertex = vertex.y > -0.1 && vertex.y < 0.2 && Math.abs(vertex.x) > 0.2;
      
      if (isCheekVertex) {
        return {
          x: vertex.x,
          y: vertex.y,
          z: vertex.z * (1 + (adjustments.cheekboneProminence - 1) * 0.1)
        };
      }
      
      return vertex;
    });
    
    logger.debug('Applied barbarian facial structure adjustments', {
      jawStrength: adjustments.jawStrength,
      cheekboneProminence: adjustments.cheekboneProminence
    });
    
    return adjustedMesh;
  }

  /**
   * Generate transformation matrix for barbarian style
   */
  private generateTransformationMatrix(
    styleFeatures: StyleFeatures, 
    options: ProcessingOptions
  ): number[][] {
    const intensity = options.styleIntensity;
    const ruggedness = this.getBarbarianConfig(options).ruggednessFactor;
    
    // Create 4x4 transformation matrix
    return [
      [1 + ruggedness * 0.05 * intensity, 0, 0, 0],
      [0, 1 + ruggedness * 0.03 * intensity, 0, 0],
      [0, 0, 1 + ruggedness * 0.02 * intensity, 0],
      [0, 0, 0, 1]
    ];
  }

  /**
   * Generate rugged skin texture
   */
  private async generateRuggedSkinTexture(
    faceMesh: FaceMeshData, 
    config: BarbarianStyleConfig
  ): Promise<TextureData> {
    const textureSize = 512;
    const textureData = new Uint8Array(textureSize * textureSize * 4); // RGBA
    
    // Generate base rugged texture
    for (let y = 0; y < textureSize; y++) {
      for (let x = 0; x < textureSize; x++) {
        const index = (y * textureSize + x) * 4;
        
        // Create noise-based rugged texture
        const noise1 = this.perlinNoise(x * 0.1, y * 0.1) * config.ruggednessFactor;
        const noise2 = this.perlinNoise(x * 0.05, y * 0.05) * config.ruggednessFactor * 0.5;
        const roughness = Math.max(0, Math.min(1, 0.6 + noise1 + noise2));
        
        // Base skin color with ruggedness
        const baseR = 180 + roughness * 40;
        const baseG = 140 + roughness * 30;
        const baseB = 100 + roughness * 20;
        
        textureData[index] = Math.min(255, baseR);     // R
        textureData[index + 1] = Math.min(255, baseG); // G
        textureData[index + 2] = Math.min(255, baseB); // B
        textureData[index + 3] = 255;                  // A
      }
    }
    
    return {
      data: textureData,
      width: textureSize,
      height: textureSize,
      channels: 4
    };
  }

  /**
   * Apply weathering effects to skin texture
   */
  private async applyWeatheringEffects(
    baseTexture: TextureData, 
    config: BarbarianStyleConfig
  ): Promise<TextureData> {
    const weatheredTexture = new Uint8Array(baseTexture.data);
    const { width, height } = baseTexture;
    
    // Apply weathering patterns
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Create weathering patterns
        const weatherNoise = this.perlinNoise(x * 0.02, y * 0.02) * config.weatheringIntensity;
        const ageSpots = this.perlinNoise(x * 0.3, y * 0.3) * config.weatheringIntensity * 0.3;
        
        if (weatherNoise > 0.3) {
          // Darken for weathered areas
          weatheredTexture[index] = Math.max(0, weatheredTexture[index] - weatherNoise * 30);
          weatheredTexture[index + 1] = Math.max(0, weatheredTexture[index + 1] - weatherNoise * 25);
          weatheredTexture[index + 2] = Math.max(0, weatheredTexture[index + 2] - weatherNoise * 20);
        }
        
        if (ageSpots > 0.4) {
          // Add age spots
          weatheredTexture[index] = Math.max(0, weatheredTexture[index] - 20);
          weatheredTexture[index + 1] = Math.max(0, weatheredTexture[index + 1] - 15);
          weatheredTexture[index + 2] = Math.max(0, weatheredTexture[index + 2] - 10);
        }
      }
    }
    
    return {
      ...baseTexture,
      data: weatheredTexture
    };
  }

  /**
   * Generate scars on the face
   */
  private async generateScars(
    baseTexture: TextureData, 
    config: BarbarianStyleConfig
  ): Promise<TextureData> {
    const scarredTexture = new Uint8Array(baseTexture.data);
    const { width, height } = baseTexture;
    
    // Generate random scars based on density
    const numScars = Math.floor(config.scarDensity * 8); // 0-8 scars
    
    for (let i = 0; i < numScars; i++) {
      const scar = this.generateRandomScar(width, height);
      this.applyScarToTexture(scarredTexture, scar, width, height);
    }
    
    return {
      ...baseTexture,
      data: scarredTexture
    };
  }

  /**
   * Generate a random scar
   */
  private generateRandomScar(width: number, height: number): ScarData {
    return {
      position: {
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0
      },
      length: 20 + Math.random() * 60,
      width: 2 + Math.random() * 4,
      depth: 0.3 + Math.random() * 0.7,
      age: Math.random(),
      type: ['cut', 'burn', 'claw', 'battle'][Math.floor(Math.random() * 4)] as 'cut' | 'burn' | 'claw' | 'battle'
    };
  }

  /**
   * Apply scar to texture
   */
  private applyScarToTexture(
    texture: Uint8Array, 
    scar: ScarData, 
    width: number, 
    height: number
  ): void {
    const startX = Math.floor(scar.position.x);
    const startY = Math.floor(scar.position.y);
    const angle = Math.random() * Math.PI * 2;
    
    // Draw scar line
    for (let i = 0; i < scar.length; i++) {
      const x = Math.floor(startX + Math.cos(angle) * i);
      const y = Math.floor(startY + Math.sin(angle) * i);
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const index = (y * width + x) * 4;
        
        // Darken for scar effect
        const darkening = scar.depth * (1 - scar.age * 0.5) * 100;
        texture[index] = Math.max(0, texture[index] - darkening);
        texture[index + 1] = Math.max(0, texture[index + 1] - darkening * 0.8);
        texture[index + 2] = Math.max(0, texture[index + 2] - darkening * 0.6);
      }
    }
  }

  /**
   * Enhance hair texture for wild barbarian look
   */
  private async enhanceHairTexture(
    faceMesh: FaceMeshData, 
    config: BarbarianStyleConfig
  ): Promise<HairTextureData> {
    const textureSize = 256;
    const baseTexture = new Uint8Array(textureSize * textureSize * 4);
    const roughnessMap = new Uint8Array(textureSize * textureSize * 4);
    const flowMap = new Uint8Array(textureSize * textureSize * 4);
    
    // Generate wild hair texture
    for (let y = 0; y < textureSize; y++) {
      for (let x = 0; x < textureSize; x++) {
        const index = (y * textureSize + x) * 4;
        
        // Wild hair base color (dark brown/black)
        const wildness = this.perlinNoise(x * 0.1, y * 0.1) * config.hairWildness;
        const baseR = 40 + wildness * 20;
        const baseG = 25 + wildness * 15;
        const baseB = 15 + wildness * 10;
        
        baseTexture[index] = baseR;
        baseTexture[index + 1] = baseG;
        baseTexture[index + 2] = baseB;
        baseTexture[index + 3] = 255;
        
        // High roughness for wild hair
        const roughness = 200 + config.hairWildness * 55;
        roughnessMap[index] = roughness;
        roughnessMap[index + 1] = roughness;
        roughnessMap[index + 2] = roughness;
        roughnessMap[index + 3] = 255;
        
        // Random flow directions for wild hair
        const flowX = Math.sin(x * 0.1 + y * 0.05) * config.hairWildness;
        const flowY = Math.cos(x * 0.05 + y * 0.1) * config.hairWildness;
        flowMap[index] = Math.floor((flowX + 1) * 127.5);
        flowMap[index + 1] = Math.floor((flowY + 1) * 127.5);
        flowMap[index + 2] = 128;
        flowMap[index + 3] = 255;
      }
    }
    
    return {
      baseTexture: { data: baseTexture, width: textureSize, height: textureSize, channels: 4 },
      roughnessMap: { data: roughnessMap, width: textureSize, height: textureSize, channels: 4 },
      flowMap: { data: flowMap, width: textureSize, height: textureSize, channels: 4 },
      colorVariation: [
        { r: 0.2, g: 0.1, b: 0.05 }, // Dark brown
        { r: 0.15, g: 0.08, b: 0.03 }, // Very dark brown
        { r: 0.1, g: 0.05, b: 0.02 }  // Almost black
      ]
    };
  }

  /**
   * Generate facial hair for barbarian look
   */
  private async generateFacialHair(
    faceMesh: FaceMeshData, 
    config: BarbarianStyleConfig
  ): Promise<FacialHairData> {
    const textureSize = 256;
    const beardTexture = new Uint8Array(textureSize * textureSize * 4);
    const mustacheTexture = new Uint8Array(textureSize * textureSize * 4);
    
    // Generate beard texture
    for (let y = 0; y < textureSize; y++) {
      for (let x = 0; x < textureSize; x++) {
        const index = (y * textureSize + x) * 4;
        
        // Beard area (lower half of face)
        if (y > textureSize * 0.6) {
          const density = this.perlinNoise(x * 0.2, y * 0.2) * 0.8 + 0.2;
          const hairColor = 30 + density * 20;
          
          beardTexture[index] = hairColor;
          beardTexture[index + 1] = hairColor * 0.7;
          beardTexture[index + 2] = hairColor * 0.5;
          beardTexture[index + 3] = Math.floor(density * 255);
        }
        
        // Mustache area
        if (y > textureSize * 0.45 && y < textureSize * 0.55 && 
            x > textureSize * 0.3 && x < textureSize * 0.7) {
          const density = this.perlinNoise(x * 0.3, y * 0.3) * 0.9 + 0.1;
          const hairColor = 35 + density * 25;
          
          mustacheTexture[index] = hairColor;
          mustacheTexture[index + 1] = hairColor * 0.7;
          mustacheTexture[index + 2] = hairColor * 0.5;
          mustacheTexture[index + 3] = Math.floor(density * 255);
        }
      }
    }
    
    return {
      beardTexture: { data: beardTexture, width: textureSize, height: textureSize, channels: 4 },
      mustacheTexture: { data: mustacheTexture, width: textureSize, height: textureSize, channels: 4 },
      density: 0.8,
      roughness: 0.9,
      color: { r: 0.2, g: 0.12, b: 0.06 }
    };
  }

  /**
   * Combine all texture elements
   */
  private async combineTextureElements(
    skinTexture: TextureData,
    hairTexture: HairTextureData,
    facialHair: FacialHairData | null,
    faceMesh: FaceMeshData
  ): Promise<{ baseTexture: TextureData; normalTexture: TextureData; specularTexture: TextureData }> {
    const { width, height } = skinTexture;
    const combinedBase = new Uint8Array(skinTexture.data);
    const normalMap = new Uint8Array(width * height * 4);
    const specularMap = new Uint8Array(width * height * 4);
    
    // Generate normal and specular maps
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Normal map (for surface detail)
        const normalX = this.perlinNoise(x * 0.1, y * 0.1) * 0.5 + 0.5;
        const normalY = this.perlinNoise(x * 0.1 + 100, y * 0.1 + 100) * 0.5 + 0.5;
        const normalZ = 0.8; // Mostly pointing up
        
        normalMap[index] = Math.floor(normalX * 255);
        normalMap[index + 1] = Math.floor(normalY * 255);
        normalMap[index + 2] = Math.floor(normalZ * 255);
        normalMap[index + 3] = 255;
        
        // Specular map (for shininess control)
        const roughness = this.perlinNoise(x * 0.05, y * 0.05) * 0.3 + 0.1; // Low specularity for rough skin
        specularMap[index] = Math.floor(roughness * 255);
        specularMap[index + 1] = Math.floor(roughness * 255);
        specularMap[index + 2] = Math.floor(roughness * 255);
        specularMap[index + 3] = 255;
      }
    }
    
    return {
      baseTexture: { data: combinedBase, width, height, channels: 4 },
      normalTexture: { data: normalMap, width, height, channels: 4 },
      specularTexture: { data: specularMap, width, height, channels: 4 }
    };
  }

  /**
   * Analyze lighting from original image
   */
  private async analyzeLighting(originalImage: Buffer): Promise<any> {
    // Simplified lighting analysis - in production would use computer vision
    return {
      primaryDirection: { x: 0.5, y: -0.3, z: 0.8 },
      intensity: 0.8,
      color: { r: 1.0, g: 0.95, b: 0.9 },
      ambientLevel: 0.3
    };
  }

  /**
   * Create dramatic barbarian lighting
   */
  private async createBarbarianLighting(originalLighting: any): Promise<LightingData> {
    return {
      primaryLight: {
        direction: { x: 0.7, y: -0.5, z: 0.5 }, // Harsh side lighting
        color: { r: 1.0, g: 0.8, b: 0.6 }, // Warm, firelight color
        intensity: 1.2, // Increased intensity for drama
        type: 'directional'
      },
      ambientLight: {
        color: { r: 0.3, g: 0.4, b: 0.5 }, // Cool ambient for contrast
        intensity: 0.2 // Low ambient for dramatic shadows
      },
      shadows: []
    };
  }

  /**
   * Generate harsh shadows for dramatic effect
   */
  private async generateHarshShadows(
    faceMesh: FaceMeshData, 
    lighting: LightingData
  ): Promise<ShadowData[]> {
    const shadows: ShadowData[] = [];
    
    // Generate shadows based on face geometry and lighting
    const lightDir = lighting.primaryLight.direction;
    
    // Add shadows under prominent features
    shadows.push({
      position: { x: 0.2, y: -0.3, z: 0 }, // Under cheekbone
      intensity: 0.7,
      softness: 0.2 // Hard shadows
    });
    
    shadows.push({
      position: { x: -0.2, y: -0.3, z: 0 }, // Under other cheekbone
      intensity: 0.7,
      softness: 0.2
    });
    
    shadows.push({
      position: { x: 0, y: -0.5, z: 0 }, // Under jaw
      intensity: 0.8,
      softness: 0.1
    });
    
    return shadows;
  }

  /**
   * Create barbarian atmospheric effects
   */
  private async createBarbarianAtmosphere(): Promise<AtmosphericData> {
    return {
      particles: [
        {
          type: 'dust',
          density: 0.3,
          color: { r: 0.6, g: 0.5, b: 0.4 },
          motion: { x: 0.1, y: 0.05, z: 0 }
        },
        {
          type: 'smoke',
          density: 0.1,
          color: { r: 0.2, g: 0.2, b: 0.2 },
          motion: { x: 0.05, y: 0.2, z: 0 }
        }
      ],
      mist: {
        density: 0.1,
        color: { r: 0.4, g: 0.4, b: 0.5 },
        height: 0.3
      },
      colorGrading: {
        shadows: { r: 0.8, g: 0.7, b: 0.6 }, // Warm shadows
        midtones: { r: 1.0, g: 0.9, b: 0.8 }, // Slightly warm midtones
        highlights: { r: 1.1, g: 1.0, b: 0.9 }, // Warm highlights
        saturation: 1.1, // Slightly increased saturation
        contrast: 1.3 // Increased contrast for drama
      }
    };
  }

  /**
   * Get barbarian configuration based on processing options
   */
  private getBarbarianConfig(options: ProcessingOptions): BarbarianStyleConfig {
    const baseConfig = { ...this.defaultConfig };
    
    // Adjust config based on style intensity
    const intensity = options.styleIntensity;
    baseConfig.ruggednessFactor *= intensity;
    baseConfig.weatheringIntensity *= intensity;
    baseConfig.scarDensity *= intensity;
    baseConfig.hairWildness *= intensity;
    
    // Adjust based on quality setting
    if (options.quality === 'fast') {
      baseConfig.scarDensity *= 0.5; // Fewer scars for faster processing
      baseConfig.beardEnhancement = false; // Skip beard for speed
    } else if (options.quality === 'high') {
      baseConfig.scarDensity *= 1.5; // More scars for higher quality
      baseConfig.weatheringIntensity *= 1.2; // More weathering detail
    }
    
    return baseConfig;
  }

  /**
   * Simple Perlin noise implementation for texture generation
   */
  private perlinNoise(x: number, y: number): number {
    // Simplified noise function - in production would use proper Perlin noise
    const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (a - Math.floor(a)) * 2 - 1;
  }
}