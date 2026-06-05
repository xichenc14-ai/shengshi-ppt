'use client';

import React from 'react';
import { ALL_TEMPLATES, TEMPLATES_BY_CATEGORY, type GraphTemplate } from '@/lib/graph/graph-templates';

export interface TemplateGalleryProps {
  onSelect: (template: GraphTemplate) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  process: '📋 流程模板',
  structure: '🏗️ 结构模板',
  timeline: '⏱️ 时间模板',
  analysis: '🔍 分析框架',
};

const CATEGORY_ORDER = ['process', 'structure', 'timeline', 'analysis'];

export function TemplateGallery({ onSelect, onClose }: TemplateGalleryProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '90vw',
          maxWidth: 800,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              选择模板
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
              共 {ALL_TEMPLATES.length} 个预设模板
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #e2e8f0',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 18,
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Grid */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {CATEGORY_ORDER.map((cat) => {
            const templates = TEMPLATES_BY_CATEGORY[cat] ?? [];
            if (!templates.length) return null;
            return (
              <div key={cat}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#475569',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 10,
                  }}
                >
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { onSelect(t); onClose(); }}
                      style={{
                        padding: '12px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#fafafa',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#6366f1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fafafa';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1e293b',
                          marginBottom: 4,
                        }}
                      >
                        {t.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                        {t.description}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: '#8b5cf6',
                          fontWeight: 500,
                        }}
                      >
                        {t.nodes.length} 节点 · {t.edges.length} 连线
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
