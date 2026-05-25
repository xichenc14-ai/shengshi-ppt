"""
Content Analyzer - 分析用户需求，提取 PPT 关键信息

职责：
    理解用户需求，提取关键信息

输入：
    用户的自然语言需求描述

输出：
    PPT主题、内容结构、关键信息点、目标受众、使用场景

技术：
    使用 LLM 做意图分析和信息提取
"""

import json
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ContentAnalysisResult:
    """内容分析结果"""
    topic: str                          # PPT 主题
    title: str                          # 标题
    slide_count: int                    # 幻灯片数量
    structure: list[str]                # 内容结构（各页主题）
    key_points: list[str]               # 关键信息点
    target_audience: str                # 目标受众
    use_case: str                      # 使用场景
    style_preference: str = "modern"    # 风格偏好
    color_hint: Optional[str] = None     # 配色提示
    
    def to_dict(self) -> dict:
        return {
            "topic": self.topic,
            "title": self.title,
            "slide_count": self.slide_count,
            "structure": self.structure,
            "key_points": self.key_points,
            "target_audience": self.target_audience,
            "use_case": self.use_case,
            "style_preference": self.style_preference,
            "color_hint": self.color_hint,
        }


class ContentAnalyzer:
    """
    内容分析器
    
    使用 LLM 分析用户需求，提取 PPT 制作所需的关键信息。
    """
    
    SYSTEM_PROMPT = """你是一个专业的 PPT 内容分析助手。你的任务是从用户的自然语言需求中提取关键信息，用于后续的 PPT 生成。

请分析用户需求，提取以下信息：
1. PPT 主题（简短概括）
2. 主标题
3. 建议的幻灯片数量（1-10）
4. 内容结构（每页的主要内容）
5. 关键信息点（需要突出的数据/要点）
6. 目标受众（谁会观看这个 PPT）
7. 使用场景（商务汇报/教育培训/产品介绍等）
8. 风格偏好（现代简约/商务正式/创意活泼等）

请以 JSON 格式输出分析结果。"""
    
    def __init__(self, llm_client=None):
        """
        初始化内容分析器
        
        Args:
            llm_client: LLM 客户端实例，默认使用 MiniMax API
        """
        self.llm_client = llm_client
    
    def analyze(self, user_requirement: str) -> ContentAnalysisResult:
        """
        分析用户需求
        
        Args:
            user_requirement: 用户的自然语言需求描述
            
        Returns:
            ContentAnalysisResult: 包含分析结果的数据类
            
        Example:
            >>> analyzer = ContentAnalyzer()
            >>> result = analyzer.analyze("我需要一个关于2024年Q1销售业绩的汇报PPT，包含华北、华东、华南三个区域的业绩数据")
            >>> print(result.topic)
            '2024年Q1销售业绩汇报'
        """
        # TODO: 实现 LLM 调用逻辑
        # 目前返回结构化数据，后续接入实际 LLM API
        
        if self.llm_client:
            return self._analyze_with_llm(user_requirement)
        else:
            return self._analyze_fallback(user_requirement)
    
    def _analyze_with_llm(self, user_requirement: str) -> ContentAnalysisResult:
        """使用 LLM 分析（待实现）"""
        # TODO: 实现 LLM API 调用
        raise NotImplementedError("LLM 集成待实现")
    
    def _analyze_fallback(self, user_requirement: str) -> ContentAnalysisResult:
        """
        降级分析（基于规则）
        
        当没有 LLM 客户端时，使用简单的规则进行初步分析。
        """
        # 简单的基于关键词的分析
        requirement_lower = user_requirement.lower()
        
        # 检测幻灯片数量
        slide_count = 5  # 默认值
        if "单" in user_requirement or "1页" in user_requirement:
            slide_count = 1
        elif "三" in user_requirement or "3页" in user_requirement:
            slide_count = 3
        elif "五" in user_requirement or "5页" in user_requirement:
            slide_count = 5
        elif "十" in user_requirement or "10页" in user_requirement:
            slide_count = 10
        
        # 检测风格
        style = "modern"
        if "商务" in user_requirement or "正式" in user_requirement:
            style = "business"
        elif "创意" in user_requirement or "活泼" in user_requirement:
            style = "creative"
        elif "简约" in user_requirement:
            style = "minimalist"
        
        # 检测场景
        use_case = "通用汇报"
        if "销售" in user_requirement or "业绩" in user_requirement:
            use_case = "销售汇报"
        elif "产品" in user_requirement:
            use_case = "产品介绍"
        elif "培训" in user_requirement:
            use_case = "教育培训"
        elif "技术" in user_requirement or "架构" in user_requirement:
            use_case = "技术方案"
        
        return ContentAnalysisResult(
            topic=user_requirement[:50],
            title=user_requirement[:30],
            slide_count=slide_count,
            structure=[f"第{i+1}页内容" for i in range(slide_count)],
            key_points=["待提取的关键信息"],
            target_audience="商务人士",
            use_case=use_case,
            style_preference=style,
        )
    
    def analyze_batch(self, requirements: list[str]) -> list[ContentAnalysisResult]:
        """
        批量分析多个需求
        
        Args:
            requirements: 用户需求列表
            
        Returns:
            分析结果列表
        """
        return [self.analyze(req) for req in requirements]
