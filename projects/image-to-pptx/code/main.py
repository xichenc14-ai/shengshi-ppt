"""
Image to PPTX - Main Entry Point

AI-Powered PPT Generation from Design Images

Usage:
    from main import generate_pptx
    
    result = generate_pptx(
        user_requirement="我需要一个关于2024年Q1销售业绩的汇报PPT",
        output_path="./sales_report.pptx",
        style="modern",
        model="minimax"
    )
    print(f"PPTX 已生成: {result}")
"""

import os
import sys
from pathlib import Path
from typing import Optional

# 添加 code 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from content_analyzer import ContentAnalyzer, ContentAnalysisResult
from prompt_engineer import PromptEngineer, DesignPrompt
from image_generator import ImageGenerator, GeneratedImage
from asset_extractor import AssetExtractor, ExtractedAsset
from pptx_builder import PPTXBuilder, SlideContent, ColorScheme, LayoutConfig


def generate_pptx(
    user_requirement: str,
    output_path: str = "./output.pptx",
    style: str = "modern",
    model: str = "minimax",
    generate_design_image: bool = False,
    api_key: Optional[str] = None,
) -> str:
    """
    生成 PPTX 文件
    
    完整流程：
    1. 分析用户需求 → Content Analyzer
    2. 生成设计提示词 → Prompt Engineer
    3. 生成设计图 → Image Generator（可选）
    4. 提取视觉素材 → Asset Extractor（可选）
    5. 生成 PPTX 文件 → PPTX Builder
    
    Args:
        user_requirement: 用户需求描述
        output_path: 输出文件路径
        style: 设计风格（modern, business, creative, minimalist）
        model: 图像生成模型（minimax, dalle, sd）
        generate_design_image: 是否生成设计图（需要 API Key）
        api_key: API 密钥（可选，默认从环境变量读取）
        
    Returns:
        生成的文件路径
        
    Raises:
        ValueError: 参数无效
        RuntimeError: 生成过程中出错
        
    Example:
        >>> result = generate_pptx(
        ...     user_requirement="我需要一个关于产品发布的PPT，包含5页",
        ...     output_path="./product_launch.pptx",
        ...     style="modern"
        ... )
        >>> print(f"PPTX 已生成: {result}")
        'product_launch.pptx'
    """
    print(f"🎯 开始生成 PPTX: {user_requirement[:50]}...")
    
    # 步骤 1: 分析用户需求
    print("📝 步骤 1/5: 分析用户需求...")
    analyzer = ContentAnalyzer()
    content_result = analyzer.analyze(user_requirement)
    print(f"   主题: {content_result.topic}")
    print(f"   幻灯片数量: {content_result.slide_count}")
    
    # 步骤 2: 生成设计提示词
    print("🎨 步骤 2/5: 生成设计提示词...")
    engineer = PromptEngineer()
    design_prompt = engineer.generate_design_prompt(content_result, style=style)
    print(f"   风格: {design_prompt.style}")
    print(f"   配色: {design_prompt.color_scheme}")
    
    # 步骤 3: 生成设计图（可选）
    design_image_path = None
    if generate_design_image:
        print("🖼️  步骤 3/5: 生成设计图...")
        try:
            generator = ImageGenerator(
                model=model,
                api_key=api_key,
                output_dir="./outputs/images"
            )
            generated = generator.generate(
                prompt=design_prompt.full_prompt,
                aspect_ratio="16:9",
                resolution="2K"
            )
            design_image_path = generated.image_path
            print(f"   设计图已生成: {design_image_path}")
        except Exception as e:
            print(f"   ⚠️ 设计图生成失败: {e}")
            print("   继续使用默认布局生成 PPTX...")
    else:
        print("⏭️  步骤 3/5: 跳过设计图生成（generate_design_image=False）")
    
    # 步骤 4: 提取素材（可选）
    extracted_assets = []
    if design_image_path and os.path.exists(design_image_path):
        print("🔍 步骤 4/5: 提取视觉素材...")
        try:
            extractor = AssetExtractor(output_dir="./outputs/assets")
            extracted_assets = extractor.extract_from_image(
                design_image_path,
                asset_types=["icon", "background", "shape"]
            )
            print(f"   已提取 {len(extracted_assets)} 个素材")
        except Exception as e:
            print(f"   ⚠️ 素材提取失败: {e}")
    else:
        print("⏭️  步骤 4/5: 跳过素材提取")
    
    # 步骤 5: 生成 PPTX
    print("📄 步骤 5/5: 生成 PPTX 文件...")
    try:
        # 创建配色方案
        color_scheme = ColorScheme(
            primary=design_prompt.color_scheme.get("primary", "#2563EB"),
            secondary=design_prompt.color_scheme.get("secondary", "#3B82F6"),
            background=design_prompt.color_scheme.get("background", "#FFFFFF"),
            accent=design_prompt.color_scheme.get("accent", "#06B6D4"),
        )
        
        # 创建构建器
        builder = PPTXBuilder(
            output_path=output_path,
            color_scheme=color_scheme,
        )
        builder.create_presentation()
        
        # 生成标题页
        builder.create_title_slide(
            title=content_result.title,
            subtitle=content_result.use_case
        )
        
        # 生成内容页
        for i, section in enumerate(content_result.structure):
            slide_content = SlideContent(
                title=section,
                bullet_points=[
                    f"要点 {j+1}" for j in range(3)
                ],
            )
            builder.add_slide(slide_content)
        
        # 保存
        result_path = builder.save()
        print(f"✅ PPTX 已成功生成: {result_path}")
        return result_path
        
    except Exception as e:
        raise RuntimeError(f"PPTX 生成失败: {e}")


def generate_pptx_from_design(
    design_image_path: str,
    output_path: str = "./output.pptx",
    api_key: Optional[str] = None,
) -> str:
    """
    从设计图直接生成 PPTX
    
    适用于已有设计图的情况，直接解析并生成 PPTX。
    
    Args:
        design_image_path: 设计图路径
        output_path: 输出文件路径
        api_key: API 密钥
        
    Returns:
        生成的文件路径
    """
    if not os.path.exists(design_image_path):
        raise FileNotFoundError(f"设计图不存在: {design_image_path}")
    
    print(f"🎯 从设计图生成 PPTX: {design_image_path}")
    
    # 提取素材
    extractor = AssetExtractor(output_dir="./outputs/assets")
    assets = extractor.extract_from_image(design_image_path)
    
    # 分析布局
    layout_info = extractor.analyze_design_layout(design_image_path)
    
    # 创建构建器
    builder = PPTXBuilder.from_design_image(
        design_image_path,
        output_path=output_path
    )
    
    # TODO: 根据布局信息生成 PPTX
    
    result_path = builder.save()
    print(f"✅ PPTX 已成功生成: {result_path}")
    return result_path


# 命令行入口
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Image to PPTX - AI-Powered PPT Generation"
    )
    parser.add_argument(
        "requirement",
        nargs="?",
        default="我需要一个现代简约风格的PPT，包含5页内容",
        help="用户需求描述"
    )
    parser.add_argument(
        "-o", "--output",
        default="./output.pptx",
        help="输出文件路径"
    )
    parser.add_argument(
        "-s", "--style",
        default="modern",
        choices=["modern", "business", "creative", "minimalist"],
        help="设计风格"
    )
    parser.add_argument(
        "-m", "--model",
        default="minimax",
        choices=["minimax", "dalle", "sd"],
        help="图像生成模型"
    )
    parser.add_argument(
        "--generate-image",
        action="store_true",
        help="生成设计图"
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="API 密钥"
    )
    
    args = parser.parse_args()
    
    result = generate_pptx(
        user_requirement=args.requirement,
        output_path=args.output,
        style=args.style,
        model=args.model,
        generate_design_image=args.generate_image,
        api_key=args.api_key,
    )
    
    print(f"\n📁 输出文件: {result}")
