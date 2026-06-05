'use client';

import React, { useState } from 'react';
import type { DiagramConfig, DiagramType, DiagramTheme } from '../types';

interface DiagramEditorProps {
  initialConfig: DiagramConfig;
  onSave: (config: DiagramConfig) => void;
  onCancel: () => void;
}

const DIAGRAM_TYPES: { value: DiagramType; label: string; example: string }[] = [
  {
    value: 'flowchart',
    label: '流程图',
    example: `flowchart TD
    A[开始] --> B{判断}
    B -->|是| C[执行]
    B -->|否| D[退出]`,
  },
  {
    value: 'sequence',
    label: '时序图',
    example: `sequenceDiagram
    participant 用户
    participant 系统
    用户->>系统: 请求
    系统-->>用户: 响应`,
  },
  {
    value: 'class',
    label: '类图',
    example: `classDiagram
    class Animal {
      +String name
      +makeSound()
    }
    class Dog {
      +bark()
    }
    Animal <|-- Dog`,
  },
  {
    value: 'state',
    label: '状态图',
    example: `stateDiagram-v2
    [*] --> 空闲
    空闲 --> 处理中: 执行任务
    处理中 --> 完成: 任务结束
    完成 --> [*]`,
  },
  {
    value: 'er',
    label: 'ER图',
    example: `erDiagram
    用户 {
      int id PK
      string 姓名
      string 邮箱
    }
    订单 {
      int id PK
      int 用户ID FK
      decimal 金额
    }`,
  },
  {
    value: 'gantt',
    label: '甘特图',
    example: `gantt
    title 项目进度
    dateFormat YYYY-MM-DD
    section 阶段一
    需求分析: a1, 2026-05-01, 7d
    设计: a2, after a1, 5d`,
  },
  {
    value: 'pie',
    label: '饼图',
    example: `pie title 占比
    "方案A": 40
    "方案B": 35
    "方案C": 25`,
  },
  {
    value: 'mindmap',
    label: '思维导图',
    example: `mindmap
  root((主题))
    子主题1
      要点1.1
      要点1.2
    子主题2
      要点2.1`,
  },
  {
    value: 'timeline',
    label: '时间线',
    example: `timeline
    title 项目时间线
    2026-05-01 : 项目启动
    2026-05-15 : 完成设计
    2026-06-01 : 开发完成`,
  },
];

const THEME_OPTIONS: { value: DiagramTheme; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'neutral', label: '中性' },
  { value: 'dark', label: '深色' },
  { value: 'base', label: '基础' },
];

export function DiagramEditor({ initialConfig, onSave, onCancel }: DiagramEditorProps) {
  const [config, setConfig] = useState<DiagramConfig>(
    initialConfig.definition ? initialConfig : { ...initialConfig, definition: DIAGRAM_TYPES[0].example }
  );

  const update = (patch: Partial<DiagramConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const insertTemplate = (template: string) => {
    update({ definition: template });
  };

  const inputStyle = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono';
  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">图表编辑器（Mermaid）</h2>

      {/* Title & Theme */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className={labelStyle}>图表标题</label>
          <input
            className={inputStyle}
            value={config.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="输入图表标题"
          />
        </div>
        <div>
          <label className={labelStyle}>主题</label>
          <div className="grid grid-cols-4 gap-1">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => update({ theme: t.value })}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  (config.theme || 'default') === t.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Diagram Type Selector */}
      <div className="mb-4">
        <label className={labelStyle}>图表类型</label>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {DIAGRAM_TYPES.map((dt) => (
            <button
              key={dt.value}
              onClick={() => insertTemplate(dt.example)}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                config.type === dt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {dt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scale */}
      <div className="mb-4">
        <label className={labelStyle}>缩放比例: {config.scale || 1}x</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={config.scale || 1}
          onChange={(e) => update({ scale: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Mermaid Definition */}
      <div className="mb-4">
        <label className={labelStyle}>
          Mermaid 语法定义
          <span className="text-gray-400 font-normal ml-2">（实时预览请在上方查看）</span>
        </label>
        <textarea
          className={inputStyle}
          value={config.definition}
          onChange={(e) => update({ definition: e.target.value })}
          rows={12}
          placeholder="输入 Mermaid 语法..."
          spellCheck={false}
        />
      </div>

      {/* Reference */}
      <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">
          <span className="font-semibold">语法参考：</span>
          flowchart TD/LR/RL/BT | sequenceDiagram | classDiagram | stateDiagram-v2 | pie | gantt | mindmap | timeline
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
          取消
        </button>
        <button onClick={() => onSave(config)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          保存图表
        </button>
      </div>
    </div>
  );
}

export default DiagramEditor;
