const pptxgen = require("pptxgenjs");

async function generateMaskPPT() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = "P2 - 图片蒙版系统";
  pptx.author = "PPT-Master";

  // ── 配色 ──
  const C = {
    primary: "6C5CE7",    // 紫色
    secondary: "00CEC9",  // 青色
    accent: "FD79A8",      // 粉色
    dark: "2D3436",
    light: "F8F9FA",
    white: "FFFFFF",
    gray: "636E72",
    gradientA: "0984E3",
    gradientB: "6C5CE7",
  };

  // ── 辅助：创建圆形头像占位图（用纯色块+shape模拟） ──
  // 我们用 shape 组合来展示不同蒙版效果

  // ══════════════════════════════════════
  // 第1页：封面
  // ══════════════════════════════════════
  let slide1 = pptx.addSlide();
  slide1.background = { color: C.dark };

  // 装饰圆
  slide1.addShape(pptx.shapes.OVAL, {
    x: -1.5, y: -1, w: 4, h: 4,
    fill: { color: C.primary, transparency: 70 }
  });
  slide1.addShape(pptx.shapes.OVAL, {
    x: 7.5, y: 3.5, w: 4, h: 4,
    fill: { color: C.secondary, transparency: 70 }
  });
  slide1.addShape(pptx.shapes.OVAL, {
    x: 8.5, y: -0.5, w: 2, h: 2,
    fill: { color: C.accent, transparency: 60 }
  });

  // 主标题
  slide1.addText("图片蒙版系统", {
    x: 0.5, y: 1.8, w: 9, h: 1.2,
    fontSize: 52, fontFace: "Microsoft YaHei",
    color: C.white, bold: true, align: "center"
  });

  // 副标题
  slide1.addText("Image Mask System — P2 功能演示", {
    x: 0.5, y: 3.1, w: 9, h: 0.6,
    fontSize: 22, fontFace: "Arial",
    color: C.secondary, align: "center"
  });

  // 分隔线
  slide1.addShape(pptx.shapes.RECTANGLE, {
    x: 3.5, y: 3.9, w: 3, h: 0.04,
    fill: { color: C.accent }
  });

  // 标签
  slide1.addText("PPT-Master  ·  智能蒙版  ·  创意设计", {
    x: 0.5, y: 4.2, w: 9, h: 0.5,
    fontSize: 14, fontFace: "Arial",
    color: C.gray, align: "center"
  });

  // 底部装饰条
  slide1.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 5.2, w: 10, h: 0.425,
    fill: { color: C.primary, transparency: 80 }
  });

  // ══════════════════════════════════════
  // 第2页：内容页 — 多种蒙版效果
  // ══════════════════════════════════════
  let slide2 = pptx.addSlide();
  slide2.background = { color: C.light };

  // 顶部标题栏
  slide2.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.9,
    fill: { color: C.dark }
  });
  slide2.addText("蒙版效果展示", {
    x: 0.4, y: 0.15, w: 6, h: 0.6,
    fontSize: 24, fontFace: "Microsoft YaHei",
    color: C.white, bold: true, margin: 0
  });
  slide2.addText("P2  ·  Image Mask System", {
    x: 6, y: 0.2, w: 3.6, h: 0.5,
    fontSize: 12, fontFace: "Arial",
    color: C.secondary, align: "right", margin: 0
  });

  // 6个蒙版卡片：2行3列
  const masks = [
    {
      label: "圆形蒙版",
      sub: "Circle Mask",
      shape: "OVAL",
      color: C.primary,
      icon: "●"
    },
    {
      label: "矩形蒙版",
      sub: "Rectangle Mask",
      shape: "RECTANGLE",
      color: C.secondary,
      icon: "■"
    },
    {
      label: "圆角矩形",
      sub: "Rounded Rect",
      shape: "ROUNDED_RECTANGLE",
      color: C.accent,
      icon: "▢"
    },
    {
      label: "三角形",
      sub: "Triangle Mask",
      shape: "TRIANGLE",
      color: "E17055",
      icon: "▲"
    },
    {
      label: "渐变蒙版",
      sub: "Gradient Mask",
      shape: "OVAL",
      color: C.gradientA,
      icon: "◐"
    },
    {
      label: "阴影蒙版",
      sub: "Shadow Mask",
      shape: "OVAL",
      color: C.dark,
      icon: "◑"
    },
  ];

  const cardW = 2.8;
  const cardH = 1.9;
  const startX = 0.55;
  const gapX = 0.25;
  const rowY = [1.1, 3.3];

  masks.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = rowY[row];

    // 卡片背景
    slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.white },
      shadow: { type: "outer", blur: 6, offset: 2, angle: 45, color: "000000", opacity: 0.12 },
      rectRadius: 0.08
    });

    // 蒙版区域（中心圆/形状）
    const shapeSize = 0.75;
    const shapeX = x + (cardW - shapeSize) / 2;
    const shapeY = y + 0.2;

    if (m.shape === "OVAL") {
      slide2.addShape(pptx.shapes.OVAL, {
        x: shapeX, y: shapeY, w: shapeSize, h: shapeSize,
        fill: { color: m.color, transparency: 15 },
        line: { color: m.color, width: 2 }
      });
    } else if (m.shape === "RECTANGLE") {
      slide2.addShape(pptx.shapes.RECTANGLE, {
        x: shapeX, y: shapeY, w: shapeSize, h: shapeSize * 0.7,
        fill: { color: m.color, transparency: 15 },
        line: { color: m.color, width: 2 }
      });
    } else if (m.shape === "ROUNDED_RECTANGLE") {
      slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: shapeX, y: shapeY, w: shapeSize, h: shapeSize * 0.7,
        fill: { color: m.color, transparency: 15 },
        line: { color: m.color, width: 2 },
        rectRadius: 0.1
      });
    } else if (m.shape === "TRIANGLE") {
      slide2.addShape(pptx.shapes.RECTANGLE, {
        x: shapeX, y: shapeY, w: shapeSize, h: shapeSize,
        fill: { color: m.color, transparency: 85 },
        line: { color: m.color, width: 2 }
      });
      slide2.addText("▲", {
        x: shapeX, y: shapeY, w: shapeSize, h: shapeSize,
        fontSize: 32, color: m.color, align: "center", valign: "middle"
      });
    }

    // 标签
    slide2.addText(m.label, {
      x, y: y + 1.05, w: cardW, h: 0.4,
      fontSize: 13, fontFace: "Microsoft YaHei",
      color: C.dark, bold: true, align: "center", margin: 0
    });
    slide2.addText(m.sub, {
      x, y: y + 1.42, w: cardW, h: 0.35,
      fontSize: 10, fontFace: "Arial",
      color: C.gray, align: "center", margin: 0
    });
  });

  // 底部说明
  slide2.addText("支持多种几何形状蒙版 · 渐变填充 · 阴影叠加 · 透明度控制", {
    x: 0.5, y: 5.25, w: 9, h: 0.3,
    fontSize: 11, fontFace: "Arial",
    color: C.gray, align: "center"
  });

  // ══════════════════════════════════════
  // 第3页：结束页
  // ══════════════════════════════════════
  let slide3 = pptx.addSlide();
  slide3.background = { color: C.dark };

  // 大装饰圆
  slide3.addShape(pptx.shapes.OVAL, {
    x: 3, y: 0.8, w: 4, h: 4,
    fill: { color: C.primary, transparency: 85 }
  });
  slide3.addShape(pptx.shapes.OVAL, {
    x: 3.8, y: 1.6, w: 2.4, h: 2.4,
    fill: { color: C.secondary, transparency: 80 }
  });

  // 结束语
  slide3.addText("谢谢观看", {
    x: 0.5, y: 1.8, w: 9, h: 1,
    fontSize: 48, fontFace: "Microsoft YaHei",
    color: C.white, bold: true, align: "center"
  });

  slide3.addText("Thank You", {
    x: 0.5, y: 2.85, w: 9, h: 0.6,
    fontSize: 20, fontFace: "Arial",
    color: C.secondary, align: "center"
  });

  // 分隔线
  slide3.addShape(pptx.shapes.RECTANGLE, {
    x: 4, y: 3.6, w: 2, h: 0.04,
    fill: { color: C.accent }
  });

  // 描述
  slide3.addText("PPT-Master  ·  图片蒙版系统 P2  ·  智能创意设计平台", {
    x: 0.5, y: 3.85, w: 9, h: 0.5,
    fontSize: 13, fontFace: "Arial",
    color: C.gray, align: "center"
  });

  // 版本标签
  slide3.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 4.1, y: 4.6, w: 1.8, h: 0.45,
    fill: { color: C.primary, transparency: 50 },
    rectRadius: 0.1
  });
  slide3.addText("v10.43", {
    x: 4.1, y: 4.6, w: 1.8, h: 0.45,
    fontSize: 12, fontFace: "Arial",
    color: C.white, align: "center", valign: "middle", margin: 0
  });

  // 输出
  const outPath = "/Users/macmini/shengshi-ppt/projects/ppt-master/output/samples/P2-image-mask.pptx";
  await pptx.writeFile({ fileName: outPath });
  console.log("✅ 已生成:", outPath);
}

generateMaskPPT().catch(e => { console.error("❌ 错误:", e.message); process.exit(1); });
