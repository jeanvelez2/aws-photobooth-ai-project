import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { Theme, ThemeVariant } from '../types';
import ThemeSelector from '../components/ThemeSelector';
import { mockThemes } from '../data/mockThemes';

export default function ThemeSelectionPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(state.app.selectedTheme);
  const [selectedVariant, setSelectedVariant] = useState<ThemeVariant | null>(null);

  React.useEffect(() => {
    // Set current step when component mounts
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'theme-selection' });
  }, [dispatch]);

  const handleThemeSelect = (theme: Theme) => {
    setSelectedTheme(theme);
    // Reset variant selection when theme changes
    setSelectedVariant(null);
    
    // Update global state
    dispatch({ 
      type: 'SET_THEME', 
      payload: theme
    });
  };

  const handleVariantSelect = (variant: ThemeVariant) => {
    setSelectedVariant(variant);
    
    // Update global state
    dispatch({ 
      type: 'SET_VARIANT', 
      payload: variant
    });
  };

  const handleContinue = () => {
    if (selectedTheme) {
      // If a variant is selected, we could store it in context for later use
      // For now, we'll proceed with the theme selection
      navigate('/process');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const canContinue = selectedTheme !== null;
  const showPreview = state.app.currentPhoto !== null;
  const capturedPhotoUrl = state.app.currentPhoto?.dataUrl;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your Theme
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Select a theme that matches your style. Your face will be seamlessly integrated 
          into the chosen background using AI technology.
        </p>
      </div>

      {/* Theme Selector Component */}
      <ThemeSelector
        themes={mockThemes}
        selectedTheme={selectedTheme}
        selectedVariant={selectedVariant}
        onThemeSelect={handleThemeSelect}
        onVariantSelect={handleVariantSelect}
        showPreview={showPreview}
        capturedPhotoUrl={capturedPhotoUrl}
      />

      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-12 pt-8 border-t">
        <button
          onClick={handleBack}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Camera
        </button>
        
        <div className="flex items-center space-x-4">
          {/* Selection Summary */}
          {selectedTheme && (
            <div className="text-sm text-gray-600">
              Selected: <span className="font-medium text-gray-900">{selectedTheme.name}</span>
              {selectedVariant && (
                <span> - <span className="font-medium text-purple-600">{selectedVariant.name}</span></span>
              )}
            </div>
          )}
          
          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={`px-8 py-3 rounded-lg font-medium transition-colors flex items-center ${
              canContinue
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue to Processing
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          {!selectedTheme 
            ? 'Select a theme to continue' 
            : selectedTheme.variants.length > 0 && !selectedVariant
            ? 'Optional: Choose a variant for more customization'
            : 'Ready to process your image!'
          }
        </p>
      </div>
    </div>
  );
}