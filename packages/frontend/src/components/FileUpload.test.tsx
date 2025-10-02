import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from './FileUpload';
import * as useImageUploadModule from '../hooks/useImageUpload';

// Mock the useImageUpload hook
vi.mock('../hooks/useImageUpload');

describe('FileUpload', () => {
  const mockUseImageUpload = useImageUploadModule.useImageUpload as any;
  const mockUploadFile = vi.fn();
  const mockCancelUpload = vi.fn();
  const mockResetUpload = vi.fn();
  const mockOnUploadComplete = vi.fn();
  const mockOnUploadError = vi.fn();

  const defaultUploadState = {
    isUploading: false,
    progress: null,
    error: null,
    result: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseImageUpload.mockReturnValue({
      uploadState: defaultUploadState,
      uploadFile: mockUploadFile,
      cancelUpload: mockCancelUpload,
      resetUpload: mockResetUpload,
    });
  });

  it('should render default upload interface', () => {
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByText('Drop files here or click to browse')).toBeInTheDocument();
    expect(screen.getByText(/Upload an image file/)).toBeInTheDocument();
  });

  it('should render custom children when provided', () => {
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      >
        <div>Custom upload content</div>
      </FileUpload>
    );

    expect(screen.getByText('Custom upload content')).toBeInTheDocument();
    expect(screen.queryByText('Drop files here or click to browse')).not.toBeInTheDocument();
  });

  it('should handle file selection via input', async () => {
    const user = userEvent.setup();
    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    
    mockUploadFile.mockResolvedValue({
      success: true,
      fileUrl: 'https://example.com/test.jpg',
      uploadId: 'upload123',
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const fileInput = screen.getByLabelText('File upload input');
    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(mockFile);
    });

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith('https://example.com/test.jpg', mockFile);
    });
  });

  it('should handle drag and drop', async () => {
    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    
    mockUploadFile.mockResolvedValue({
      success: true,
      fileUrl: 'https://example.com/test.jpg',
      uploadId: 'upload123',
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const dropZone = screen.getByText('Drop files here or click to browse').closest('div');
    
    // Simulate drag over
    fireEvent.dragOver(dropZone!, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Simulate drop
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(mockFile);
    });

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith('https://example.com/test.jpg', mockFile);
    });
  });

  it('should show drag over state', () => {
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const dropZone = screen.getByText('Drop files here or click to browse').closest('div');
    
    fireEvent.dragOver(dropZone!);
    
    expect(dropZone).toHaveClass('border-purple-500', 'bg-purple-50');
  });

  it('should handle upload errors', async () => {
    const user = userEvent.setup();
    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    
    mockUploadFile.mockResolvedValue({
      success: false,
      error: 'Upload failed',
      uploadId: 'upload123',
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const fileInput = screen.getByLabelText('File upload input');
    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith('Upload failed');
    });
  });

  it('should validate file types', async () => {
    const user = userEvent.setup();
    const invalidFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const fileInput = screen.getByLabelText('File upload input');
    await user.upload(fileInput, invalidFile);

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid file type')
      );
    });

    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('should validate file size', async () => {
    const user = userEvent.setup();
    // Create a large file (mock the size property)
    const largeFile = new File(['test content'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 }); // 11MB

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const fileInput = screen.getByLabelText('File upload input');
    await user.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith(
        expect.stringContaining('File size exceeds')
      );
    });

    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('should handle multiple files when enabled', async () => {
    const user = userEvent.setup();
    const file1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });
    
    mockUploadFile
      .mockResolvedValueOnce({
        success: true,
        fileUrl: 'https://example.com/test1.jpg',
        uploadId: 'upload1',
      })
      .mockResolvedValueOnce({
        success: true,
        fileUrl: 'https://example.com/test2.jpg',
        uploadId: 'upload2',
      });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
        multiple={true}
        maxFiles={2}
      />
    );

    const fileInput = screen.getByLabelText('File upload input');
    await user.upload(fileInput, [file1, file2]);

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith('https://example.com/test1.jpg', file1);
      expect(mockOnUploadComplete).toHaveBeenCalledWith('https://example.com/test2.jpg', file2);
    });
  });

  it('should enforce max files limit', async () => {
    const user = userEvent.setup();
    const file1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });
    const file3 = new File(['content3'], 'test3.jpg', { type: 'image/jpeg' });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
        multiple={true}
        maxFiles={2}
      />
    );

    const fileInput = screen.getByLabelText('File upload input');
    await user.upload(fileInput, [file1, file2, file3]);

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith('Maximum 2 file(s) allowed');
    });

    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('should show upload progress', () => {
    mockUseImageUpload.mockReturnValue({
      uploadState: {
        isUploading: true,
        progress: { loaded: 50, total: 100, percentage: 50 },
        error: null,
        result: null,
      },
      uploadFile: mockUploadFile,
      cancelUpload: mockCancelUpload,
      resetUpload: mockResetUpload,
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByText('Uploading... 50%')).toBeInTheDocument();
    
    const progressBar = screen.getByRole('progressbar', { hidden: true });
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('should allow canceling upload', async () => {
    const user = userEvent.setup();
    
    mockUseImageUpload.mockReturnValue({
      uploadState: {
        isUploading: true,
        progress: { loaded: 50, total: 100, percentage: 50 },
        error: null,
        result: null,
      },
      uploadFile: mockUploadFile,
      cancelUpload: mockCancelUpload,
      resetUpload: mockResetUpload,
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockCancelUpload).toHaveBeenCalled();
  });

  it('should show upload error', () => {
    mockUseImageUpload.mockReturnValue({
      uploadState: {
        isUploading: false,
        progress: null,
        error: 'Upload failed',
        result: null,
      },
      uploadFile: mockUploadFile,
      cancelUpload: mockCancelUpload,
      resetUpload: mockResetUpload,
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByText('Upload failed')).toBeInTheDocument();
  });

  it('should allow dismissing error', async () => {
    const user = userEvent.setup();
    
    mockUseImageUpload.mockReturnValue({
      uploadState: {
        isUploading: false,
        progress: null,
        error: 'Upload failed',
        result: null,
      },
      uploadFile: mockUploadFile,
      cancelUpload: mockCancelUpload,
      resetUpload: mockResetUpload,
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const dismissButton = screen.getByText('Dismiss');
    await user.click(dismissButton);

    expect(mockResetUpload).toHaveBeenCalled();
  });

  it('should show success message', () => {
    mockUseImageUpload.mockReturnValue({
      uploadState: {
        isUploading: false,
        progress: null,
        error: null,
        result: { success: true, fileUrl: 'https://example.com/test.jpg', uploadId: 'upload123' },
      },
      uploadFile: mockUploadFile,
      cancelUpload: mockCancelUpload,
      resetUpload: mockResetUpload,
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByText('Upload completed successfully!')).toBeInTheDocument();
  });

  it('should open file dialog when clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const dropZone = screen.getByText('Drop files here or click to browse').closest('div');
    
    // Mock the file input click
    const fileInput = screen.getByLabelText('File upload input');
    const clickSpy = vi.spyOn(fileInput, 'click');

    await user.click(dropZone!);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('should disable interactions during upload', () => {
    mockUseImageUpload.mockReturnValue({
      uploadState: {
        isUploading: true,
        progress: null,
        error: null,
        result: null,
      },
      uploadFile: mockUploadFile,
      cancelUpload: mockCancelUpload,
      resetUpload: mockResetUpload,
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const dropZone = screen.getByText('Uploading...').closest('div');
    expect(dropZone).toHaveClass('pointer-events-none', 'opacity-75');
  });
});