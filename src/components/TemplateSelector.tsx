'use client';

import React from 'react';
import { Template, templates } from '@/lib/types';

interface TemplateSelectorProps {
  selectedId: string;
  onSelect: (template: Template) => void;
}

export default function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        选择模板风格
      </label>
      <div className="grid grid-cols-5 gap-3">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className={`
              group relative p-3 rounded-xl border-2 transition-all duration-200
              hover:shadow-md
              ${selectedId === template.id
                ? 'border-blue-500 shadow-md bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            {/* 模板预览色块 */}
            <div className="aspect-video rounded-lg overflow-hidden mb-2 relative">
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${template.colors.primary} 60%, ${template.colors.secondary} 100%)` }}
              >
                <div className="absolute bottom-1 left-2 right-2">
                  <div className="h-1.5 bg-white/60 rounded w-3/4 mb-1" />
                  <div className="h-1 bg-white/30 rounded w-1/2" />
                </div>
              </div>
            </div>
            <p className="text-xs font-medium text-center text-gray-700">
              {template.name}
            </p>
            {selectedId === template.id && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
