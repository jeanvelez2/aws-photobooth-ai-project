export interface FacialLandmark {
  type: 'eyeLeft' | 'eyeRight' | 'nose' | 'mouthLeft' | 'mouthRight' | 'chinBottom' | 'leftEyeBrowLeft' | 'leftEyeBrowRight' | 'leftEyeBrowUp' | 'rightEyeBrowLeft' | 'rightEyeBrowRight' | 'rightEyeBrowUp' | 'leftEyeLeft' | 'leftEyeRight' | 'leftEyeUp' | 'leftEyeDown' | 'rightEyeLeft' | 'rightEyeRight' | 'rightEyeUp' | 'rightEyeDown' | 'noseLeft' | 'noseRight' | 'mouthUp' | 'mouthDown' | 'leftPupil' | 'rightPupil' | 'upperJawlineLeft' | 'midJawlineLeft' | 'chinBottom' | 'midJawlineRight' | 'upperJawlineRight';
  x: number;
  y: number;
}

export interface FaceDetectionResult {
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  confidence: number;
  landmarks: FacialLandmark[];
  quality: {
    brightness: number;
    sharpness: number;
    pose: {
      roll: number;
      yaw: number;
      pitch: number;
    };
  };
}

export interface QualityMetrics {
  brightness: number;
  sharpness: number;
  pose: {
    roll: number;
    yaw: number;
    pitch: number;
  };
}

export interface AlignedFace {
  imageBuffer: Buffer;
  landmarks: FacialLandmark[];
  transform: {
    scale: number;
    rotation: number;
    translation: {
      x: number;
      y: number;
    };
  };
}