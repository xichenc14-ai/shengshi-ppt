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
