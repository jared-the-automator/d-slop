export interface MediaDetectionResult {
  detected: boolean;
  method?: string;
  tool?: string;
}

export interface MediaDetector {
  name: string;
  detect(url: string): Promise<MediaDetectionResult>;
}

export interface MediaSettings {
  mode: 'highlight' | 'collapse' | 'hidden';
  threshold: number;
}
