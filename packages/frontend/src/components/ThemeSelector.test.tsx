import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ThemeSelector from './ThemeSelector';
import { AppProvider } from '../contexts/AppContext';
import { mockThemes } from '../data/mockThemes';

// Mock component wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AppProvider>
      {children}
    </AppProvider>
  </BrowserRouter>
);

describe('ThemeSelector', () => {
  const mockOnThemeSelect = vi.fn();
  const mockOnVariantSelect = vi.fn();

  const defaultProps = {
    themes: mockThemes,
    selectedTheme: null,
    selectedVariant: null,
    onThemeSelect: mockOnThemeSelect,
    onVariantSelect: mockOnVariantSelect,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders theme gallery with all themes', () => {
    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Choose Your Theme')).toBeInTheDocument();
    expect(screen.getAllByText('Barbarian')).toHaveLength(2); // Title and thumbnail
    expect(screen.getAllByText('Greek')).toHaveLength(2);
    expect(screen.getAllByText('Mystic')).toHaveLength(2);
    expect(screen.getAllByText('Anime')).toHaveLength(2);
  });

  it('displays theme descriptions', () => {
    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Fierce warrior from ancient times/)).toBeInTheDocument();
    expect(screen.getByText(/Classical Greek mythology style/)).toBeInTheDocument();
    expect(screen.getByText(/Magical and mysterious atmosphere/)).toBeInTheDocument();
    expect(screen.getByText(/Japanese animation style/)).toBeInTheDocument();
  });

  it('shows variant count for themes with variants', () => {
    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} />
      </TestWrapper>
    );

    // Check that variant counts are displayed
    expect(screen.getAllByText(/\d+ variants?/)).toHaveLength(4);
  });

  it('calls onThemeSelect when theme card is clicked', () => {
    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} />
      </TestWrapper>
    );

    const themeCards = screen.getAllByText('Select Theme');
    fireEvent.click(themeCards[0]);

    expect(mockOnThemeSelect).toHaveBeenCalledWith(mockThemes[0]);
  });

  it('shows selected theme with visual indicator', () => {
    const selectedTheme = mockThemes[0]; // Barbarian
    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} selectedTheme={selectedTheme} />
      </TestWrapper>
    );

    expect(screen.getByText('Selected')).toBeInTheDocument();
  });

  it('displays theme variants when theme is selected', () => {
    const selectedTheme = mockThemes[0]; // Barbarian with variants
    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} selectedTheme={selectedTheme} />
      </TestWrapper>
    );

    expect(screen.getByText('Barbarian Variants')).toBeInTheDocument();
    expect(screen.getByText('Warrior')).toBeInTheDocument();
    expect(screen.getByText('Berserker')).toBeInTheDocument();
    expect(screen.getByText('Chieftain')).toBeInTheDocument();
  });

  it('calls onVariantSelect when variant is clicked', () => {
    const selectedTheme = mockThemes[0]; // Barbarian
    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} selectedTheme={selectedTheme} />
      </TestWrapper>
    );

    const warriorVariant = screen.getByText('Warrior').closest('div');
    fireEvent.click(warriorVariant!);

    expect(mockOnVariantSelect).toHaveBeenCalledWith(selectedTheme.variants[0]);
  });

  it('shows preview toggle button when showPreview is true and photo is available', () => {
    render(
      <TestWrapper>
        <ThemeSelector 
          {...defaultProps} 
          selectedTheme={mockThemes[0]}
          showPreview={true}
          capturedPhotoUrl="data:image/jpeg;base64,test"
        />
      </TestWrapper>
    );

    expect(screen.getByText('Show Preview')).toBeInTheDocument();
  });

  it('toggles preview mode when preview button is clicked', () => {
    render(
      <TestWrapper>
        <ThemeSelector 
          {...defaultProps} 
          selectedTheme={mockThemes[0]}
          showPreview={true}
          capturedPhotoUrl="data:image/jpeg;base64,test"
        />
      </TestWrapper>
    );

    const previewButton = screen.getByText('Show Preview');
    fireEvent.click(previewButton);

    expect(screen.getByText('Hide Preview')).toBeInTheDocument();
    expect(screen.getByText('Theme Preview')).toBeInTheDocument();
  });

  it('auto-selects first variant when theme is selected', () => {
    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} />
      </TestWrapper>
    );

    const themeCards = screen.getAllByText('Select Theme');
    fireEvent.click(themeCards[0]);

    expect(mockOnThemeSelect).toHaveBeenCalledWith(mockThemes[0]);
    expect(mockOnVariantSelect).toHaveBeenCalledWith(mockThemes[0].variants[0]);
  });

  it('handles themes without variants gracefully', () => {
    const themesWithoutVariants = mockThemes.map(theme => ({
      ...theme,
      variants: []
    }));

    render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} themes={themesWithoutVariants} />
      </TestWrapper>
    );

    expect(screen.queryByText(/Variants$/)).not.toBeInTheDocument();
  });

  it('displays responsive grid layout classes', () => {
    const { container } = render(
      <TestWrapper>
        <ThemeSelector {...defaultProps} />
      </TestWrapper>
    );

    const gridElement = container.querySelector('.grid');
    expect(gridElement).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');
  });
});