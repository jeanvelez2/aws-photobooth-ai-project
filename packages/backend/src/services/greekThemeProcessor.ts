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

export interface GreekStyleConfig {
  classicalProportions: number; // 0.0 to 1.0 - adherence to golden ratio
  marbleSmoothing: number; // 0.0 to 1.0 - skin smoothing intensity
  nobleExpression: number; // 0.0 to 1.0 - serene, noble expression enhancement
  classicalHairStyling: number; // 0.0 to 1.0 - curls and braids enhancement
  softLighting: boolean; // Enable soft classical lighting
  goldenRatioAdjustment: boolean; // Apply golden ratio proportions
  marbleTexture: boolean; // Apply marble-like skin texture
}

export interface GreekTextureEffects {
  marbleSkin: TextureData;
  classicalHair: ClassicalHairData;
  nobleFeatures: NobleFeatureData;
  softHighlights: TextureData;
}

export interface ClassicalHairData {
  curlTexture: TextureData;
  braidTexture: TextureData;
  flowMap: TextureData;
  colorPalette: RGB[];
  styleType: 'curls' | 'braids' | 'classical_straight';
}

export interface NobleFeatureData {
  eyeEnhancement: EyeEnhancementData;
  lipRefinement: LipRefinementData;
  noseClassical: NoseClassicalData;
  cheekboneDefinition: CheekboneData;
}

export interface EyeEnhancementData {
  shape: 'almond' | 'classical';
  color: RGB;
  brightness: number;
  serenity: number;
}

export interface LipRefinementData {
  shape: 'classical_bow' | 'refined';
  color: RGB;
  softness: number;
}

export interface NoseClassicalData {
  profile: 'straight' | 'slightly_aquiline';
  refinement: number;
}

export interface CheekboneData {
  prominence: number;
  softness: number;
  marbleHighlight: number;
}

export interface GreekLightingConfig {
  softShadows: boolean;
  classicalContrast: number; // 0.5 to 1.5 - gentle contrast
  marbleGlow: boolean;
  sereneLighting: boolean;
  templeAmbient: boolean;
}

/**
 * Greek Classical Theme Processor
 * Implements classical proportions, marble-like skin, and noble transformations
 */
export class GreekThemeProcessor {
  private modelManager: ModelManager;
  private defaultConfig: GreekStyleConfig;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
    this.defaultConfig = {
      classicalProportions: 0.8,
      marbleSmoothing: 0.7,
      nobleExpression: 0.6,
      classicalHairStyling: 0.7,
      softLighting: true,
      goldenRatioAdjustment: true,
      marbleTexture: true
    };
  }

  /**
   * Apply Greek classical style transfer to face mesh
   */
  async applyGreekStyle(
    faceMesh: FaceMeshData, 
    options: ProcessingOptions
  ): Promise<StyledResult> {
    logger.info('Applying Greek classical style transfer', {
      styleIntensity: options.styleIntensity,
      quality: options.quality
    });

    try {
      // Load Greek style transfer model
      const styleModel = await this.modelManager.getModel('greek', ModelType.STYLE_TRANSFER, options.quality);
      
      // Prepare input data for neural network
      const inputTensor = await this.prepareFaceMeshInput(faceMesh, options);
      
      // Run style transfer inference
      const styleOutput = await onnxRuntimeService.runInference(
        'greek-style-transfer',
        'greek',
        { 
          input_image: { data: inputTensor.imageTensor, dims: [1, 3, 512, 512], type: 'float32' },
          style_vector: { data: inputTensor.styleVector, dims: [1, 256], type: 'float32' }
        }
      );

      // Extract Greek classical features from neural network output
      const styleFeatures = await this.extractGreekFeatures(styleOutput, options);
      
      // Apply golden ratio proportions
      const adjustedMesh = await this.applyGoldenRatioAdjustments(faceMesh, styleFeatures, options);
      
      // Generate transformation matrix
      const transformationMatrix = this.generateTransformationMatrix(styleFeatures, options);

      logger.info('Greek classical style transfer completed successfully');

      return {
        styledMesh: adjustedMesh,
        styleFeatures,
        transformationMatrix
      };

    } catch (error) {
      logger.error('Greek style transfer failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Greek style transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply Greek classical texture adaptation
   */
  async adaptGreekTexture(
    styledResult: StyledResult, 
    options: ProcessingOptions
  ): Promise<TexturedResult> {
    logger.info('Applying Greek classical texture adaptation');

    try {
      const config = this.getGreekConfig(options);
      
      // Generate marble-like skin texture
      const marbleSkin = await this.generateMarbleSkinTexture(styledResult.styledMesh, config);
      
      // Apply classical smoothing effects
      const smoothedSkin = await this.applyClassicalSmoothing(marbleSkin, config);
      
      // Enhance hair with classical styling
      const classicalHair = await this.enhanceClassicalHair(styledResult.styledMesh, config);
      
      // Apply noble feature refinements
      const refinedFeatures = await this.applyNobleFeatureRefinements(smoothedSkin, config);

      // Combine all texture elements
      const finalTexture = await this.combineGreekTextureElements(
        refinedFeatures, 
        classicalHair, 
        styledResult.styledMesh
      );

      return {
        texturedMesh: styledResult.styledMesh,
        baseTexture: finalTexture.baseTexture,
        normalTexture: finalTexture.normalTexture,
        specularTexture: finalTexture.specularTexture
      };

    } catch (error) {
      logger.error('Greek texture adaptation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Greek texture adaptation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply Greek classical lighting effects
   */
  async adaptGreekLighting(
    texturedResult: TexturedResult, 
    originalImage: Buffer
  ): Promise<LitResult> {
    logger.info('Applying Greek classical lighting adaptation');

    try {
      // Analyze original lighting
      const originalLighting = await this.analyzeLighting(originalImage);
      
      // Create soft classical lighting setup
      const greekLighting = await this.createClassicalLighting(originalLighting);
      
      // Generate soft shadows
      const shadows = await this.generateSoftShadows(texturedResult.texturedMesh, greekLighting);
      
      // Add temple-like atmospheric effects
      const atmosphere = await this.createClassicalAtmosphere();
      
      return {
        finalMesh: texturedResult.texturedMesh,
        lightingData: {
          primaryLight: greekLighting.primaryLight,
          ambientLight: greekLighting.ambientLight,
          shadows
        },
        atmosphericEffects: atmosphere
      };

    } catch (error) {
      logger.error('Greek lighting adaptation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Greek lighting adaptation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    // Create Greek classical style vector
    const styleVector = this.createGreekStyleVector(options);
    
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
    
    // Normalize vertices to image space with classical proportions
    for (let i = 0; i < vertexCount && i < tensor.length / 3; i++) {
      const vertex = faceMesh.vertices[i];
      const pixelIndex = Math.floor((vertex.y * size + vertex.x) * 3);
      
      if (pixelIndex >= 0 && pixelIndex < tensor.length - 2) {
        // Map 3D vertex to RGB values with classical bias
        tensor[pixelIndex] = Math.max(0, Math.min(1, (vertex.x + 1) / 2 * 0.95 + 0.025)); // R - slightly warmer
        tensor[pixelIndex + 1] = Math.max(0, Math.min(1, (vertex.y + 1) / 2 * 0.98 + 0.01)); // G - balanced
        tensor[pixelIndex + 2] = Math.max(0, Math.min(1, (vertex.z + 1) / 2 * 0.92 + 0.04)); // B - slightly cooler for marble
      }
    }
    
    logger.debug('Rendered face mesh to tensor with classical proportions', {
      vertexCount,
      triangleCount,
      tensorSize: tensor.length
    });
  }

  /**
   * Create Greek classical style vector
   */
  private createGreekStyleVector(options: ProcessingOptions): Float32Array {
    const styleVector = new Float32Array(256);
    const config = this.getGreekConfig(options);
    
    // Encode Greek classical characteristics into style vector
    styleVector[0] = config.classicalProportions;
    styleVector[1] = config.marbleSmoothing;
    styleVector[2] = config.nobleExpression;
    styleVector[3] = config.classicalHairStyling;
    styleVector[4] = config.softLighting ? 1.0 : 0.0;
    styleVector[5] = config.goldenRatioAdjustment ? 1.0 : 0.0;
    styleVector[6] = config.marbleTexture ? 1.0 : 0.0;
    styleVector[7] = options.styleIntensity;
    styleVector[8] = options.preserveIdentity;
    
    // Golden ratio constant (φ = 1.618...)
    const goldenRatio = 1.618033988749;
    
    // Fill remaining vector with classical harmony parameters
    for (let i = 9; i < 256; i++) {
      // Use golden ratio and classical proportions for harmonic style encoding
      styleVector[i] = Math.sin(i * goldenRatio * 0.1) * config.classicalProportions;
    }
    
    return styleVector;
  }

  /**
   * Extract Greek classical features from neural network output
   */
  private async extractGreekFeatures(
    styleOutput: Record<string, any>, 
    options: ProcessingOptions
  ): Promise<StyleFeatures> {
    const styledImageTensor = styleOutput.styled_image as Float32Array;
    
    // Extract color information from styled output
    const avgR = this.calculateAverageChannel(styledImageTensor, 0, 3);
    const avgG = this.calculateAverageChannel(styledImageTensor, 1, 3);
    const avgB = this.calculateAverageChannel(styledImageTensor, 2, 3);
    
    // Create Greek classical style features
    const config = this.getGreekConfig(options);
    
    return {
      skinTone: {
        r: Math.max(0.85, avgR * (1 + config.marbleSmoothing * 0.15)), // Smooth, marble-like skin
        g: Math.max(0.82, avgG * (1 + config.marbleSmoothing * 0.12)),
        b: Math.max(0.78, avgB * (1 + config.marbleSmoothing * 0.08))
      },
      hairColor: {
        r: 0.6 + config.classicalHairStyling * 0.2, // Classical golden-brown hair
        g: 0.45 + config.classicalHairStyling * 0.15,
        b: 0.25 + config.classicalHairStyling * 0.1
      },
      eyeColor: {
        r: 0.3 + (config.nobleExpression * 0.2), // Serene, noble eyes
        g: 0.4 + (config.nobleExpression * 0.15),
        b: 0.6 + (config.nobleExpression * 0.1)
      },
      facialStructure: {
        jawStrength: 0.6 + config.classicalProportions * 0.2, // Refined, not overly strong
        cheekboneProminence: 0.7 + config.classicalProportions * 0.2, // Classical cheekbones
        eyeSize: 1.0 + (config.nobleExpression * 0.1), // Slightly larger, more expressive eyes
        noseShape: 1.0 + config.classicalProportions * 0.05, // Classical straight nose
        lipFullness: 0.9 + config.nobleExpression * 0.1 // Refined, noble lips
      },
      expressionIntensity: 0.4 + (config.nobleExpression * 0.3) // Serene, composed expression
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
   * Apply golden ratio proportions to facial features
   */
  private async applyGoldenRatioAdjustments(
    faceMesh: FaceMeshData, 
    styleFeatures: StyleFeatures, 
    options: ProcessingOptions
  ): Promise<FaceMeshData> {
    const adjustedMesh = { ...faceMesh };
    const adjustments = styleFeatures.facialStructure;
    const goldenRatio = 1.618033988749;
    const config = this.getGreekConfig(options);
    
    if (!config.goldenRatioAdjustment) {
      return adjustedMesh;
    }

    // Apply golden ratio proportions
    adjustedMesh.vertices = faceMesh.vertices.map((vertex, index) => {
      // Apply golden ratio to facial proportions
      const faceHeight = 2.0; // Normalized face height
      const idealFaceWidth = faceHeight / goldenRatio;
      
      // Adjust eye positioning using golden ratio
      const isEyeVertex = vertex.y > 0.1 && vertex.y < 0.3 && Math.abs(vertex.x) > 0.2;
      
      if (isEyeVertex) {
        const eyeDistance = Math.abs(vertex.x);
        const idealEyeDistance = idealFaceWidth * 0.3;
        const adjustment = (idealEyeDistance / eyeDistance - 1) * config.classicalProportions * 0.1;
        
        return {
          x: vertex.x * (1 + adjustment),
          y: vertex.y,
          z: vertex.z
        };
      }
      
      // Adjust nose proportions
      const isNoseVertex = Math.abs(vertex.x) < 0.1 && vertex.y > -0.1 && vertex.y < 0.2;
      
      if (isNoseVertex) {
        const noseLength = 0.3; // Current nose length
        const idealNoseLength = faceHeight / (goldenRatio * goldenRatio);
        const adjustment = (idealNoseLength / noseLength - 1) * config.classicalProportions * 0.05;
        
        return {
          x: vertex.x,
          y: vertex.y * (1 + adjustment),
          z: vertex.z
        };
      }
      
      // Adjust lip positioning
      const isLipVertex = Math.abs(vertex.x) < 0.2 && vertex.y > -0.3 && vertex.y < -0.1;
      
      if (isLipVertex) {
        const lipPosition = Math.abs(vertex.y);
        const idealLipPosition = faceHeight / (goldenRatio * 1.5);
        const adjustment = (idealLipPosition / lipPosition - 1) * config.classicalProportions * 0.03;
        
        return {
          x: vertex.x,
          y: vertex.y * (1 + adjustment),
          z: vertex.z
        };
      }
      
      return vertex;
    });
    
    logger.debug('Applied golden ratio adjustments to facial features', {
      goldenRatio,
      classicalProportions: adjustments.jawStrength,
      adjustmentIntensity: config.classicalProportions
    });
    
    return adjustedMesh;
  }

  /**
   * Generate transformation matrix for Greek classical style
   */
  private generateTransformationMatrix(
    styleFeatures: StyleFeatures, 
    options: ProcessingOptions
  ): number[][] {
    const intensity = options.styleIntensity;
    const classical = this.getGreekConfig(options).classicalProportions;
    const goldenRatio = 1.618033988749;
    
    // Create 4x4 transformation matrix with golden ratio influence
    return [
      [1 + classical * 0.02 * intensity / goldenRatio, 0, 0, 0],
      [0, 1 + classical * 0.03 * intensity, 0, 0],
      [0, 0, 1 + classical * 0.01 * intensity, 0],
      [0, 0, 0, 1]
    ];
  }

  /**
   * Generate marble-like skin texture
   */
  private async generateMarbleSkinTexture(
    faceMesh: FaceMeshData, 
    config: GreekStyleConfig
  ): Promise<TextureData> {
    const textureSize = 512;
    const textureData = new Uint8Array(textureSize * textureSize * 4); // RGBA
    
    // Generate base marble texture
    for (let y = 0; y < textureSize; y++) {
      for (let x = 0; x < textureSize; x++) {
        const index = (y * textureSize + x) * 4;
        
        // Create marble-like texture with smooth variations
        const marble1 = this.marbleNoise(x * 0.02, y * 0.02) * config.marbleSmoothing;
        const marble2 = this.marbleNoise(x * 0.01, y * 0.01) * config.marbleSmoothing * 0.5;
        const smoothness = Math.max(0, Math.min(1, 0.9 + marble1 + marble2));
        
        // Base marble skin color - warm, smooth tones
        const baseR = 240 - smoothness * 15; // Very light, warm base
        const baseG = 230 - smoothness * 10;
        const baseB = 220 - smoothness * 8;
        
        textureData[index] = Math.min(255, Math.max(200, baseR));     // R
        textureData[index + 1] = Math.min(255, Math.max(190, baseG)); // G
        textureData[index + 2] = Math.min(255, Math.max(180, baseB)); // B
        textureData[index + 3] = 255;                                 // A
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
   * Apply classical smoothing effects
   */
  private async applyClassicalSmoothing(
    baseTexture: TextureData, 
    config: GreekStyleConfig
  ): Promise<TextureData> {
    const smoothedTexture = new Uint8Array(baseTexture.data);
    const { width, height } = baseTexture;
    
    // Apply smoothing with classical lighting
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Create soft, classical lighting effects
        const softLight = this.marbleNoise(x * 0.005, y * 0.005) * config.marbleSmoothing;
        const highlight = this.marbleNoise(x * 0.1, y * 0.1) * config.marbleSmoothing * 0.2;
        
        if (softLight > 0.1) {
          // Add soft highlights for marble effect
          smoothedTexture[index] = Math.min(255, smoothedTexture[index] + softLight * 20);
          smoothedTexture[index + 1] = Math.min(255, smoothedTexture[index + 1] + softLight * 18);
          smoothedTexture[index + 2] = Math.min(255, smoothedTexture[index + 2] + softLight * 15);
        }
        
        if (highlight > 0.3) {
          // Add subtle marble veining
          const veinIntensity = highlight * 10;
          smoothedTexture[index] = Math.min(255, smoothedTexture[index] + veinIntensity);
          smoothedTexture[index + 1] = Math.min(255, smoothedTexture[index + 1] + veinIntensity * 0.9);
          smoothedTexture[index + 2] = Math.min(255, smoothedTexture[index + 2] + veinIntensity * 0.8);
        }
      }
    }
    
    return {
      ...baseTexture,
      data: smoothedTexture
    };
  }

  /**
   * Enhance hair with classical styling
   */
  private async enhanceClassicalHair(
    faceMesh: FaceMeshData, 
    config: GreekStyleConfig
  ): Promise<ClassicalHairData> {
    const textureSize = 256;
    const curlTexture = new Uint8Array(textureSize * textureSize * 4);
    const braidTexture = new Uint8Array(textureSize * textureSize * 4);
    const flowMap = new Uint8Array(textureSize * textureSize * 4);
    
    // Generate classical hair textures
    for (let y = 0; y < textureSize; y++) {
      for (let x = 0; x < textureSize; x++) {
        const index = (y * textureSize + x) * 4;
        
        // Classical curl pattern
        const curlPattern = this.classicalCurlNoise(x, y) * config.classicalHairStyling;
        const curlR = 120 + curlPattern * 40; // Golden-brown hair
        const curlG = 80 + curlPattern * 30;
        const curlB = 40 + curlPattern * 20;
        
        curlTexture[index] = Math.min(255, curlR);
        curlTexture[index + 1] = Math.min(255, curlG);
        curlTexture[index + 2] = Math.min(255, curlB);
        curlTexture[index + 3] = 255;
        
        // Classical braid pattern
        const braidPattern = this.classicalBraidNoise(x, y) * config.classicalHairStyling;
        const braidR = 100 + braidPattern * 35;
        const braidG = 70 + braidPattern * 25;
        const braidB = 35 + braidPattern * 15;
        
        braidTexture[index] = Math.min(255, braidR);
        braidTexture[index + 1] = Math.min(255, braidG);
        braidTexture[index + 2] = Math.min(255, braidB);
        braidTexture[index + 3] = 255;
        
        // Classical flow directions
        const flowX = Math.sin(x * 0.05 + y * 0.02) * config.classicalHairStyling * 0.5;
        const flowY = Math.cos(x * 0.02 + y * 0.05) * config.classicalHairStyling * 0.5;
        flowMap[index] = Math.floor((flowX + 1) * 127.5);
        flowMap[index + 1] = Math.floor((flowY + 1) * 127.5);
        flowMap[index + 2] = 128;
        flowMap[index + 3] = 255;
      }
    }
    
    return {
      curlTexture: { data: curlTexture, width: textureSize, height: textureSize, channels: 4 },
      braidTexture: { data: braidTexture, width: textureSize, height: textureSize, channels: 4 },
      flowMap: { data: flowMap, width: textureSize, height: textureSize, channels: 4 },
      colorPalette: [
        { r: 0.7, g: 0.5, b: 0.3 }, // Golden brown
        { r: 0.6, g: 0.4, b: 0.25 }, // Medium brown
        { r: 0.5, g: 0.35, b: 0.2 }  // Dark brown
      ],
      styleType: 'curls'
    };
  }

  /**
   * Apply noble feature refinements
   */
  private async applyNobleFeatureRefinements(
    baseTexture: TextureData, 
    config: GreekStyleConfig
  ): Promise<TextureData> {
    const refinedTexture = new Uint8Array(baseTexture.data);
    const { width, height } = baseTexture;
    
    // Apply noble feature enhancements
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Eye area enhancement (upper portion of face)
        if (y > height * 0.3 && y < height * 0.6) {
          const eyeEnhancement = config.nobleExpression * 15;
          refinedTexture[index] = Math.min(255, refinedTexture[index] + eyeEnhancement);
          refinedTexture[index + 1] = Math.min(255, refinedTexture[index + 1] + eyeEnhancement * 0.9);
          refinedTexture[index + 2] = Math.min(255, refinedTexture[index + 2] + eyeEnhancement * 0.8);
        }
        
        // Lip area refinement (lower portion)
        if (y > height * 0.7 && y < height * 0.8 && 
            x > width * 0.3 && x < width * 0.7) {
          const lipRefinement = config.nobleExpression * 10;
          refinedTexture[index] = Math.min(255, refinedTexture[index] + lipRefinement);
          refinedTexture[index + 1] = Math.min(255, refinedTexture[index + 1] + lipRefinement * 0.7);
          refinedTexture[index + 2] = Math.min(255, refinedTexture[index + 2] + lipRefinement * 0.6);
        }
      }
    }
    
    return {
      ...baseTexture,
      data: refinedTexture
    };
  }

  /**
   * Combine all Greek texture elements
   */
  private async combineGreekTextureElements(
    skinTexture: TextureData,
    hairTexture: ClassicalHairData,
    faceMesh: FaceMeshData
  ): Promise<{ baseTexture: TextureData; normalTexture: TextureData; specularTexture: TextureData }> {
    const { width, height } = skinTexture;
    const combinedBase = new Uint8Array(skinTexture.data);
    const normalMap = new Uint8Array(width * height * 4);
    const specularMap = new Uint8Array(width * height * 4);
    
    // Generate normal and specular maps for classical appearance
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Normal map for smooth, marble-like surface
        const normalX = this.marbleNoise(x * 0.05, y * 0.05) * 0.2 + 0.5;
        const normalY = this.marbleNoise(x * 0.05 + 100, y * 0.05 + 100) * 0.2 + 0.5;
        const normalZ = 0.9; // Mostly pointing up for smooth surface
        
        normalMap[index] = Math.floor(normalX * 255);
        normalMap[index + 1] = Math.floor(normalY * 255);
        normalMap[index + 2] = Math.floor(normalZ * 255);
        normalMap[index + 3] = 255;
        
        // Specular map for marble-like reflectance
        const specularity = this.marbleNoise(x * 0.02, y * 0.02) * 0.4 + 0.6; // Higher specularity for marble
        specularMap[index] = Math.floor(specularity * 255);
        specularMap[index + 1] = Math.floor(specularity * 255);
        specularMap[index + 2] = Math.floor(specularity * 255);
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
      primaryDirection: { x: 0.3, y: -0.2, z: 0.9 },
      intensity: 0.7,
      color: { r: 1.0, g: 0.98, b: 0.95 },
      ambientLevel: 0.4
    };
  }

  /**
   * Create soft classical lighting
   */
  private async createClassicalLighting(originalLighting: any): Promise<LightingData> {
    return {
      primaryLight: {
        direction: { x: 0.4, y: -0.3, z: 0.8 }, // Soft, elevated lighting
        color: { r: 1.0, g: 0.98, b: 0.95 }, // Warm, soft white
        intensity: 0.8, // Moderate intensity for soft shadows
        type: 'directional'
      },
      ambientLight: {
        color: { r: 0.95, g: 0.96, b: 0.98 }, // Cool, temple-like ambient
        intensity: 0.5 // Higher ambient for soft, even lighting
      },
      shadows: []
    };
  }

  /**
   * Generate soft shadows for classical effect
   */
  private async generateSoftShadows(
    faceMesh: FaceMeshData, 
    lighting: LightingData
  ): Promise<ShadowData[]> {
    const shadows: ShadowData[] = [];
    
    // Generate soft, classical shadows
    const lightDir = lighting.primaryLight.direction;
    
    // Add soft shadows under features
    shadows.push({
      position: { x: 0.15, y: -0.2, z: 0 }, // Under cheekbone
      intensity: 0.3, // Soft shadow
      softness: 0.8 // Very soft edges
    });
    
    shadows.push({
      position: { x: -0.15, y: -0.2, z: 0 }, // Under other cheekbone
      intensity: 0.3,
      softness: 0.8
    });
    
    shadows.push({
      position: { x: 0, y: -0.4, z: 0 }, // Under jaw
      intensity: 0.4,
      softness: 0.7
    });
    
    // Soft nose shadow
    shadows.push({
      position: { x: 0.05, y: 0.1, z: 0 }, // Side of nose
      intensity: 0.2,
      softness: 0.9
    });
    
    return shadows;
  }

  /**
   * Create classical temple-like atmospheric effects
   */
  private async createClassicalAtmosphere(): Promise<AtmosphericData> {
    return {
      particles: [
        {
          type: 'dust',
          density: 0.1,
          color: { r: 0.9, g: 0.9, b: 0.85 },
          motion: { x: 0.02, y: 0.01, z: 0 }
        }
      ],
      mist: {
        density: 0.05,
        color: { r: 0.95, g: 0.96, b: 0.98 },
        height: 0.2
      },
      colorGrading: {
        shadows: { r: 0.9, g: 0.92, b: 0.95 }, // Cool shadows
        midtones: { r: 1.0, g: 0.98, b: 0.96 }, // Neutral midtones
        highlights: { r: 1.05, g: 1.02, b: 0.98 }, // Warm highlights
        saturation: 0.9, // Slightly desaturated for classical look
        contrast: 0.8 // Lower contrast for soft appearance
      }
    };
  }

  /**
   * Get Greek configuration based on processing options
   */
  private getGreekConfig(options: ProcessingOptions): GreekStyleConfig {
    const baseConfig = { ...this.defaultConfig };
    
    // Adjust config based on style intensity
    const intensity = options.styleIntensity;
    baseConfig.classicalProportions *= intensity;
    baseConfig.marbleSmoothing *= intensity;
    baseConfig.nobleExpression *= intensity;
    baseConfig.classicalHairStyling *= intensity;
    
    // Adjust based on quality setting
    if (options.quality === 'fast') {
      baseConfig.goldenRatioAdjustment = false; // Skip complex calculations for speed
      baseConfig.marbleTexture = false; // Use simpler textures
    } else if (options.quality === 'high') {
      baseConfig.classicalProportions *= 1.2; // More precise proportions
      baseConfig.marbleSmoothing *= 1.3; // More detailed marble texture
    }
    
    return baseConfig;
  }

  /**
   * Marble noise function for texture generation
   */
  private marbleNoise(x: number, y: number): number {
    // Simplified marble noise - creates smooth, flowing patterns
    const noise1 = Math.sin(x * 0.1) * Math.cos(y * 0.1);
    const noise2 = Math.sin(x * 0.05 + y * 0.05) * 0.5;
    const noise3 = Math.sin(x * 0.02) * Math.cos(y * 0.03) * 0.3;
    return (noise1 + noise2 + noise3) * 0.5;
  }

  /**
   * Classical curl noise for hair texture
   */
  private classicalCurlNoise(x: number, y: number): number {
    // Creates spiral, curl-like patterns
    const angle = Math.atan2(y - 128, x - 128);
    const radius = Math.sqrt((x - 128) ** 2 + (y - 128) ** 2);
    return Math.sin(angle * 3 + radius * 0.1) * Math.cos(radius * 0.05);
  }

  /**
   * Classical braid noise for hair texture
   */
  private classicalBraidNoise(x: number, y: number): number {
    // Creates interwoven, braid-like patterns
    const pattern1 = Math.sin(x * 0.2 + y * 0.1);
    const pattern2 = Math.sin(x * 0.1 + y * 0.2 + Math.PI / 3);
    const pattern3 = Math.sin(x * 0.15 + y * 0.15 + Math.PI * 2 / 3);
    return (pattern1 + pattern2 + pattern3) / 3;
  }
}