"""
Prompt Engineer - 提示词工程师

职责：
    生成高质量的 AI 生图提示词

输入：
    Content Analyzer 的输出 + 设计要求

输出：
    结构化的设计图生成提示词

设计图提示词结构：
    [构图] 16:9比例的PPT整体设计图，展示X张幻灯片的完整布局
    [风格] 现代简约/商务正式/创意活泼
    [配色] 主色:#XXXXXX 次色:#XXXXXX 背景:#XXXXXX
    [布局] 标题区域、内容区域、图表区域、页脚区域
    [字体] 标题字体、正文字体
    [元素] 具体视觉元素描述
"""

import json
from dataclasses import dataclass
from typing import Optional
from content_analyzer import ContentAnalysisResult


@dataclass
class DesignPrompt:
    """设计图提示词"""
    full_prompt: str                    # 完整的生图提示词
    style: str                          # 设计风格
    color_scheme: dict                  # 配色方案
    layout_description: str             # 布局描述
    elements: list[str]                # 视觉元素列表
    
    def to_dict(self) -> dict:
        return {
            "full_prompt": self.full_prompt,
            "style": self.style,
            "color_scheme": self.color_scheme,
            "layout_description": self.layout_description,
            "elements": self.elements,
        }


class PromptEngineer:
    """
    提示词工程师
    
    根据内容分析结果生成高质量的 AI 生图提示词。
    """
    
    # 风格预设
    STYLE_PRESETS = {
        "modern": {
            "name": "现代简约",
            "colors": {
                "primary": "#2563EB",
                "secondary": "#3B82F6",
                "background": "#FFFFFF",
                "accent": "#06B6D4",
            },
            "font_style": "无衬线字体，简洁现代",
            "elements": ["几何图形", "渐变色块", "简洁线条"],
        },
        "business": {
            "name": "商务正式",
            "colors": {
                "primary": "#1E3A5F",
                "secondary": "#2D5A87",
                "background": "#F8FAFC",
                "accent": "#DC2626",
            },
            "font_style": "衬线字体，稳重专业",
            "elements": ["图表", "数据可视化", "商务图标"],
        },
        "creative": {
            "name": "创意活泼",
            "colors": {
                "primary": "#EC4899",
                "secondary": "#F472B6",
                "background": "#FDF2F8",
                "accent": "#8B5CF6",
            },
            "font_style": "手写风格或活泼字体",
            "elements": ["插画", "卡通元素", "不规则形状"],
        },
        "minimalist": {
            "name": "极简主义",
            "colors": {
                "primary": "#000000",
                "secondary": "#6B7280",
                "background": "#FFFFFF",
                "accent": "#374151",
            },
            "font_style": "无衬线字体，极简",
            "elements": ["大量留白", "简洁线条", "单色块"],
        },
    }
    
    def __init__(self):
        """初始化提示词工程师"""
        pass
    
    def generate_design_prompt(
        self,
        content_result: ContentAnalysisResult,
        style: Optional[str] = None,
        custom_colors: Optional[dict] = None,
    ) -> DesignPrompt:
        """
        生成设计图提示词
        
        Args:
            content_result: 内容分析结果
            style: 设计风格（默认从 content_result 读取）
            custom_colors: 自定义配色
            
        Returns:
            DesignPrompt: 设计提示词对象
            
        Example:
            >>> from content_analyzer import ContentAnalyzer, ContentAnalysisResult
            >>> engineer = PromptEngineer()
            >>> result = ContentAnalysisResult(
            ...     topic="产品介绍",
            ...     title="XX产品发布会",
            ...     slide_count=5,
            ...     structure=["封面", "产品特点", "技术参数", "应用场景", "联系我们"],
            ...     key_points=["高性能", "低功耗", "易用"],
            ...     target_audience="企业客户",
            ...     use_case="产品发布"
            ... )
            >>> prompt = engineer.generate_design_prompt(result, style="modern")
            >>> print(prompt.style)
            'modern'
        """
        # 确定风格
        style = style or content_result.style_preference or "modern"
        preset = self.STYLE_PRESETS.get(style, self.STYLE_PRESETS["modern"])
        
        # 使用自定义配色或预设
        color_scheme = custom_colors or preset["colors"]
        
        # 生成布局描述
        layout = self._generate_layout_description(content_result, preset)
        
        # 生成视觉元素
        elements = self._generate_elements(content_result, preset)
        
        # 组合完整提示词
        full_prompt = self._compose_full_prompt(
            content_result, style, color_scheme, layout, elements
        )
        
        return DesignPrompt(
            full_prompt=full_prompt,
            style=style,
            color_scheme=color_scheme,
            layout_description=layout,
            elements=elements,
        )
    
    def _generate_layout_description(
        self, content: ContentAnalysisResult, preset: dict
    ) -> str:
        """生成布局描述"""
        slide_count = content.slide_count
        style_name = preset["name"]
        
        layout_parts = [
            f"16:9 比例的 PPT 设计图，展示 {slide_count} 张幻灯片的完整布局",
            f"风格：{style_name}",
            f"页面结构：{', '.join(content.structure[:5])}",
            f"标题区域位于顶部，内容区域位于中部，图表/图片区域位于合适位置",
            "页脚包含页码和公司/项目标识",
            "清晰的视觉层次，便于阅读",
        ]
        
        return "；".join(layout_parts)
    
    def _generate_elements(self, content: ContentAnalysisResult, preset: dict) -> list[str]:
        """生成视觉元素列表"""
        elements = list(preset["elements"])
        
        # 根据内容添加相关元素
        if "销售" in content.topic or "业绩" in content.topic:
            elements.extend(["折线图", "柱状图", "数据卡片"])
        if "产品" in content.topic:
            elements.extend(["产品图片", "功能图标", "场景插图"])
        if "技术" in content.topic:
            elements.extend(["流程图", "架构图", "技术图标"])
            
        return list(set(elements))  # 去重
    
    def _compose_full_prompt(
        self,
        content: ContentAnalysisResult,
        style: str,
        colors: dict,
        layout: str,
        elements: list[str],
    ) -> str:
        """组合完整的生图提示词"""
        
        prompt_parts = [
            f"【构图】{layout}",
            f"【风格】{style}",
            f"【配色】主色: {colors['primary']}, 次色: {colors['secondary']}, "
            f"背景色: {colors['background']}, 强调色: {colors['accent']}",
            f"【字体】标题: 24-36pt 加粗，正文: 14-18pt，清晰可读",
            f"【元素】{', '.join(elements)}",
            f"【内容要点】主题: {content.topic}，"
            f"关键信息: {', '.join(content.key_points[:3])}",
            f"【质量要求】高清晰度，专业的 PPT 设计感，"
            f"可用于直接转换为 PPTX 的设计参考图",
        ]
        
        return "\n".join(prompt_parts)
    
    def generate_prompts_batch(
        self,
        contents: list[ContentAnalysisResult],
        styles: Optional[list[str]] = None,
    ) -> list[DesignPrompt]:
        """
        批量生成设计提示词
        
        Args:
            contents: 内容分析结果列表
            styles: 风格列表（与 contents 一一对应）
            
        Returns:
            设计提示词列表
        """
        prompts = []
        for i, content in enumerate(contents):
            style = styles[i] if styles and i < len(styles) else None
            prompts.append(self.generate_design_prompt(content, style))
        return prompts
    
    @classmethod
    def get_available_styles(cls) -> list[str]:
        """获取可用的风格列表"""
        return list(cls.STYLE_PRESETS.keys())
    
    @classmethod
    def get_style_preset(cls, style: str) -> dict:
        """获取指定风格的预设"""
        return cls.STYLE_PRESETS.get(style, cls.STYLE_PRESETS["modern"])
