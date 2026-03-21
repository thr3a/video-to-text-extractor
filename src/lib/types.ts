export type JobStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'error';

export type CropRect = {
  x: number; // 0-1の正規化座標
  y: number;
  w: number;
  h: number;
};

export type PreviewFrame = {
  filename: string;
  timestamp: number;
};

export type JobState = {
  id: string;
  videoId: string;
  status: JobStatus;
  totalFrames: number;
  processedFrames: number;
  texts: string[];
  error?: string;
  cancelRequested: boolean;
};

export type UploadResponse = {
  videoId: string;
  duration: number;
  originalName: string;
  previewFrames: PreviewFrame[];
};

export type ProcessRequest = {
  videoId: string;
  cropRect: CropRect;
  intervalSeconds: number;
};

export type JobStatusResponse = {
  status: JobStatus;
  totalFrames: number;
  processedFrames: number;
  texts: string[];
  error?: string;
};
