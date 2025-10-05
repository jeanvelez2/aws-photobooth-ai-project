import React, { useState } from 'react';
import { Theme, ThemeVariant } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface ThemeSelectorProps {
  themes: Theme[];
  selectedTheme?: Theme | null;
  selectedVariant?: ThemeVariant | null;
  onThemeSelect: (theme: Theme) => void;
  onVariantSelect: (variant: ThemeVariant) => void;
  showPreview?: boolean;
  capturedPhotoUrl?: string | undefined;
}

export default function ThemeSelector({
  themes,
  selectedTheme,
  selectedVariant,
  onThemeSelect,
  onVariantSelect,
  showPreview = false,
  capturedPhotoUrl
}: ThemeSelectorProps) {
  const [previewMode, setPreviewMode] = useState(false);
  const { state } = useAppContext();

  const handleThemeClick = (theme: Theme) => {
    onThemeSelect(theme);
    // Auto-select first variant if available
    if (theme.variants.length > 0 && theme.variants[0]) {
      onVariantSelect(theme.variants[0]);
    }
  };

  const handleVariantClick = (variant: ThemeVariant) => {
    onVariantSelect(variant);
  };

  const togglePreview = () => {
    setPreviewMode(!previewMode);
  };

  return (
    <div className="w-full">
      {/* Theme Gallery Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Choose Your Theme</h2>
          <p className="text-gray-600 mt-1">
            Select a theme and variant that matches your style
          </p>
        </div>
        
        {showPreview && capturedPhotoUrl && selectedTheme && (
          <button
            onClick={togglePreview}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            {previewMode ? 'Hide Preview' : 'Show Preview'}
          </button>
        )}
      </div>

      {/* Preview Overlay */}
      {previewMode && showPreview && capturedPhotoUrl && selectedTheme && (
        <div className="mb-8 bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Theme Preview</h3>
          <div className="relative max-w-md mx-auto">
            <div className="aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden relative">
              {/* Background theme template */}
              {selectedVariant?.templateUrl || selectedTheme.templateUrl ? (
                <img 
                  src={selectedVariant?.templateUrl || selectedTheme.templateUrl} 
                  alt={`${selectedTheme.name} template`}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                  <span className="text-gray-600 font-medium">
                    {selectedTheme.name} Preview
                  </span>
                </div>
              )}
              
              {/* Overlay captured photo with mask */}
              {selectedVariant?.faceRegion && (
                <div 
                  className="absolute bg-white border-2 border-white shadow-lg overflow-hidden"
                  style={{
                    left: `${selectedVariant.faceRegion.x}%`,
                    top: `${selectedVariant.faceRegion.y}%`,
                    width: `${selectedVariant.faceRegion.width}%`,
                    height: `${selectedVariant.faceRegion.height}%`,
                    transform: `rotate(${selectedVariant.faceRegion.rotation}deg)`
                  }}
                >
                  <img 
                    src={capturedPhotoUrl} 
                    alt="Captured face"
                    className="w-full h-full object-cover"
                  />
                  {selectedVariant.blendingMask && (
                    <img 
                      src={selectedVariant.blendingMask} 
                      alt="Blending mask"
                      className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-50"
                    />
                  )}
                </div>
              )}
              
              {/* Preview info */}
              <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded">
                <p className="text-sm font-medium">{selectedTheme.name}</p>
                {selectedVariant && (
                  <p className="text-xs opacity-90">{selectedVariant.name}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className={`bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer transition-all duration-200 ${
              selectedTheme?.id === theme.id
                ? 'ring-2 ring-purple-500 shadow-xl scale-105'
                : 'hover:shadow-xl hover:scale-102'
            }`}
            onClick={() => handleThemeClick(theme)}
          >
            {/* Theme Thumbnail */}
            <div className="aspect-[3/4] bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center relative overflow-hidden">
              {theme.thumbnailUrl ? (
                <img 
                  src={theme.thumbnailUrl} 
                  alt={`${theme.name} theme`}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              {/* Fallback overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100 ${theme.thumbnailUrl ? 'opacity-20' : 'opacity-80'}`}></div>
              <div className="relative text-center z-10">
                <div className="w-16 h-16 bg-white rounded-full mx-auto mb-3 flex items-center justify-center shadow-md">
                  <span className="text-2xl font-bold text-gray-600">
                    {theme.name.charAt(0)}
                  </span>
                </div>
                <p className="text-gray-700 font-medium">{theme.name}</p>
              </div>
              
              {/* Selection indicator */}
              {selectedTheme?.id === theme.id && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* Theme Info */}
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {theme.name}
              </h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {theme.description}
              </p>
              
              {/* Variant count indicator */}
              {theme.variants.length > 0 && (
                <div className="flex items-center text-xs text-purple-600 mb-3">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  {theme.variants.length} variant{theme.variants.length !== 1 ? 's' : ''}
                </div>
              )}
              
              <button className={`w-full py-2 px-4 rounded-md transition-colors font-medium ${
                selectedTheme?.id === theme.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-purple-50 hover:text-purple-700'
              }`}>
                {selectedTheme?.id === theme.id ? 'Selected' : 'Select Theme'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Theme Variants Section */}
      {selectedTheme && selectedTheme.variants.length > 0 && (
        <div className="border-t pt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            {selectedTheme.name} Variants
          </h3>
          <p className="text-gray-600 mb-6">
            Choose a specific style variation for your {selectedTheme.name.toLowerCase()} theme
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {selectedTheme.variants.map((variant) => (
              <div
                key={variant.id}
                className={`bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-all duration-200 ${
                  selectedVariant?.id === variant.id
                    ? 'ring-2 ring-purple-500 shadow-lg scale-105'
                    : 'hover:shadow-lg hover:scale-102'
                }`}
                onClick={() => handleVariantClick(variant)}
              >
                {/* Variant Thumbnail */}
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
                  {variant.thumbnailUrl ? (
                    <img 
                      src={variant.thumbnailUrl} 
                      alt={`${variant.name} variant`}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className={`text-center relative z-10 ${variant.thumbnailUrl ? 'bg-black bg-opacity-30 rounded p-1' : ''}`}>
                    <div className="w-8 h-8 bg-white rounded-full mx-auto mb-1 flex items-center justify-center shadow-sm">
                      <span className="text-sm font-bold text-gray-600">
                        {variant.name.charAt(0)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Selection indicator */}
                  {selectedVariant?.id === variant.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Variant Info */}
                <div className="p-2">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {variant.name}
                  </h4>
                  {variant.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {variant.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}