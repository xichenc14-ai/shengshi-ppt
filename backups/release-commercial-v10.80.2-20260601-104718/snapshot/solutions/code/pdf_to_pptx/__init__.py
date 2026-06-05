"""
PDF/图片 转 PPTX 转换模块
省心PPT (shengxin-ppt)

Author: tech-lead
Version: 1.0.0
"""

__version__ = "1.0.0"
__compatible_pptx_version__ = "0.6.21"
API_VERSION = "v1"

from pdf_to_pptx.converter import PDFToPPTXConverter
from pdf_to_pptx.converter import ConversionResult, BatchResult

__all__ = [
    "PDFToPPTXConverter",
    "ConversionResult",
    "BatchResult",
]
