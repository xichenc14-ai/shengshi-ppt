"""
Asset Extractor - 素材提取器

职责：
    从设计图中提取可用的视觉素材

技术路线：
    - AI视觉模型分析 + 图像裁剪/去背景
    - 工具：Pillow（图像处理）、rembg（去背景）

功能：
    - 分析设计图，识别可提取的元素
    - 裁剪和去背景处理
    - 生成可复用的素材
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from PIL import Image


@dataclass
class ExtractedAsset:
    """提取的素材"""
    asset_path: str              # 素材文件路径
    asset_type: str              # 素材类型（icon, background, shape, image）
    description: str             # 素材描述
    bounding_box: Optional[tuple] = None  # 边界框 (x, y, w, h)
    transparent: bool = False     # 是否透明背景
    
    def to_dict(self) -> dict:
        return {
            "asset_path": self.asset_path,
            "asset_type": self.asset_type,
            "description": self.description,
            "bounding_box": self.bounding_box,
            "transparent": self.transparent,
        }


class AssetExtractor:
    """
    素材提取器
    
    从设计图中提取可用的视觉素材，包括图标、背景、装饰元素等。
    """
    
    # 素材类型
    ASSET_TYPES = ["icon", "background", "shape", "image", "text", "chart"]
    
    def __init__(
        self,
        output_dir: str = "./outputs/assets",
        use_rembg: bool = False,
    ):
        """
        初始化素材提取器
        
        Args:
            output_dir: 素材输出目录
            use_rembg: 是否使用 rembg 去背景（需要安装 rembg）
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.use_rembg = use_rembg
        
        # 检查 rembg 是否可用
        if self.use_rembg:
            try:
                from rembg import remove
                self._rembg_available = True
            except ImportError:
                print("警告: rembg 未安装，将不使用去背景功能")
                self._rembg_available = False
        else:
            self._rembg_available = False
    
    def extract_from_image(
        self,
        design_image_path: str,
        asset_types: Optional[list[str]] = None,
    ) -> list[ExtractedAsset]:
        """
        从设计图中提取素材
        
        Args:
            design_image_path: 设计图路径
            asset_types: 要提取的素材类型列表（默认提取所有类型）
            
        Returns:
            提取的素材列表
            
        Example:
            >>> extractor = AssetExtractor()
            >>> assets = extractor.extract_from_image(
            ...     "design.png",
            ...     asset_types=["icon", "background"]
            ... )
            >>> for asset in assets:
            ...     print(f"{asset.asset_type}: {asset.asset_path}")
        """
        asset_types = asset_types or self.ASSET_TYPES
        assets = []
        
        # TODO: 实现 AI 视觉分析 + 素材提取逻辑
        # 当前为占位实现
        
        # 检查图像是否存在
        if not os.path.exists(design_image_path):
            raise FileNotFoundError(f"设计图不存在: {design_image_path}")
        
        # 基础分析：尝试裁剪中心区域作为示例
        try:
            img = Image.open(design_image_path)
            width, height = img.size
            
            # 示例：提取中心区域作为"布局参考"
            center_region = img.crop((
                int(width * 0.1),
                int(height * 0.1),
                int(width * 0.9),
                int(height * 0.9)
            ))
            
            # 保存示例素材
            output_path = self.output_dir / "layout_reference.png"
            center_region.save(output_path)
            
            assets.append(ExtractedAsset(
                asset_path=str(output_path),
                asset_type="shape",
                description="中心布局区域",
                bounding_box=(int(width * 0.1), int(height * 0.1), 
                             int(width * 0.8), int(height * 0.8)),
            ))
        except Exception as e:
            print(f"提取素材时出错: {e}")
        
        return assets
    
    def extract_icons(
        self,
        design_image_path: str,
        icon_regions: Optional[list[tuple]] = None,
    ) -> list[ExtractedAsset]:
        """
        提取图标/图标区域
        
        Args:
            design_image_path: 设计图路径
            icon_regions: 图标区域列表 [(x, y, w, h), ...]
            
        Returns:
            提取的图标素材列表
        """
        # TODO: 使用 AI 视觉模型识别图标区域
        # 当前为占位实现
        return []
    
    def extract_background(
        self,
        design_image_path: str,
        remove_background: bool = True,
    ) -> Optional[ExtractedAsset]:
        """
        提取背景素材
        
        Args:
            design_image_path: 设计图路径
            remove_background: 是否去背景
            
        Returns:
            背景素材（如果有）
        """
        try:
            img = Image.open(design_image_path)
            
            if remove_background and self._rembg_available:
                from rembg import remove
                # 使用 rembg 去背景
                output_path = self.output_dir / "background_transparent.png"
                img_no_bg = remove(img)
                img_no_bg.save(output_path)
                
                return ExtractedAsset(
                    asset_path=str(output_path),
                    asset_type="background",
                    description="透明背景",
                    transparent=True,
                )
            else:
                # 直接保存原图作为背景
                output_path = self.output_dir / "background.png"
                img.save(output_path)
                
                return ExtractedAsset(
                    asset_path=str(output_path),
                    asset_type="background",
                    description="背景图",
                    transparent=False,
                )
        except Exception as e:
            print(f"提取背景时出错: {e}")
            return None
    
    def extract_shapes(
        self,
        design_image_path: str,
        shape_types: Optional[list[str]] = None,
    ) -> list[ExtractedAsset]:
        """
        提取形状/装饰元素
        
        Args:
            design_image_path: 设计图路径
            shape_types: 要提取的形状类型
            
        Returns:
            提取的形状素材列表
        """
        # TODO: 实现形状提取逻辑
        return []
    
    def remove_background(self, image_path: str) -> str:
        """
        对图像进行去背景处理
        
        Args:
            image_path: 图像路径
            
        Returns:
            去背景后的图像路径
        """
        if not self._rembg_available:
            raise RuntimeError("rembg 未安装，无法执行去背景")
        
        from rembg import remove
        
        input_path = Path(image_path)
        output_path = self.output_dir / f"{input_path.stem}_nobg.png"
        
        img = Image.open(image_path)
        img_no_bg = remove(img)
        img_no_bg.save(output_path)
        
        return str(output_path)
    
    def crop_region(
        self,
        image_path: str,
        bbox: tuple,
        output_filename: Optional[str] = None,
    ) -> str:
        """
        裁剪图像指定区域
        
        Args:
            image_path: 图像路径
            bbox: 边界框 (x, y, w, h)
            output_filename: 输出文件名
            
        Returns:
            裁剪后的图像路径
        """
        x, y, w, h = bbox
        img = Image.open(image_path)
        
        cropped = img.crop((x, y, x + w, y + h))
        
        if not output_filename:
            input_path = Path(image_path)
            output_filename = f"{input_path.stem}_crop.png"
        
        output_path = self.output_dir / output_filename
        cropped.save(output_path)
        
        return str(output_path)
    
    def analyze_design_layout(
        self,
        design_image_path: str,
    ) -> dict:
        """
        分析设计图布局
        
        Args:
            design_image_path: 设计图路径
            
        Returns:
            布局分析结果（边界框、比例、位置等）
        """
        # TODO: 使用 AI 视觉模型分析布局
        # 当前为占位实现
        try:
            img = Image.open(design_image_path)
            width, height = img.size
            
            return {
                "width": width,
                "height": height,
                "aspect_ratio": f"{width}:{height}",
                "title_region": {
                    "bbox": (int(width * 0.05), int(height * 0.02),
                            int(width * 0.95), int(height * 0.15)),
                    "description": "标题区域",
                },
                "content_region": {
                    "bbox": (int(width * 0.05), int(height * 0.18),
                            int(width * 0.95), int(height * 0.85)),
                    "description": "内容区域",
                },
                "footer_region": {
                    "bbox": (int(width * 0.05), int(height * 0.92),
                            int(width * 0.95), int(height * 0.98)),
                    "description": "页脚区域",
                },
            }
        except Exception as e:
            return {"error": str(e)}
    
    @classmethod
    def get_supported_asset_types(cls) -> list[str]:
        """获取支持的素材类型"""
        return cls.ASSET_TYPES.copy()
