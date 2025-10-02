import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ThemeSelectionPage from './ThemeSelectionPage';
import { AppProvider } from '../contexts/AppContext';
import type { Theme, ThemeVariant } from '../types';

// Mock the ThemeSelector component
vi.mock('../components/ThemeSelector', () => ({
  default: ({ 
    themes, 
    selectedTheme, 
    selectedVariant, 
    onThemeSelect, 
    onVariantSelect 
  }: {
    themes: Theme[];
    selectedTheme: Theme | null;
    selectedVariant: ThemeVariant | null;
    onThemeSelect: (theme: Theme) => void;
    onVariantSelect: (variant: ThemeVariant) => void;
  }) => (
    <div data-testid="theme-selector">
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => onThemeSelect(theme)}
          data-testid={`theme-${theme.id}`}
          className={selectedTheme?.id === theme.id ? 'selected' : ''}
        >
          {theme.name}
        </button>
      ))}
      {selectedTheme?.variants.map((variant) => (
        <button
          key={variant.id}
          onClick={() => onVariantSelect(variant)}
          data-testid={`variant-${variant.id}`}
          className={selectedVariant?.id === variant.id ? 'selected' : ''}
        >
          {variant.name}
        </button>
      ))}
    </div>
  )
}));

// Mock the mock themes data
vi.mock('../data/mockThemes', () => ({
  mockThemes: [
    {
      id: 'barbarian',
      name: 'Barbarian Warrior',
      description: 'Fierce warrior theme',
      thumbnailUrl: '/themes/barbarian/thumbnail.jpg',
      templateUrl: '/themes/barbarian/template.jpg',
      variants: [
        { id: 'barbarian-1', name: 'Classic', templateUrl: '/themes/barbarian/variant1.jpg' },
        { id: 'barbarian-2', name: 'Battle Ready', templateUrl: '/themes/barbarian/variant2.jpg' }
      ]
    },
    {
      id: 'greek',
      name: 'Greek God',
      description: 'Ancient Greek mythology theme',
      thumbnailUrl: '/themes/greek/thumbnail.jpg',
      templateUrl: '/themes/greek/template.jpg',
      variants: []
    }
  ]
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AppProvider>
        {component}
      </AppProvider>
    </BrowserRouter>
  );
};

describe('ThemeSelectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders theme selection page with title and instructions', () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    expect(screen.getByText('Choose Your Theme')).toBeInTheDocument();
    expect(screen.getByText(/Select a theme that matches your style/)).toBeInTheDocument();
    expect(screen.getByText(/Your face will be seamlessly integrated/)).toBeInTheDocument();
  });

  it('renders theme selector component', () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument();
  });

  it('renders available themes', () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    expect(screen.getByTestId('theme-barbarian')).toBeInTheDocument();
    expect(screen.getByTestId('theme-greek')).toBeInTheDocument();
    expect(screen.getByText('Barbarian Warrior')).toBeInTheDocument();
    expect(screen.getByText('Greek God')).toBeInTheDocument();
  });

  it('renders back button', () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    expect(screen.getByText('Back to Camera')).toBeInTheDocument();
  });

  it('initially shows continue button as disabled', () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    const continueButton = screen.getByText('Continue to Processing');
    expect(continueButton).toBeInTheDocument();
    expect(continueButton).toBeDisabled();
  });

  it('shows help text when no theme is selected', () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    expect(screen.getByText('Select a theme to continue')).toBeInTheDocument();
  });

  it('enables continue button after selecting a theme', async () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    const barbarianTheme = screen.getByTestId('theme-barbarian');
    fireEvent.click(barbarianTheme);

    await waitFor(() => {
      const continueButton = screen.getByText('Continue to Processing');
      expect(continueButton).not.toBeDisabled();
    });
  });

  it('shows selected theme in summary', async () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    const barbarianTheme = screen.getByTestId('theme-barbarian');
    fireEvent.click(barbarianTheme);

    await waitFor(() => {
      expect(screen.getByText('Selected:')).toBeInTheDocument();
      expect(screen.getAllByText('Barbarian Warrior')).toHaveLength(2); // Button and summary
    });
  });

  it('shows theme variants when theme with variants is selected', async () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    const barbarianTheme = screen.getByTestId('theme-barbarian');
    fireEvent.click(barbarianTheme);

    await waitFor(() => {
      expect(screen.getByTestId('variant-barbarian-1')).toBeInTheDocument();
      expect(screen.getByTestId('variant-barbarian-2')).toBeInTheDocument();
      expect(screen.getByText('Classic')).toBeInTheDocument();
      expect(screen.getByText('Battle Ready')).toBeInTheDocument();
    });
  });

  it('shows variant selection in summary', async () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    // Select theme first
    const barbarianTheme = screen.getByTestId('theme-barbarian');
    fireEvent.click(barbarianTheme);

    await waitFor(() => {
      expect(screen.getByTestId('variant-barbarian-1')).toBeInTheDocument();
    });

    // Select variant
    const variant = screen.getByTestId('variant-barbarian-1');
    fireEvent.click(variant);

    await waitFor(() => {
      expect(screen.getByText('Selected:')).toBeInTheDocument();
      expect(screen.getAllByText('Barbarian Warrior')).toHaveLength(2); // Button and summary
      expect(screen.getAllByText('Classic')).toHaveLength(2); // Button and summary
    });
  });

  it('updates help text when theme with variants is selected', async () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    const barbarianTheme = screen.getByTestId('theme-barbarian');
    fireEvent.click(barbarianTheme);

    await waitFor(() => {
      expect(screen.getByText('Optional: Choose a variant for more customization')).toBeInTheDocument();
    });
  });

  it('updates help text when variant is selected', async () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    // Select theme first
    const barbarianTheme = screen.getByTestId('theme-barbarian');
    fireEvent.click(barbarianTheme);

    await waitFor(() => {
      expect(screen.getByTestId('variant-barbarian-1')).toBeInTheDocument();
    });

    // Select variant
    const variant = screen.getByTestId('variant-barbarian-1');
    fireEvent.click(variant);

    await waitFor(() => {
      expect(screen.getByText('Ready to process your image!')).toBeInTheDocument();
    });
  });

  it('navigates back to camera when back button is clicked', () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    const backButton = screen.getByText('Back to Camera');
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to processing when continue is clicked with selected theme', async () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    // Select theme first
    const barbarianTheme = screen.getByTestId('theme-barbarian');
    fireEvent.click(barbarianTheme);

    await waitFor(() => {
      const continueButton = screen.getByText('Continue to Processing');
      expect(continueButton).not.toBeDisabled();
    });

    // Click continue
    const continueButton = screen.getByText('Continue to Processing');
    fireEvent.click(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith('/process');
  });

  it('resets variant selection when theme changes', async () => {
    renderWithProviders(<ThemeSelectionPage />);
    
    // Select barbarian theme and variant
    const barbarianTheme = screen.getByTestId('theme-barbarian');
    fireEvent.click(barbarianTheme);

    await waitFor(() => {
      expect(screen.getByTestId('variant-barbarian-1')).toBeInTheDocument();
    });

    const variant = screen.getByTestId('variant-barbarian-1');
    fireEvent.click(variant);

    await waitFor(() => {
      expect(screen.getAllByText('Classic')).toHaveLength(2); // Button and summary
    });

    // Switch to greek theme (no variants)
    const greekTheme = screen.getByTestId('theme-greek');
    fireEvent.click(greekTheme);

    await waitFor(() => {
      expect(screen.getByText('Greek God')).toBeInTheDocument();
      expect(screen.queryByText('Classic')).not.toBeInTheDocument();
    });
  });
});