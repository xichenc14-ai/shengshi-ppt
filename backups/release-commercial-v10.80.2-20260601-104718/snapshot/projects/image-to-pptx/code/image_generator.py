"""
Image Generator - 图像生成器

职责：
    调用 AI 生图 API 生成 PPT 设计图

支持模型：
    - MiniMax image-01（通过 mmx CLI 调用）
    - 预留接口以便替换其他模型（OpenAI DALL-E、Stable Diffusion 等）

API 调用方式：
    通过 mmx 命令行工具调用 MiniMax image-01 API

设计图要求：
    - 比例：16:9（1920x1080 或等比）
    - 清晰展示每页布局
    - 配色和字体清晰可辨
    - 包含可提取的视觉元素
"""

import os
import json
import subprocess
import time
import uuid
import re
from dataclasses import dataclass
from typing import Optional
from pathlib import Path


@dataclass
class GeneratedImage:
    """生成的图像"""
    image_path: str          # 本地保存路径
    image_url: str           # 远程 URL
    prompt: str              # 使用的提示词
    model: str               # 使用的模型
    width: int = 1920        # 图像宽度
    height: int = 1080       # 图像高度
    seed: Optional[int] = None  # 种子值（用于复现）
    
    def to_dict(self) -> dict:
        return {
            "image_path": self.image_path,
            "image_url": self.image_url,
            "prompt": self.prompt,
            "model": self.model,
            "width": self.width,
            "height": self.height,
            "seed": self.seed,
        }


class ImageGenerator:
    """
    图像生成器
    
    支持多种 AI 生图模型，默认使用 MiniMax image-01（通过 mmx CLI）。
    """
    
    DEFAULT_OUTPUT_DIR = "./outputs/images"
    
    # 支持的模型
    SUPPORTED_MODELS = {
        "minimax": "MiniMax image-01",
        "minimax-01": "MiniMax image-01",
        "dalle": "OpenAI DALL-E 3",
        "sd": "Stable Diffusion XL",
    }
    
    # 分辨率映射
    RESOLUTION_MAP = {
        "1K": (1024, 1024),
        "2K": (2048, 2048),
        "4K": (2048, 2048),  # image-01 最大 2048x2048
    }
    
    def __init__(
        self,
        model: str = "minimax",
        api_key: Optional[str] = None,
        output_dir: str = DEFAULT_OUTPUT_DIR,
    ):
        """
        初始化图像生成器
        
        Args:
            model: 使用的模型（默认 minimax）
            api_key: API 密钥（默认从环境变量读取，当前由 mmx CLI 管理）
            output_dir: 图像输出目录
        """
        self.model = model.lower()
        self.api_key = api_key or os.environ.get("MINIMAX_API_KEY")
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 验证模型支持
        if self.model not in self.SUPPORTED_MODELS:
            raise ValueError(
                f"不支持的模型: {self.model}，"
                f"支持的模型: {list(self.SUPPORTED_MODELS.keys())}"
            )
    
    def generate(
        self,
        prompt: str,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        output_filename: Optional[str] = None,
        seed: Optional[int] = None,
        **kwargs,
    ) -> GeneratedImage:
        """
        生成图像
        
        Args:
            prompt: 生图提示词
            aspect_ratio: 宽高比（默认 16:9）
            resolution: 分辨率（1K, 2K, 4K）
            output_filename: 输出文件名
            seed: 随机种子（用于复现）
            **kwargs: 其他模型特定参数
            
        Returns:
            GeneratedImage: 生成的图像信息
            
        Example:
            >>> generator = ImageGenerator()
            >>> result = generator.generate(
            ...     prompt="现代简约风格的PPT设计图，16:9比例",
            ...     aspect_ratio="16:9",
            ...     resolution="2K"
            ... )
            >>> print(result.image_path)
            './outputs/images/design_abc123.png'
        """
        # 生成文件名
        if not output_filename:
            timestamp = int(time.time())
            short_id = str(uuid.uuid4())[:8]
            output_filename = f"design_{timestamp}_{short_id}.png"
        
        output_path = self.output_dir / output_filename
        
        # 根据模型调用不同的生成方法
        if self.model in ("minimax", "minimax-01"):
            return self._generate_minimax(
                prompt, aspect_ratio, resolution, str(output_path), seed=seed, **kwargs
            )
        elif self.model == "dalle":
            return self._generate_dalle(
                prompt, aspect_ratio, resolution, str(output_path), **kwargs
            )
        elif self.model == "sd":
            return self._generate_stable_diffusion(
                prompt, aspect_ratio, resolution, str(output_path), **kwargs
            )
        else:
            raise NotImplementedError(f"模型 {self.model} 的生成逻辑未实现")
    
    def _generate_minimax(
        self,
        prompt: str,
        aspect_ratio: str,
        resolution: str,
        output_path: str,
        seed: Optional[int] = None,
        **kwargs,
    ) -> GeneratedImage:
        """
        使用 MiniMax image-01 生成图像（通过 mmx CLI）
        
        Args:
            prompt: 生图提示词
            aspect_ratio: 宽高比
            resolution: 分辨率
            output_path: 输出路径
            seed: 随机种子
            
        Returns:
            GeneratedImage: 生成的图像信息
        """
        # 构建 mmx 命令
        cmd = [
            "mmx", "image", "generate",
            "--prompt", prompt,
            "--out", output_path,
            "--quiet",  # JSON 输出
        ]
        
        # 处理宽高比/分辨率
        if resolution in self.RESOLUTION_MAP:
            w, h = self.RESOLUTION_MAP[resolution]
            # mmx 要求 512-2048，8 的倍数
            w = min(w, 2048)
            h = min(h, 2048)
            # 调整为 16:9 比例
            if aspect_ratio == "16:9":
                h = 1080
                w = 1920
            cmd.extend(["--width", str(w), "--height", str(h)])
        else:
            cmd.extend(["--aspect-ratio", aspect_ratio])
        
        # 添加种子
        if seed is not None:
            cmd.extend(["--seed", str(seed)])
        
        # 调用 mmx CLI
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
            )
            
            if result.returncode != 0:
                raise RuntimeError(
                    f"mmx image generate 失败 (code {result.returncode}):\n"
                    f"stdout: {result.stdout}\n"
                    f"stderr: {result.stderr}"
                )
            
            # 解析输出（--quiet 模式下输出 JSON）
            output = result.stdout.strip()
            image_url = ""
            saved_path = output_path
            
            try:
                parsed = json.loads(output)
                if isinstance(parsed, dict):
                    if "saved" in parsed:
                        saved_path = parsed["saved"][0] if parsed["saved"] else output_path
                    if "url" in parsed:
                        image_url = parsed.get("url", "")
            except json.JSONDecodeError:
                # 输出不是 JSON，尝试从文本中提取路径
                if "saved" in output.lower():
                    # 提取路径
                    match = re.search(r'saved["\s:]+(\[?"([^"\]]+)")?', output)
                    if match:
                        saved_path = match.group(2) or output_path
            
            # 确定图像尺寸
            width, height = 1920, 1080
            if aspect_ratio == "16:9":
                width, height = 1920, 1080
            
            return GeneratedImage(
                image_path=saved_path,
                image_url=image_url,
                prompt=prompt,
                model="MiniMax image-01",
                width=width,
                height=height,
                seed=seed,
            )
            
        except subprocess.TimeoutExpired:
            raise RuntimeError("图像生成超时（180秒）")
        except FileNotFoundError:
            raise RuntimeError(
                "mmx 命令未找到，请确保已安装 mmx CLI 并配置在 PATH 中\n"
                "安装方式：pip install mmx-cli 或参考 https://platform.minimaxi.com/docs"
            )
    
    def _generate_dalle(
        self,
        prompt: str,
        aspect_ratio: str,
        resolution: str,
        output_path: str,
        **kwargs,
    ) -> GeneratedImage:
        """使用 DALL-E 3 生成图像（待实现）"""
        raise NotImplementedError("DALL-E 集成待实现")
    
    def _generate_stable_diffusion(
        self,
        prompt: str,
        aspect_ratio: str,
        resolution: str,
        output_path: str,
        **kwargs,
    ) -> GeneratedImage:
        """使用 Stable Diffusion 生成图像（待实现）"""
        raise NotImplementedError("Stable Diffusion 集成待实现")
    
    def generate_batch(
        self,
        prompts: list[str],
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
    ) -> list[GeneratedImage]:
        """
        批量生成图像
        
        Args:
            prompts: 提示词列表
            aspect_ratio: 宽高比
            resolution: 分辨率
            
        Returns:
            生成的图像列表
        """
        results = []
        for i, prompt in enumerate(prompts):
            try:
                result = self.generate(
                    prompt,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    output_filename=f"design_{i+1}_{int(time.time())}.png",
                )
                results.append(result)
            except Exception as e:
                print(f"生成第 {i+1} 张图像时出错: {e}")
        return results
    
    @classmethod
    def get_supported_models(cls) -> dict:
        """获取支持的模型列表"""
        return cls.SUPPORTED_MODELS.copy()
    
    def set_output_dir(self, path: str) -> None:
        """设置输出目录"""
        self.output_dir = Path(path)
        self.output_dir.mkdir(parents=True, exist_ok=True)
