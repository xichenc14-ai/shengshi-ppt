/**
 * Outline API response types - D2 canonical
 */

export interface OutlineSlide {
  index: number;
  title: string;
  bullets: string[];
  content?: string[];
  speakerNotes?: string;
  notes?: string;
}

export interface OutlineMeta {
  topic?: string;
  pageCount?: number;
  style?: string;
  purpose?: string;
  imageMode?: string;
  contentStrategy?: string;
  mode?: 'generate' | 'condense' | 'preserve' | 'auto';
  wordCount?: number;
  preprocess?: {
    truncated?: boolean;
    requestedMode?: 'generate' | 'condense' | 'preserve';
    effectiveMode?: 'generate' | 'condense' | 'preserve';
    autoAdjusted?: boolean;
    forceRequestedMode?: boolean;
    strictPreserve?: boolean;
  };
  intent?: {
    themeLocked?: boolean;
    themeLabel?: string;
    pageCountLocked?: boolean;
    imageModeLocked?: boolean;
    toneLocked?: boolean;
  };
  fallback?: boolean;
  _fallback?: boolean;
  _fromMarkdown?: boolean;
}

export interface OutlineResponse {
  title: string;
  slides: OutlineSlide[];
  meta: OutlineMeta;
  themeId?: string;
  tone?: string;
  imageMode?: string;
  scene?: string;
  storyline?: string;
  _fallback?: boolean;
  _fromMarkdown?: boolean;
}
