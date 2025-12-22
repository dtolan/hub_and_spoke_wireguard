# PDF Generation Instructions

This directory contains the architecture documentation in Markdown format with embedded Mermaid diagrams. To generate a professional PDF for presentation, follow one of the methods below.

## Files Included

- **ARCHITECTURE_GUIDE_PRESENTATION.md**: Main architecture document (76 pages)
- **diagrams/*.mmd**: Six Mermaid diagram files

## Method 1: Using Typora (Recommended - Windows/Mac/Linux)

**Typora** is a Markdown editor with excellent PDF export capabilities and native Mermaid support.

### Steps:

1. **Download Typora**: https://typora.io/ (free trial available)

2. **Open the document**:
   - Launch Typora
   - Open `docs/ARCHITECTURE_GUIDE_PRESENTATION.md`

3. **Configure export settings**:
   - File → Preferences → Export
   - PDF: Enable "Use System Print Dialog"
   - Margins: Set to 0.5 inches all sides

4. **Export to PDF**:
   - File → Export → PDF
   - Choose location and filename
   - Click "Export"

**Advantages**: Native Mermaid rendering, professional formatting, easy to use

## Method 2: Using Pandoc + Mermaid Filter (Command Line)

**Pandoc** is a universal document converter with excellent PDF generation capabilities.

### Prerequisites:

```bash
# Install Pandoc
# Windows (via Chocolatey):
choco install pandoc

# macOS:
brew install pandoc

# Linux:
sudo apt install pandoc

# Install LaTeX (required for PDF generation)
# Windows: https://miktex.org/download
# macOS: brew install --cask mactex
# Linux: sudo apt install texlive-full

# Install mermaid-filter
npm install -g mermaid-filter
```

### Steps:

```bash
cd docs

# Generate PDF with Mermaid diagrams
pandoc ARCHITECTURE_GUIDE_PRESENTATION.md \
  -o ARCHITECTURE_GUIDE.pdf \
  --pdf-engine=xelatex \
  --filter=mermaid-filter \
  --toc \
  --toc-depth=2 \
  -V geometry:margin=1in \
  -V fontsize=11pt \
  -V documentclass=report \
  -V papersize=letter \
  --highlight-style=tango

echo "PDF generated: ARCHITECTURE_GUIDE.pdf"
```

**Advantages**: Fully automated, scriptable, professional LaTeX output

## Method 3: Using Visual Studio Code + Markdown PDF Extension

### Steps:

1. **Install Extension**:
   - Open VSCode
   - Install "Markdown PDF" extension by yzane

2. **Configure Extension** (Settings → Extensions → Markdown PDF):
   - Enable "Display header and footer"
   - Set margin: 1cm all sides

3. **Install mermaid-cli** (for diagram rendering):
   ```bash
   npm install -g @mermaid-js/mermaid-cli
   ```

4. **Generate PDF**:
   - Open `ARCHITECTURE_GUIDE_PRESENTATION.md` in VSCode
   - Right-click in editor
   - Select "Markdown PDF: Export (pdf)"

**Note**: Mermaid diagrams may not render automatically. You may need to:
1. Generate diagram images first: `mmdc -i diagrams/system-architecture.mmd -o diagrams/system-architecture.png`
2. Update markdown to reference PNG images instead of .mmd files

## Method 4: Online Tools (Quick Option)

### Option A: Mermaid Live Editor + Print to PDF

1. **Render diagrams**:
   - Visit https://mermaid.live/
   - Paste each diagram from `diagrams/*.mmd`
   - Export as SVG or PNG

2. **Combine with document**:
   - Replace Mermaid references in markdown with image links
   - Upload to online Markdown to PDF converter:
     - https://www.markdowntopdf.com/
     - https://md2pdf.netlify.app/

### Option B: GitBook + Print

1. Create temporary GitBook from markdown
2. Use browser Print → Save as PDF
3. Good formatting, but requires manual setup

## Method 5: Using Node.js Script (Automated)

We can create a custom Node.js script using `puppeteer` and `markdown-it` with `mermaid` plugin.

### Install Dependencies:

```bash
npm install --save-dev puppeteer markdown-it markdown-it-mermaid
```

### Generate PDF:

```bash
node scripts/generate-pdf.js
```

(See `scripts/generate-pdf.js` for implementation - not yet created)

## Recommended Workflow

**For Chief Architect Review**:

1. Use **Typora** (Method 1) for quick, high-quality PDF with minimal setup
2. Export with default settings
3. Review PDF, adjust margins if needed
4. Final export

**For Automated CI/CD**:

1. Use **Pandoc** (Method 2) in build pipeline
2. Script the PDF generation
3. Archive PDFs with version tags

## Diagram Rendering

All six Mermaid diagrams are referenced in the markdown:

- `diagrams/system-architecture.mmd` - Component architecture
- `diagrams/deployment-architecture.mmd` - Production deployment
- `diagrams/spoke-provisioning-sequence.mmd` - Provisioning flow
- `diagrams/database-erd.mmd` - Database schema
- `diagrams/security-model.mmd` - Security architecture
- `diagrams/proxmox-cluster-architecture.mmd` - Proxmox topology

**Rendering Options**:

1. **Automatic** (Typora, Pandoc with filter): Diagrams render inline
2. **Manual** (VSCode, online tools): Convert .mmd to .png first using:
   ```bash
   npx mmdc -i diagrams/system-architecture.mmd -o diagrams/system-architecture.png
   ```

## Expected Output

**PDF Specifications**:
- **Page Count**: ~80-85 pages (with diagrams)
- **File Size**: 2-5 MB (depending on diagram resolution)
- **Format**: Letter (8.5" x 11") or A4
- **Fonts**: Professional (Times New Roman, Arial, or similar)
- **Table of Contents**: 2 levels deep
- **Headers/Footers**: Page numbers, document title

## Troubleshooting

### Diagrams not rendering

**Issue**: Mermaid diagrams show as code blocks instead of rendered diagrams

**Solution**:
1. Ensure mermaid-filter is installed: `npm install -g mermaid-filter`
2. For Pandoc, verify filter is in PATH: `which mermaid-filter`
3. Manually convert to images if automatic rendering fails

### PDF too large

**Issue**: PDF file size exceeds 10 MB

**Solution**:
1. Reduce diagram resolution: `mmdc -i input.mmd -o output.png -w 800`
2. Use SVG instead of PNG for diagrams
3. Compress PDF: `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -o compressed.pdf input.pdf`

### Fonts missing in PDF

**Issue**: Special characters or fonts not displaying correctly

**Solution**:
1. For Pandoc: Use XeLaTeX engine (`--pdf-engine=xelatex`)
2. Install missing fonts on system
3. Specify font explicitly: `-V mainfont="Arial"`

## Contact

For issues with PDF generation, contact the development team or file an issue in the repository.

---

**Last Updated**: December 22, 2025
