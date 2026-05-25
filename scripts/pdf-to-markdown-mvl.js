#!/usr/bin/env node
/**
 * PDF → PNG Images → OCR via MiniMax Vision
 * 
 * Step 1: Render PDF pages to PNG images
 * Step 2: Use MiniMax__understand_image to extract text from each page
 * Step 3: Merge into single Markdown
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const SHENGXIN_NODE_MODULES = '/Users/macmini/shengshi-ppt/node_modules';

// --- Step 1: Try to render PDF page to PNG using pdfjs-dist ---
async function renderPageToPng(pdfPath, pageNum, outputPngPath) {
  const pdfjsLib = require(path.join(SHENGXIN_NODE_MODULES, 'pdfjs-dist/legacy/build/pdf.js'));
  
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(pageNum);
  
  const scale = 2.5; // Higher scale = clearer text for OCR
  const viewport = page.getViewport({ scale });
  
  // Try using node-canvas first, fallback to svg-based approach
  try {
    const { createCanvas } = require(path.join(SHENGXIN_NODE_MODULES, 'canvas'));
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPngPath, buffer);
    return true;
  } catch (e) {
    // node-canvas not available, try svg fallback
    console.log(`  canvas not available: ${e.message}`);
    return false;
  }
}

// --- Step 1b: Use pdftoppm (ImageMagick/system) as fallback ---
function renderPageWithPdftoppm(pdfPath, pageNum, outputPngPath) {
  try {
    const cmd = `pdftoppm -r 200 -f ${pageNum} -l ${pageNum} -png "${pdfPath}" "${outputPngPath.replace('.png', '')}"`;
    execSync(cmd, { shell: '/bin/bash' });
    // pdftoppm outputs as {basename}-{pagenum}.1.png, rename
    const dir = path.dirname(outputPngPath);
    const base = path.basename(outputPngPath, '.png');
    const generated = path.join(dir, `${base}-${pageNum}.1.png`);
    if (fs.existsSync(generated)) {
      fs.renameSync(generated, outputPngPath);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// --- Step 2: Extract text from image using MiniMax vision API ---
async function extractTextFromImage(imagePath, apiKey) {
  const { spawn } = require('child_process');
  
  const curlCmd = [
    'curl', '-s', '-X', 'POST',
    'https://api.minimax.chat/v1/files/Content理解',
    '-H', `Authorization: Bearer ${apiKey}`,
    '-F', `file=@${imagePath}`,
    '-F', `model=mini-max-vl-01`,
    '-F', `prompt=请提取这张图片中的所有文字内容，保持原有结构和格式，以 Markdown 格式输出。`
  ];
  
  return new Promise((resolve, reject) => {
    const proc = spawn(curlCmd[0], curlCmd.slice(1));
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code !== 0) reject(new Error(stderr || `exit ${code}`));
      else resolve(stdout);
    });
  });
}

// Alternative: use MiniMax image understanding MCP tool via subagent call
// This is the preferred approach - use MiniMax__understand_image tool

// --- Quick check: is this PDF text-based or scan? ---
async function checkPdfTextContent(pdfPath) {
  const pdfjsLib = require(path.join(SHENGXIN_NODE_MODULES, 'pdfjs-dist/legacy/build/pdf.js'));
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  
  let totalChars = 0;
  for (let i = 1; i <= Math.min(5, pdf.numPages); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join('');
    totalChars += text.length;
  }
  
  const avgPerPage = totalChars / Math.min(5, pdf.numPages);
  return { totalChars, avgPerPage, numPages: pdf.numPages };
}

// Main
async function main() {
  const pdfPath = process.argv[2];
  const outputMdPath = process.argv[3];
  
  if (!pdfPath || !outputMdPath) {
    console.error('Usage: node pdf-to-markdown-mvl.js <input.pdf> <output.md>');
    process.exit(1);
  }
  
  console.log(`\n📄 PDF OCR: ${path.basename(pdfPath)}`);
  
  // Check text content
  console.log('🔍 Checking if PDF is text-based or scan...');
  const { totalChars, avgPerPage, numPages } = await checkPdfTextContent(pdfPath);
  console.log(`   Pages: ${numPages}, Avg chars/page (sample 5): ${avgPerPage.toFixed(1)}`);
  
  const isTextBased = avgPerPage > 500; // > 500 chars/page = likely text-based
  
  if (isTextBased) {
    console.log('✅ PDF appears to be text-based, using pdfjs-dist text extraction');
    // Fall back to text extraction
    const pdfjsLib = require(path.join(SHENGXIN_NODE_MODULES, 'pdfjs-dist/legacy/build/pdf.js'));
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join('').replace(/\s+/g, ' ').trim();
      fullText += `\n## Page ${i}\n\n${pageText}\n`;
    }
    const markdown = `# ${path.basename(pdfPath, '.pdf')}\n\n_Converted: ${new Date().toLocaleString('zh-CN')}_\n\n${fullText}\n`;
    fs.writeFileSync(outputMdPath, markdown);
    console.log(`✅ Done! Saved to: ${outputMdPath}`);
    console.log(`   Total pages: ${numPages}, Total chars: ${markdown.length}`);
    process.exit(0);
  } else {
    console.log('⚠️ PDF appears to be scan-based, needs OCR via MiniMax Vision');
    console.log('   Please use the MiniMax__understand_image tool on each page image');
    console.log(`   PDF pages: ${numPages}`);
    
    // Create temp dir for page images
    const tmpDir = `/tmp/pdf-pages-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    
    console.log(`\n📁 Temp dir: ${tmpDir}`);
    console.log('🖼️  Converting pages to images...');
    
    for (let i = 1; i <= numPages; i++) {
      const pngPath = path.join(tmpDir, `page-${String(i).padStart(3, '0')}.png`);
      const pageNum = i;
      
      let success = await renderPageToPng(pdfPath, pageNum, pngPath);
      if (!success) {
        success = renderPageWithPdftoppm(pdfPath, pageNum, pngPath);
      }
      
      if (success) {
        const size = fs.statSync(pngPath).size;
        console.log(`  Page ${i}/${numPages}: ✅ (${(size/1024).toFixed(0)}KB)`);
      } else {
        console.log(`  Page ${i}/${numPages}: ❌ (render failed)`);
      }
    }
    
    console.log(`\n✅ Image conversion complete: ${tmpDir}`);
    console.log(`📝 Next: Use MiniMax__understand_image to extract text from each PNG`);
    console.log(`   Image files: ${tmpDir}/page-001.png ... page-${String(numPages).padStart(3, '0')}.png`);
    
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
