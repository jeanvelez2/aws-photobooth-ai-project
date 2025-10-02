import React, { useState, useEffect } from 'react';

interface ProgressiveImageProps {
  src: string;
  placeholderSrc?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
  quality?: 'low' | 'medium' | 'high';
}

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  placeholderSrc,
  alt,
  className = '',
  width,
  height,
  onLoad,
  quality = 'high'
}) => {
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');
  const [isLoading, setIsLoading] = useState(true);
  const [loadedSources, setLoadedSources] = useState<Set<string>>(new Set());

  // Generate different quality versions of the image
  const getImageSources = (originalSrc: string) => {
    const sources = [];
    
    // Add low quality version (for quick loading)
    if (quality === 'high' || quality === 'medium') {
      sources.push({
        src: originalSrc.replace(/\.(jpg|jpeg|png)$/i, '_low.$1'),
        quality: 'low'
      });
    }
    
    // Add medium quality version
    if (quality === 'high') {
      sources.push({
        src: originalSrc.replace(/\.(jpg|jpeg|png)$/i, '_medium.$1'),
        quality: 'medium'
      });
    }
    
    // Add original high quality version
    sources.push({
      src: originalSrc,
      quality: 'high'
    });
    
    return sources;
  };

  useEffect(() => {
    const sources = getImageSources(src);
    let currentIndex = 0;

    const loadNextImage = () => {
      if (currentIndex >= sources.length) {
        setIsLoading(false);
        onLoad?.();
        return;
      }

      const source = sources[currentIndex];
      const img = new Image();
      
      img.onload = () => {
        if (source) {
          setLoadedSources(prev => new Set([...prev, source.src]));
          setCurrentSrc(source.src);
        }
        
        // Continue loading higher quality versions
        currentIndex++;
        if (currentIndex < sources.length) {
          // Small delay to avoid overwhelming the browser
          setTimeout(loadNextImage, 100);
        } else {
          setIsLoading(false);
          onLoad?.();
        }
      };

      img.onerror = () => {
        // Skip this quality level and try the next one
        currentIndex++;
        loadNextImage();
      };

      if (source) {
        img.src = source.src;
      }
    };

    // Start with placeholder if available
    if (placeholderSrc && !loadedSources.has(placeholderSrc)) {
      setCurrentSrc(placeholderSrc);
    }

    loadNextImage();
  }, [src, placeholderSrc, quality, onLoad]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center z-10">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Progressive image */}
      <img
        src={currentSrc}
        alt={alt}
        width={width}
        height={height}
        className={`
          transition-all duration-500 ease-out
          ${isLoading ? 'opacity-70 scale-105 blur-sm' : 'opacity-100 scale-100 blur-0'}
          ${className}
        `}
        style={{
          objectFit: 'cover',
          width: '100%',
          height: '100%'
        }}
      />

      {/* Quality indicator (development only) */}
      {process.env.NODE_ENV === 'development' && currentSrc && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          {getQualityFromSrc(currentSrc)}
        </div>
      )}
    </div>
  );
};

function getQualityFromSrc(src: string): string {
  if (src.includes('_low.')) return 'Low';
  if (src.includes('_medium.')) return 'Med';
  return 'High';
}

export default ProgressiveImage;