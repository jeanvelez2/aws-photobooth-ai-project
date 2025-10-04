import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import type { Theme, ProcessingRequest, ProcessingResult } from '../types';

// API base URL configuration
const getApiBaseUrl = () => {
  // In production, use the environment variable or construct from current location
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.host}/api`;
  }
  // In development, use environment variable or localhost
  return import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

// API client utility
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getThemes(): Promise<Theme[]> {
    return this.request<Theme[]>('/themes');
  }

  async getProcessingStatus(id: string): Promise<ProcessingResult> {
    return this.request<ProcessingResult>(`/process/${id}`);
  }

  async startProcessing(request: ProcessingRequest): Promise<ProcessingResult> {
    return this.request<ProcessingResult>('/process', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getPresignedUrl(fileName: string, fileType: string): Promise<{ uploadUrl: string; fileUrl: string }> {
    return this.request<{ uploadUrl: string; fileUrl: string }>('/upload/presigned', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType }),
    });
  }

  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

const apiClient = new ApiClient(API_BASE_URL);

// Custom hooks for API operations

export function useThemes() {
  return useQuery({
    queryKey: queryKeys.themes,
    // For now, return mock data since backend isn't implemented yet
    queryFn: () => Promise.resolve([
      {
        id: 'barbarian',
        name: 'Barbarian',
        description: 'Fierce warrior from ancient times',
        thumbnailUrl: '/themes/barbarian-thumb.jpg',
        templateUrl: '/themes/barbarian-template.jpg',
        variants: [],
      },
      {
        id: 'greek',
        name: 'Greek',
        description: 'Classical Greek mythology style',
        thumbnailUrl: '/themes/greek-thumb.jpg',
        templateUrl: '/themes/greek-template.jpg',
        variants: [],
      },
      {
        id: 'mystic',
        name: 'Mystic',
        description: 'Magical and mysterious atmosphere',
        thumbnailUrl: '/themes/mystic-thumb.jpg',
        templateUrl: '/themes/mystic-template.jpg',
        variants: [],
      },
      {
        id: 'anime',
        name: 'Anime',
        description: 'Japanese animation style',
        thumbnailUrl: '/themes/anime-thumb.jpg',
        templateUrl: '/themes/anime-template.jpg',
        variants: [],
      },
    ] as Theme[]),
  });
}

export function useProcessingStatus(id: string | null) {
  return useQuery({
    queryKey: queryKeys.processing(id || ''),
    queryFn: () => apiClient.getProcessingStatus(id!),
    enabled: !!id,
    // Poll every 2 seconds while processing
    refetchInterval: (query) => {
      if (query.state.data?.status === 'processing') {
        return 2000;
      }
      return false;
    },
  });
}

export function useStartProcessing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ProcessingRequest) => apiClient.startProcessing(request),
    onSuccess: (data) => {
      // Update the processing status cache
      queryClient.setQueryData(queryKeys.processing(data.id), data);
    },
  });
}

export function usePresignedUrl() {
  return useMutation({
    mutationFn: ({ fileName, fileType }: { fileName: string; fileType: string }) =>
      apiClient.getPresignedUrl(fileName, fileType),
  });
}

export function useHealthCheck() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.checkHealth(),
    // Check health every 30 seconds
    refetchInterval: 30000,
    // Don't retry health checks as aggressively
    retry: 1,
  });
}

// Note: Image upload functionality has been moved to useImageUpload hook
// This provides better separation of concerns and more advanced features