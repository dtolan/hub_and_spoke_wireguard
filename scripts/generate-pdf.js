#!/usr/bin/env node

/**
 * PDF Generation Script for Architecture Guide
 *
 * This script converts the Architecture Guide markdown with embedded Mermaid diagrams
 * into a professional PDF document using Puppeteer and markdown-it.
 *
 * Usage:
 *   node scripts/generate-pdf.js
 *
 * Requirements:
 *   npm install puppeteer markdown-it
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'
import MarkdownIt from 'markdown-it'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const CONFIG = {
  inputFile: path.join(__dirname, '../docs/ARCHITECTURE_GUIDE_PRESENTATION.md'),
  outputFile: path.join(__dirname, '../docs/ARCHITECTURE_GUIDE.pdf'),
  cssFile: path.join(__dirname, './pdf-styles.css'),
  pageFormat: 'Letter',
  margin: {
    top: '0.75in',
    right: '0.75in',
    bottom: '0.75in',
    left: '0.75in'
  }
}

// Initialize markdown-it
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false
})

// CSS for professional PDF styling
const CSS = `
@page {
  size: Letter;
  margin: 0.75in;
}

* {
  box-sizing: border-box;
}

body {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #333;
  max-width: 100%;
  margin: 0;
  padding: 0;
}

h1 {
  font-size: 24pt;
  font-weight: bold;
  color: #1a1a1a;
  margin-top: 24pt;
  margin-bottom: 12pt;
  page-break-before: auto;
  page-break-after: avoid;
  border-bottom: 2pt solid #2c3e50;
  padding-bottom: 6pt;
}

h2 {
  font-size: 18pt;
  font-weight: bold;
  color: #2c3e50;
  margin-top: 18pt;
  margin-bottom: 10pt;
  page-break-after: avoid;
  border-bottom: 1pt solid #95a5a6;
  padding-bottom: 4pt;
}

h3 {
  font-size: 14pt;
  font-weight: bold;
  color: #34495e;
  margin-top: 14pt;
  margin-bottom: 8pt;
  page-break-after: avoid;
}

h4 {
  font-size: 12pt;
  font-weight: bold;
  color: #555;
  margin-top: 12pt;
  margin-bottom: 6pt;
}

p {
  margin-bottom: 10pt;
  text-align: justify;
  orphans: 3;
  widows: 3;
}

code {
  font-family: 'Courier New', monospace;
  font-size: 9pt;
  background-color: #f4f4f4;
  padding: 2pt 4pt;
  border-radius: 2pt;
  color: #c7254e;
}

pre {
  background-color: #f8f8f8;
  border: 1pt solid #ddd;
  border-radius: 4pt;
  padding: 10pt;
  overflow-x: auto;
  margin: 10pt 0;
  page-break-inside: avoid;
}

pre code {
  background-color: transparent;
  padding: 0;
  color: #333;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 12pt 0;
  font-size: 10pt;
  page-break-inside: avoid;
}

th {
  background-color: #2c3e50;
  color: white;
  font-weight: bold;
  padding: 8pt;
  text-align: left;
  border: 1pt solid #ddd;
}

td {
  padding: 6pt 8pt;
  border: 1pt solid #ddd;
}

tr:nth-child(even) {
  background-color: #f9f9f9;
}

ul, ol {
  margin: 10pt 0;
  padding-left: 24pt;
}

li {
  margin-bottom: 4pt;
}

blockquote {
  border-left: 4pt solid #2c3e50;
  padding-left: 12pt;
  margin: 12pt 0;
  color: #555;
  font-style: italic;
}

a {
  color: #2980b9;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Mermaid diagram styling */
.mermaid {
  display: block;
  text-align: center;
  margin: 16pt 0;
  page-break-inside: avoid;
}

.mermaid svg {
  max-width: 100%;
  height: auto;
}

/* Table of contents */
.toc-container {
  background-color: #ecf0f1;
  padding: 16pt;
  margin: 20pt 0;
  border-radius: 4pt;
  page-break-inside: avoid;
}

.toc-container h2 {
  margin-top: 0;
  border-bottom: none;
}

.table-of-contents {
  list-style: none;
  padding-left: 0;
}

.table-of-contents li {
  margin-bottom: 4pt;
}

.table-of-contents a {
  color: #2c3e50;
}

/* Cover page styling */
.cover-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  text-align: center;
  page-break-after: always;
}

.cover-page h1 {
  font-size: 32pt;
  border-bottom: none;
  margin-bottom: 8pt;
}

.cover-page .subtitle {
  font-size: 18pt;
  color: #7f8c8d;
  margin-bottom: 32pt;
}

.cover-page .metadata {
  font-size: 12pt;
  color: #95a5a6;
  margin-top: 32pt;
}

/* Page numbers (handled by Puppeteer) */
@media print {
  .page-number {
    position: fixed;
    bottom: 0;
    right: 0;
    font-size: 10pt;
    color: #7f8c8d;
  }
}

/* Avoid page breaks inside certain elements */
figure, .code-block, .diagram, .table-container {
  page-break-inside: avoid;
}

/* Print optimizations */
@media print {
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
  }

  img {
    max-width: 100%;
    page-break-inside: avoid;
  }
}
`

/**
 * Read markdown file
 */
function readMarkdown() {
  console.log(`Reading markdown file: ${CONFIG.inputFile}`)
  return fs.readFileSync(CONFIG.inputFile, 'utf-8')
}

/**
 * Convert markdown to HTML
 */
function convertToHTML(markdown) {
  console.log('Converting markdown to HTML...')

  // Replace diagram references with inline Mermaid blocks
  // Pattern: ![Diagram Title](diagrams/filename.mmd)
  const processedMarkdown = markdown.replace(
    /!\[([^\]]+)\]\(diagrams\/([^)]+\.mmd)\)/g,
    (match, title, filename) => {
      const diagramPath = path.join(__dirname, '../docs/diagrams', filename)
      if (fs.existsSync(diagramPath)) {
        const diagramContent = fs.readFileSync(diagramPath, 'utf-8')
        return `\n\n\`\`\`mermaid\n${diagramContent}\n\`\`\`\n\n**Figure: ${title}**\n\n`
      } else {
        console.warn(`Warning: Diagram file not found: ${diagramPath}`)
        return `\n\n**[Diagram: ${title}]**\n\n*(Diagram file not found: ${filename})*\n\n`
      }
    }
  )

  const html = md.render(processedMarkdown)
  return html
}

/**
 * Create full HTML document
 */
function createHTMLDocument(bodyHTML) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hub-and-Spoke WireGuard VPN - Architecture Guide</title>
  <style>${CSS}</style>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true
      }
    });
  </script>
</head>
<body>
  ${bodyHTML}
</body>
</html>
  `
}

/**
 * Generate PDF using Puppeteer
 */
async function generatePDF(htmlContent) {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    console.log('Loading HTML content...')
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 60000
    })

    // Wait for Mermaid diagrams to render
    console.log('Waiting for Mermaid diagrams to render...')
    await page.waitForTimeout(5000) // Give Mermaid time to render all diagrams

    console.log('Generating PDF...')
    await page.pdf({
      path: CONFIG.outputFile,
      format: CONFIG.pageFormat,
      margin: CONFIG.margin,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 9pt; color: #95a5a6; margin: 0 auto; width: 100%; text-align: center;">
          Hub-and-Spoke WireGuard VPN - Architecture Guide
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 9pt; color: #95a5a6; margin: 0 auto; width: 100%; text-align: center;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `
    })

    console.log(`✓ PDF generated successfully: ${CONFIG.outputFile}`)

    // Get file size
    const stats = fs.statSync(CONFIG.outputFile)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    console.log(`  File size: ${fileSizeMB} MB`)

  } catch (error) {
    console.error('Error generating PDF:', error)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== PDF Generation Started ===\n')

  try {
    // Read markdown
    const markdown = readMarkdown()

    // Convert to HTML
    const bodyHTML = convertToHTML(markdown)

    // Create full HTML document
    const fullHTML = createHTMLDocument(bodyHTML)

    // Optional: Save HTML for debugging
    const htmlPath = CONFIG.outputFile.replace('.pdf', '.html')
    fs.writeFileSync(htmlPath, fullHTML)
    console.log(`HTML file saved for debugging: ${htmlPath}\n`)

    // Generate PDF
    await generatePDF(fullHTML)

    console.log('\n=== PDF Generation Completed ===')
    console.log(`\nOutput file: ${CONFIG.outputFile}`)
    console.log('\nYou can now share this PDF with the chief architect for review.')

  } catch (error) {
    console.error('\n=== PDF Generation Failed ===')
    console.error(error)
    process.exit(1)
  }
}

// Run the main function
main()
