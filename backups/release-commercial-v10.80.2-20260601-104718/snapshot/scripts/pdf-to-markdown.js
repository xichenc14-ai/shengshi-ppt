#!/usr/bin/env node
/**
 * PDF to Markdown converter
 * Uses pdfjs-dist from shengshi-ppt node_modules
 * 
 * Usage: node pdf-to-markdown.js <input.pdf> <output.md>
 */

const fs = require('fs');
const path = require('path');

// Dynamically resolve pdfjs-dist from shengshi-ppt
const shengxinNodeModules = '/Users/macmini/shengshi-ppt/node_modules';

async function convertPdfToMarkdown(pdfPath, outputPath) {
  console.log(`📄 Reading: ${pdfPath}`);
  
  const pdfjsLib = await import(path.join(shengxinNodeModules, 'pdfjs-dist/legacy/build/pdf.mjs'));
  
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  
  const numPages = pdf.numPages;
  console.log(`📖 Total pages: ${numPages}`);
  
  let fullText = '';
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    fullText += `\n## Page ${i}\n\n${pageText}\n`;
    
    if (i % 10 === 0 || i === numPages) {
      console.log(`  Processed ${i}/${numPages} pages...`);
    }
  }
  
  const markdown = `# ${path.basename(pdfPath, '.pdf')}\n\n_Converted from PDF on ${new Date().toLocaleString('zh-CN')}_\n\n${fullText}\n`;
  
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`✅ Saved: ${outputPath}`);
  console.log(`   Total characters: ${markdown.length}`);
  
  return { pages: numPages, chars: markdown.length };
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node pdf-to-markdown.js <input.pdf> <output.md>');
  process.exit(1);
}

const [inputPdf, outputMd] = args;

if (!fs.existsSync(inputPdf)) {
  console.error(`❌ File not found: ${inputPdf}`);
  process.exit(1);
}

convertPdfToMarkdown(inputPdf, outputMd)
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
