// PDF 工具箱 - 核心逻辑
// 依赖: PDF.js (全局 pdfjsLib)、pdf-lib (全局 PDFLib)

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ==================== 通用工具函数 ====================

const MB = 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < MB) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / MB).toFixed(2) + ' MB';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
}

// ==================== 工具路由 ====================

let currentTool = null;

document.querySelectorAll('.tool-card').forEach(card => {
  card.addEventListener('click', () => openTool(card.dataset.tool));
});

function openTool(tool) {
  currentTool = tool;
  document.getElementById('toolsGrid').style.display = 'none';
  document.querySelectorAll('.workspace').forEach(w => w.classList.remove('active'));
  const ws = document.getElementById('workspace-' + tool);
  ws.classList.add('active');
  resetTool(tool);
}

function backToTools() {
  document.getElementById('toolsGrid').style.display = '';
  document.querySelectorAll('.workspace').forEach(w => w.classList.remove('active'));
  currentTool = null;
}

function resetTool(tool) {
  const fileList = document.getElementById('fileList-' + tool);
  const result = document.getElementById('result-' + tool);
  const progress = document.getElementById('progress-' + tool);
  if (fileList) fileList.innerHTML = '';
  if (result) result.classList.remove('show');
  if (progress) progress.classList.remove('show');
  // 重置按钮
  const btnMap = {
    merge: 'btnMerge', split: 'btnSplit', compress: 'btnCompress',
    img2pdf: 'btnImg2Pdf', pdf2img: 'btnPdf2Img',
    rotate: 'btnRotate', watermark: 'btnWatermark',
    reorder: 'btnReorder', encrypt: 'btnEncrypt', pdf2word: 'btnPdf2Word', pagenumber: 'btnPageNumber'
  };
  const btn = document.getElementById(btnMap[tool]);
  if (btn) btn.disabled = true;
  // 清空预览
  const preview = document.getElementById('pagePreview-split');
  if (preview) preview.innerHTML = '';
}

// ==================== 拖拽 + 文件选择 ====================

function setupFileInput(tool, accept, multiple, onFiles) {
  const dropZone = document.getElementById('dropZone-' + tool);
  const fileInput = document.getElementById('fileInput-' + tool);

  // 点击
  dropZone.addEventListener('click', () => fileInput.click());

  // 文件选择
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      onFiles(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  // 拖拽
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f =>
      accept.split(',').some(ext => f.name.toLowerCase().endsWith(ext.replace('*', '')) || accept.includes('*'))
    );
    if (files.length > 0) onFiles(files);
  });
}

function renderFileList(tool, files, onRemove, onReorder) {
  const list = document.getElementById('fileList-' + tool);
  list.innerHTML = files.map((f, i) => `
    <div class="file-item" data-index="${i}">
      ${onReorder ? '<span class="file-move" data-dir="up">▲</span><span class="file-move" data-dir="down">▼</span>' : ''}
      <span class="file-name">${f.name}</span>
      <span class="file-size">${formatSize(f.size)}</span>
      <span class="file-remove" data-index="${i}">×</span>
    </div>
  `).join('');

  list.querySelectorAll('.file-remove').forEach(el => el.addEventListener('click', (e) => {
    const idx = parseInt(e.target.dataset.index);
    onRemove(idx);
  }));

  if (onReorder) {
    list.querySelectorAll('.file-move[data-dir="up"]').forEach(el => el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.closest('.file-item').dataset.index);
      if (idx > 0) onReorder(idx, idx - 1);
    }));
    list.querySelectorAll('.file-move[data-dir="down"]').forEach(el => el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.closest('.file-item').dataset.index);
      if (idx < files.length - 1) onReorder(idx, idx + 1);
    }));
  }
}

// ==================== 1. 合并 PDF ====================

(function() {
  let mergeFiles = [];

  setupFileInput('merge', '.pdf', true, (files) => {
    mergeFiles = [...mergeFiles, ...files];
    updateMerge();
  });

  function updateMerge() {
    renderFileList('merge', mergeFiles, (idx) => { mergeFiles.splice(idx, 1); updateMerge(); }, (from, to) => {
      [mergeFiles[from], mergeFiles[to]] = [mergeFiles[to], mergeFiles[from]];
      updateMerge();
    });
    document.getElementById('btnMerge').disabled = mergeFiles.length < 2;
  }

  document.getElementById('btnMerge').addEventListener('click', async () => {
    const btn = document.getElementById('btnMerge');
    const progress = document.getElementById('progress-merge');
    const fill = document.getElementById('progressFill-merge');
    const result = document.getElementById('result-merge');
    const info = document.getElementById('resultInfo-merge');

    btn.disabled = true;
    progress.classList.add('show');
    fill.style.width = '0%';

    try {
      const mergedPdf = await PDFLib.PDFDocument.create();

      for (let i = 0; i < mergeFiles.length; i++) {
        const arr = await mergeFiles[i].arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arr, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
        fill.style.width = ((i + 1) / mergeFiles.length * 100) + '%';
      }

      const bytes = await mergedPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      result.classList.add('show');
      info.innerHTML = `共合并 ${mergeFiles.length} 个文件，输出 ${formatSize(blob.size)}`;
      downloadBlob(blob, 'merged.pdf');
    } catch (err) {
      alert('合并失败：' + err.message);
    } finally {
      btn.disabled = false;
      progress.classList.remove('show');
    }
  });
})();

// ==================== 2. 分割 PDF ====================

(function() {
  let splitFile = null;
  let splitPdfDoc = null;
  let selectedPages = new Set();

  setupFileInput('split', '.pdf', false, async (files) => {
    splitFile = files[0];
    renderFileList('split', [splitFile], (idx) => { splitFile = null; document.getElementById('fileList-split').innerHTML = ''; selectedPages.clear(); document.getElementById('btnSplit').disabled = true; });
    selectedPages.clear();
    document.getElementById('btnSplit').disabled = true;
    document.getElementById('pagePreview-split').innerHTML = '';

    // 加载并渲染预览
    const arr = await splitFile.arrayBuffer();
    splitPdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;
    const preview = document.getElementById('pagePreview-split');

    for (let i = 1; i <= splitPdfDoc.numPages; i++) {
      const page = await splitPdfDoc.getPage(i);
      const scale = 0.3;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.dataset.page = i;
      canvas.title = '第 ' + i + ' 页';
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      canvas.addEventListener('click', () => {
        canvas.classList.toggle('selected');
        if (canvas.classList.contains('selected')) {
          selectedPages.add(i);
        } else {
          selectedPages.delete(i);
        }
        updateSplitBtn();
      });
      preview.appendChild(canvas);
    }
  });

  function updateSplitBtn() {
    const rangeVal = document.getElementById('pageRange').value.trim();
    document.getElementById('btnSplit').disabled = !(selectedPages.size > 0 || rangeVal);
  }

  document.getElementById('pageRange').addEventListener('input', updateSplitBtn);

  function parsePageRange(input, maxPage) {
    const pages = new Set();
    const parts = input.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (start && end) {
          for (let i = Math.max(1, start); i <= Math.min(maxPage, end); i++) pages.add(i);
        }
      } else {
        const n = parseInt(part);
        if (n >= 1 && n <= maxPage) pages.add(n);
      }
    }
    return pages;
  }

  document.getElementById('btnSplit').addEventListener('click', async () => {
    if (!splitFile) return;
    const btn = document.getElementById('btnSplit');
    const progress = document.getElementById('progress-split');
    const fill = document.getElementById('progressFill-split');
    const result = document.getElementById('result-split');
    const info = document.getElementById('resultInfo-split');

    btn.disabled = true;
    progress.classList.add('show');
    fill.style.width = '0%';

    try {
      const arr = await splitFile.arrayBuffer();
      const srcPdf = await PDFLib.PDFDocument.load(arr, { ignoreEncryption: true });
      const totalPages = srcPdf.getPageCount();

      // 合并点击选中的页和范围输入
      let pagesToExtract = new Set(selectedPages);
      const rangeVal = document.getElementById('pageRange').value.trim();
      if (rangeVal) parsePageRange(rangeVal, totalPages).forEach(p => pagesToExtract.add(p));

      if (pagesToExtract.size === 0) {
        alert('请选择要提取的页面');
        return;
      }

      const sortedPages = [...pagesToExtract].sort((a, b) => a - b);
      const newPdf = await PDFLib.PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcPdf, sortedPages.map(p => p - 1));
      copiedPages.forEach(p => newPdf.addPage(p));

      fill.style.width = '100%';
      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      result.classList.add('show');
      info.innerHTML = `提取了 ${sortedPages.length} 页（共 ${totalPages} 页），输出 ${formatSize(blob.size)}`;
      downloadBlob(blob, 'extracted.pdf');
    } catch (err) {
      alert('分割失败：' + err.message);
    } finally {
      btn.disabled = false;
      progress.classList.remove('show');
    }
  });
})();

// ==================== 3. 压缩 PDF ====================

(function() {
  let compressFile = null;
  let compressOrigSize = 0;

  setupFileInput('compress', '.pdf', false, (files) => {
    compressFile = files[0];
    compressOrigSize = files[0].size;
    renderFileList('compress', [compressFile], (idx) => { compressFile = null; document.getElementById('fileList-compress').innerHTML = ''; document.getElementById('btnCompress').disabled = true; });
    document.getElementById('btnCompress').disabled = false;
  });

  document.getElementById('compressQuality').addEventListener('input', (e) => {
    document.getElementById('compressQualityLabel').textContent = e.target.value + '%';
  });

  document.getElementById('btnCompress').addEventListener('click', async () => {
    if (!compressFile) return;
    const btn = document.getElementById('btnCompress');
    const progress = document.getElementById('progress-compress');
    const fill = document.getElementById('progressFill-compress');
    const result = document.getElementById('result-compress');
    const info = document.getElementById('resultInfo-compress');
    const quality = parseInt(document.getElementById('compressQuality').value) / 100;

    btn.disabled = true;
    progress.classList.add('show');
    fill.style.width = '0%';

    try {
      const arr = await compressFile.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(arr, { ignoreEncryption: true });
      const totalPages = pdf.getPageCount();

      // 逐页处理：渲染为图片再嵌入（实现真正压缩）
      const pdfJsDoc = await pdfjsLib.getDocument({ data: arr }).promise;
      const newPdf = await PDFLib.PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfJsDoc.getPage(i);
        const scale = quality * 2; // 质量映射到分辨率
        const viewport = page.getViewport({ scale: Math.max(0.3, scale) });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), c => c.charCodeAt(0));

        // 尝试直接嵌入PDF（pdf-lib支持PNG/JPEG）
        let img;
        try {
          img = await newPdf.embedJpg(jpegBytes);
        } catch {
          img = await newPdf.embedPng(jpegBytes);
        }

        const newPage = newPdf.addPage([page.getViewport({ scale: 1 }).width, page.getViewport({ scale: 1 }).height]);
        newPage.drawImage(img, {
          x: 0, y: 0,
          width: newPage.getWidth(),
          height: newPage.getHeight()
        });

        fill.style.width = (i / totalPages * 100) + '%';
      }

      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const ratio = blob.size < compressOrigSize
        ? ((1 - blob.size / compressOrigSize) * 100).toFixed(1) + '% 减小'
        : '体积未明显减小，可降低质量重试';

      result.classList.add('show');
      info.innerHTML = `原始 ${formatSize(compressOrigSize)} → 压缩后 ${formatSize(blob.size)}（${ratio}）`;
      downloadBlob(blob, 'compressed.pdf');
    } catch (err) {
      alert('压缩失败：' + err.message);
    } finally {
      btn.disabled = false;
      progress.classList.remove('show');
    }
  });
})();

// ==================== 4. 图片转 PDF ====================

(function() {
  let imgFiles = [];

  setupFileInput('img2pdf', '.jpg,.jpeg,.png,.webp,.bmp', true, (files) => {
    imgFiles = [...imgFiles, ...files];
    updateImg2Pdf();
  });

  function updateImg2Pdf() {
    renderFileList('img2pdf', imgFiles, (idx) => { imgFiles.splice(idx, 1); updateImg2Pdf(); }, (from, to) => {
      [imgFiles[from], imgFiles[to]] = [imgFiles[to], imgFiles[from]];
      updateImg2Pdf();
    });
    document.getElementById('btnImg2Pdf').disabled = imgFiles.length === 0;
  }

  document.getElementById('btnImg2Pdf').addEventListener('click', async () => {
    const btn = document.getElementById('btnImg2Pdf');
    const progress = document.getElementById('progress-img2pdf');
    const fill = document.getElementById('progressFill-img2pdf');
    const result = document.getElementById('result-img2pdf');
    const info = document.getElementById('resultInfo-img2pdf');
    const pageSize = document.getElementById('pageSize').value;

    btn.disabled = true;
    progress.classList.add('show');
    fill.style.width = '0%';

    try {
      const pdf = await PDFLib.PDFDocument.create();

      // 预设页面尺寸（pt）
      const pageSizeMap = {
        a4: [595, 842],
        letter: [612, 792],
        auto: null
      };

      for (let i = 0; i < imgFiles.length; i++) {
        const file = imgFiles[i];
        const dataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });

        // 加载图片获取尺寸
        const dims = await new Promise(resolve => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.src = dataUrl;
        });

        let pw, ph;
        if (pageSizeMap[pageSize]) {
          [pw, ph] = pageSizeMap[pageSize];
          // 缩放到适应页面
          const scale = Math.min(pw / dims.width, ph / dims.height);
          pw = dims.width * scale;
          ph = dims.height * scale;
        } else {
          pw = dims.width;
          ph = dims.height;
        }

        const page = pdf.addPage([pw, ph]);

        // 嵌入图片
        const ext = file.name.split('.').pop().toLowerCase();
        const imgBytes = await file.arrayBuffer();

        let embeddedImg;
        if (ext === 'png') {
          embeddedImg = await pdf.embedPng(imgBytes);
        } else {
          // pdf-lib 对 JPEG 要求严格，直接传 ArrayBuffer
          try {
            embeddedImg = await pdf.embedJpg(imgBytes);
          } catch {
            // fallback: 用 canvas 转 PNG
            const img = new Image();
            img.src = dataUrl;
            await new Promise(r => img.onload = r);
            const c = document.createElement('canvas');
            c.width = dims.width;
            c.height = dims.height;
            const cx = c.getContext('2d');
            cx.drawImage(img, 0, 0);
            const pngBuf = Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]), c => c.charCodeAt(0));
            embeddedImg = await pdf.embedPng(pngBuf);
          }
        }

        page.drawImage(embeddedImg, {
          x: 0, y: 0, width: pw, height: ph
        });

        fill.style.width = ((i + 1) / imgFiles.length * 100) + '%';
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      result.classList.add('show');
      info.innerHTML = `已将 ${imgFiles.length} 张图片合成为 PDF，输出 ${formatSize(blob.size)}`;
      downloadBlob(blob, 'images.pdf');
    } catch (err) {
      alert('转换失败：' + err.message);
    } finally {
      btn.disabled = false;
      progress.classList.remove('show');
    }
  });
})();

// ==================== 5. PDF 转图片 ====================

(function() {
  let pdf2imgFile = null;

  setupFileInput('pdf2img', '.pdf', false, (files) => {
    pdf2imgFile = files[0];
    renderFileList('pdf2img', [pdf2imgFile], (idx) => { pdf2imgFile = null; document.getElementById('fileList-pdf2img').innerHTML = ''; document.getElementById('btnPdf2Img').disabled = true; });
    document.getElementById('btnPdf2Img').disabled = false;
  });

  document.getElementById('btnPdf2Img').addEventListener('click', async () => {
    if (!pdf2imgFile) return;
    const btn = document.getElementById('btnPdf2Img');
    const progress = document.getElementById('progress-pdf2img');
    const fill = document.getElementById('progressFill-pdf2img');
    const result = document.getElementById('result-pdf2img');
    const info = document.getElementById('resultInfo-pdf2img');
    const dpi = parseFloat(document.getElementById('imgDpi').value);

    btn.disabled = true;
    progress.classList.add('show');
    fill.style.width = '0%';

    try {
      const arr = await pdf2imgFile.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;
      const totalPages = pdfDoc.numPages;

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: dpi });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const baseName = pdf2imgFile.name.replace(/\.pdf$/i, '');
        downloadDataUrl(canvas.toDataURL('image/png'), `${baseName}-page${i}.png`);

        fill.style.width = (i / totalPages * 100) + '%';
        await new Promise(r => setTimeout(r, 200));
      }

      result.classList.add('show');
      info.innerHTML = `已将 ${totalPages} 页转换为 PNG 图片（${dpi}x），开始自动下载`;
    } catch (err) {
      alert('转换失败：' + err.message);
    } finally {
      btn.disabled = false;
      progress.classList.remove('show');
    }
  });
})();

// ==================== 6. 页面旋转 ====================

(function() {
  let rotateFile = null;
  let rotatePdfDoc = null;
  let rotations = {};

  setupFileInput('rotate', '.pdf', false, async (files) => {
    rotateFile = files[0];
    rotations = {};
    renderFileList('rotate', [rotateFile], (idx) => { rotateFile = null; document.getElementById('fileList-rotate').innerHTML = ''; rotations = {}; document.getElementById('btnRotate').disabled = true; });
    document.getElementById('btnRotate').disabled = true;
    document.getElementById('pagePreview-rotate').innerHTML = '';

    const arr = await rotateFile.arrayBuffer();
    rotatePdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;
    const preview = document.getElementById('pagePreview-rotate');

    for (let i = 1; i <= rotatePdfDoc.numPages; i++) {
      const page = await rotatePdfDoc.getPage(i);
      const scale = 0.25;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.dataset.page = i;
      canvas.title = '第 ' + i + ' 页（点击旋转 90°）';
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      canvas.addEventListener('click', () => {
        rotations[i] = ((rotations[i] || 0) + 90) % 360;
        if (rotations[i] === 0) {
          canvas.classList.remove('rotated');
          canvas.style.transform = '';
          delete rotations[i];
        } else {
          canvas.classList.add('rotated');
          canvas.style.transform = 'rotate(' + rotations[i] + 'deg)';
        }
        document.getElementById('btnRotate').disabled = Object.keys(rotations).length === 0;
      });
      preview.appendChild(canvas);
    }
  });

  document.getElementById('btnRotate').addEventListener('click', async () => {
    if (!rotateFile || Object.keys(rotations).length === 0) return;
    const btn = document.getElementById('btnRotate');
    const progress = document.getElementById('progress-rotate');
    const fill = document.getElementById('progressFill-rotate');
    const result = document.getElementById('result-rotate');
    const info = document.getElementById('resultInfo-rotate');
    btn.disabled = true;
    progress.classList.add('show');
    fill.style.width = '0%';
    try {
      const arr = await rotateFile.arrayBuffer();
      const srcPdf = await PDFLib.PDFDocument.load(arr, { ignoreEncryption: true });
      const totalPages = srcPdf.getPageCount();
      const newPdf = await PDFLib.PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      copiedPages.forEach((p, i) => {
        const deg = rotations[i + 1] || 0;
        if (deg) p.setRotation(PDFLib.degrees(deg));
        newPdf.addPage(p);
      });
      fill.style.width = '100%';
      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const cnt = Object.keys(rotations).length;
      result.classList.add('show');
      info.innerHTML = '已旋转 ' + cnt + ' 页（共 ' + totalPages + ' 页），输出 ' + formatSize(blob.size);
      downloadBlob(blob, 'rotated.pdf');
    } catch (err) { alert('旋转失败：' + err.message); }
    finally { btn.disabled = false; progress.classList.remove('show'); }
  });
})();

// ==================== 7. 添加水印 ====================

(function() {
  let watermarkFile = null;
  let watermarkImageData = null;

  document.getElementById('watermarkType').addEventListener('change', (e) => {
    const isText = e.target.value === 'text';
    document.getElementById('wmTextRow').style.display = isText ? '' : 'none';
    document.getElementById('wmImageRow').style.display = isText ? 'none' : '';
  });
  document.getElementById('watermarkFontSize').addEventListener('input', (e) => {
    e.target.nextElementSibling.textContent = e.target.value + 'px';
  });
  document.getElementById('watermarkOpacity').addEventListener('input', (e) => {
    document.getElementById('watermarkOpacityLabel').textContent = e.target.value + '%';
  });
  document.getElementById('watermarkImageInput').addEventListener('change', async (e) => {
    if (e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => { watermarkImageData = reader.result; };
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  setupFileInput('watermark', '.pdf', false, (files) => {
    watermarkFile = files[0];
    renderFileList('watermark', [watermarkFile], (idx) => { watermarkFile = null; document.getElementById('fileList-watermark').innerHTML = ''; document.getElementById('btnWatermark').disabled = true; });
    document.getElementById('btnWatermark').disabled = false;
  });

  document.getElementById('btnWatermark').addEventListener('click', async () => {
    if (!watermarkFile) return;
    const type = document.getElementById('watermarkType').value;
    if (type === 'image' && !watermarkImageData) { alert('请先选择水印图片'); return; }
    const btn = document.getElementById('btnWatermark');
    const progress = document.getElementById('progress-watermark');
    const fill = document.getElementById('progressFill-watermark');
    const result = document.getElementById('result-watermark');
    const info = document.getElementById('resultInfo-watermark');
    btn.disabled = true; progress.classList.add('show'); fill.style.width = '0%';
    try {
      const arr = await watermarkFile.arrayBuffer();
      const srcPdf = await PDFLib.PDFDocument.load(arr, { ignoreEncryption: true });
      const totalPages = srcPdf.getPageCount();
      const newPdf = await PDFLib.PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      const opacity = parseInt(document.getElementById('watermarkOpacity').value) / 100;
      const angle = parseInt(document.getElementById('watermarkAngle').value);
      const angleRad = PDFLib.degrees(angle);
      let wmImg = null;
      if (type === 'image' && watermarkImageData) {
        const imgBytes = Uint8Array.from(atob(watermarkImageData.split(',')[1]), c => c.charCodeAt(0));
        try { wmImg = await newPdf.embedPng(imgBytes); } catch { wmImg = await newPdf.embedJpg(imgBytes); }
      }
      for (let i = 0; i < copiedPages.length; i++) {
        const pg = newPdf.addPage(copiedPages[i]);
        const pw = pg.getWidth(), ph = pg.getHeight();
        if (type === 'text') {
          const text = document.getElementById('watermarkText').value;
          const fs = parseInt(document.getElementById('watermarkFontSize').value);
          pg.drawText(text, { x: pw / 2 - (text.length * fs * 0.35), y: ph / 2, size: fs, opacity: opacity, rotate: angleRad, color: PDFLib.rgb(0.4, 0.4, 0.4) });
        } else if (wmImg) {
          const iw = pw * 0.4, ih = iw * (wmImg.height / wmImg.width);
          pg.drawImage(wmImg, { x: pw / 2 - iw / 2, y: ph / 2 - ih / 2, width: iw, height: ih, opacity: opacity, rotate: angleRad });
        }
        fill.style.width = ((i + 1) / copiedPages.length * 100) + '%';
      }
      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      result.classList.add('show');
      info.innerHTML = '已为 ' + totalPages + ' 页添加水印，输出 ' + formatSize(blob.size);
      downloadBlob(blob, 'watermarked.pdf');
    } catch (err) { alert('添加水印失败：' + err.message); }
    finally { btn.disabled = false; progress.classList.remove('show'); }
  });
})();

// ==================== 8. 页面排序 ====================

(function() {
  let reorderFile = null;
  let dragSrc = null;

  setupFileInput('reorder', '.pdf', false, async (files) => {
    reorderFile = files[0];
    renderFileList('reorder', [reorderFile], (idx) => { reorderFile = null; document.getElementById('fileList-reorder').innerHTML = ''; document.getElementById('btnReorder').disabled = true; });
    document.getElementById('btnReorder').disabled = true;
    const preview = document.getElementById('pagePreview-reorder');
    preview.innerHTML = '';
    const arr = await reorderFile.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const scale = 0.25;
      const viewport = page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = viewport.width; c.height = viewport.height;
      const ctx = c.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const thumb = document.createElement('div');
      thumb.className = 'page-thumb';
      thumb.draggable = true;
      thumb.dataset.id = i;
      const innerC = document.createElement('canvas');
      innerC.width = c.width; innerC.height = c.height;
      innerC.getContext('2d').drawImage(c, 0, 0);
      const label = document.createElement('span');
      label.className = 'page-number';
      label.textContent = i;
      thumb.appendChild(innerC);
      thumb.appendChild(label);
      thumb.addEventListener('dragstart', (e) => { dragSrc = thumb; e.dataTransfer.effectAllowed = 'move'; thumb.style.opacity = '0.4'; });
      thumb.addEventListener('dragend', () => { thumb.style.opacity = '1'; preview.querySelectorAll('.page-thumb').forEach(t => t.classList.remove('drag-over')); dragSrc = null; });
      thumb.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; thumb.classList.add('drag-over'); });
      thumb.addEventListener('dragleave', () => thumb.classList.remove('drag-over'));
      thumb.addEventListener('drop', (e) => {
        e.preventDefault(); thumb.classList.remove('drag-over');
        if (dragSrc !== thumb) {
          const children = [...preview.children];
          const toIdx = children.indexOf(thumb);
          if (children.indexOf(dragSrc) < toIdx) preview.insertBefore(dragSrc, thumb.nextSibling);
          else preview.insertBefore(dragSrc, thumb);
          document.getElementById('btnReorder').disabled = false;
        }
      });
      preview.appendChild(thumb);
    }
    document.getElementById('btnReorder').disabled = false;
  });

  document.getElementById('btnReorder').addEventListener('click', async () => {
    if (!reorderFile) return;
    const btn = document.getElementById('btnReorder');
    const progress = document.getElementById('progress-reorder');
    const fill = document.getElementById('progressFill-reorder');
    const result = document.getElementById('result-reorder');
    const info = document.getElementById('resultInfo-reorder');
    btn.disabled = true; progress.classList.add('show'); fill.style.width = '0%';
    try {
      const arr = await reorderFile.arrayBuffer();
      const srcPdf = await PDFLib.PDFDocument.load(arr, { ignoreEncryption: true });
      const newPdf = await PDFLib.PDFDocument.create();
      const preview = document.getElementById('pagePreview-reorder');
      const newOrder = [...preview.querySelectorAll('.page-thumb')].map(t => parseInt(t.dataset.id) - 1);
      const copiedPages = await newPdf.copyPages(srcPdf, newOrder);
      copiedPages.forEach(p => newPdf.addPage(p));
      fill.style.width = '100%';
      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      result.classList.add('show');
      info.innerHTML = '已按新顺序排列 ' + newOrder.length + ' 页，输出 ' + formatSize(blob.size);
      downloadBlob(blob, 'reordered.pdf');
    } catch (err) { alert('排序失败：' + err.message); }
    finally { btn.disabled = false; progress.classList.remove('show'); }
  });
})();

// ==================== 9. PDF 加密 ====================

(function() {
  let encryptFile = null;

  document.getElementById('encryptPassword').addEventListener('input', updateEncryptBtn);
  document.getElementById('encryptPasswordConfirm').addEventListener('input', updateEncryptBtn);
  function updateEncryptBtn() {
    const pw = document.getElementById('encryptPassword').value;
    const pw2 = document.getElementById('encryptPasswordConfirm').value;
    document.getElementById('btnEncrypt').disabled = !encryptFile || !pw || pw !== pw2;
  }

  setupFileInput('encrypt', '.pdf', false, (files) => {
    encryptFile = files[0];
    renderFileList('encrypt', [encryptFile], (idx) => { encryptFile = null; document.getElementById('fileList-encrypt').innerHTML = ''; document.getElementById('btnEncrypt').disabled = true; });
    updateEncryptBtn();
  });

  document.getElementById('btnEncrypt').addEventListener('click', async () => {
    if (!encryptFile) return;
    const pw = document.getElementById('encryptPassword').value;
    const pw2 = document.getElementById('encryptPasswordConfirm').value;
    if (pw !== pw2) { alert('两次输入的密码不一致'); return; }
    const btn = document.getElementById('btnEncrypt');
    const progress = document.getElementById('progress-encrypt');
    const fill = document.getElementById('progressFill-encrypt');
    const result = document.getElementById('result-encrypt');
    const info = document.getElementById('resultInfo-encrypt');
    btn.disabled = true; progress.classList.add('show'); fill.style.width = '0%';
    try {
      const arr = await encryptFile.arrayBuffer();
      const srcPdf = await PDFLib.PDFDocument.load(arr, { ignoreEncryption: true });
      const bytes = await srcPdf.save({ userPassword: pw, ownerPassword: pw + '_owner' });
      fill.style.width = '100%';
      const blob = new Blob([bytes], { type: 'application/pdf' });
      result.classList.add('show');
      info.innerHTML = '已加密，打开时需要输入密码';
      downloadBlob(blob, 'encrypted.pdf');
    } catch (err) { alert('加密失败：' + err.message); }
    finally { btn.disabled = false; progress.classList.remove('show'); }
  });
})();

// ==================== 10. PDF 转 Word ====================

(function() {
  let pdf2wordFile = null;

  setupFileInput('pdf2word', '.pdf', false, (files) => {
    pdf2wordFile = files[0];
    renderFileList('pdf2word', [pdf2wordFile], (idx) => { pdf2wordFile = null; document.getElementById('fileList-pdf2word').innerHTML = ''; document.getElementById('btnPdf2Word').disabled = true; });
    document.getElementById('btnPdf2Word').disabled = false;
  });

  document.getElementById('btnPdf2Word').addEventListener('click', async () => {
    if (!pdf2wordFile) return;
    const btn = document.getElementById('btnPdf2Word');
    const progress = document.getElementById('progress-pdf2word');
    const fill = document.getElementById('progressFill-pdf2word');
    const result = document.getElementById('result-pdf2word');
    const info = document.getElementById('resultInfo-pdf2word');

    btn.disabled = true;
    progress.classList.add('show');
    fill.style.width = '0%';

    try {
      const arr = await pdf2wordFile.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;
      const totalPages = pdfDoc.numPages;
      const pageContents = [];

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;

        // 按 y 坐标降序排列（从上到下），同 y 按 x 升序（从左到右）
        const sorted = [...items].sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5];
          if (Math.abs(yDiff) > 2) return yDiff;
          return a.transform[4] - b.transform[4];
        });

        // 将文本项按行分组（y 坐标相近的属于同一行）
        const lines = [];
        let currentLine = { y: sorted.length > 0 ? sorted[0].transform[5] : 0, texts: [] };
        for (const item of sorted) {
          const str = item.str;
          if (!str || !str.trim()) continue;
          if (Math.abs(item.transform[5] - currentLine.y) > 3) {
            if (currentLine.texts.length > 0) lines.push(currentLine);
            currentLine = { y: item.transform[5], texts: [] };
          }
          currentLine.texts.push(str);
        }
        if (currentLine.texts.length > 0) lines.push(currentLine);

        // 将行合并为段落（检测行间距变化判断段落边界）
        const paragraphs = [];
        let currentPara = [];
        let prevY = null;
        let prevLineHeight = null;

        for (const line of lines) {
          const lineText = line.texts.join(' ');
          if (prevY !== null) {
            const gap = prevY - line.y;
            if (prevLineHeight && gap > prevLineHeight * 1.6) {
              paragraphs.push(currentPara.join(' '));
              currentPara = [];
            }
          }
          currentPara.push(lineText);
          prevLineHeight = prevY !== null ? prevY - line.y : null;
          prevY = line.y;
        }
        if (currentPara.length > 0) paragraphs.push(currentPara.join(' '));

        pageContents.push({ pageNum: i, paragraphs });
        fill.style.width = (i / totalPages * 100) + '%';
      }

      // 构建 HTML 文档
      const baseName = pdf2wordFile.name.replace(/\.pdf$/i, '');
      const htmlParts = [];
      htmlParts.push('<html xmlns:o="urn:schemas-microsoft-com:office:office"');
      htmlParts.push(' xmlns:w="urn:schemas-microsoft-com:office:word"');
      htmlParts.push(' xmlns="http://www.w3.org/TR/REC-html40">');
      htmlParts.push('<head><meta charset="UTF-8">');
      htmlParts.push('<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">');
      htmlParts.push('<title>' + baseName + '</title>');
      htmlParts.push('<style>');
      htmlParts.push('  body { font-family: "Microsoft YaHei", "SimSun", sans-serif; font-size: 14px; line-height: 1.8; color: #333; padding: 40px; }');
      htmlParts.push('  h2 { font-size: 18px; border-bottom: 2px solid #4472C4; padding-bottom: 6px; margin-top: 24px; }');
      htmlParts.push('  p { margin: 8px 0; text-indent: 2em; }');
      htmlParts.push('</style></head><body>');
      htmlParts.push('<h1 style="text-align:center;">' + baseName + '</h1>');

      for (const pc of pageContents) {
        htmlParts.push('<h2>第 ' + pc.pageNum + ' 页</h2>');
        for (const para of pc.paragraphs) {
          htmlParts.push('<p>' + escapeHtml(para) + '</p>');
        }
        if (pc.pageNum < totalPages) {
          htmlParts.push('<br style="page-break-after:always;">');
        }
      }

      htmlParts.push('</body></html>');

      const htmlContent = htmlParts.join('\n');
      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=UTF-8' });
      const filename = baseName + '.doc';

      result.classList.add('show');
      info.innerHTML = `已将 ${totalPages} 页转换为 Word 文档，输出 ${formatSize(blob.size)}`;
      downloadBlob(blob, filename);
    } catch (err) {
      alert('转换失败：' + err.message);
    } finally {
      btn.disabled = false;
      progress.classList.remove('show');
    }
  });

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();

// ==================== 11. 添加页码 ====================

(function() {
  let pageNumFile = null;

  setupFileInput('pagenumber', '.pdf', false, (files) => {
    pageNumFile = files[0];
    renderFileList('pagenumber', [pageNumFile], (idx) => {
      pageNumFile = null;
      document.getElementById('fileList-pagenumber').innerHTML = '';
      document.getElementById('btnPageNumber').disabled = true;
    });
    document.getElementById('btnPageNumber').disabled = false;
  });

  document.getElementById('btnPageNumber').addEventListener('click', async () => {
    if (!pageNumFile) return;
    const btn = document.getElementById('btnPageNumber');
    const progress = document.getElementById('progress-pagenumber');
    const fill = document.getElementById('progressFill-pagenumber');
    const result = document.getElementById('result-pagenumber');
    const info = document.getElementById('resultInfo-pagenumber');

    const position = document.getElementById('pageNumPosition').value;
    const startNum = parseInt(document.getElementById('pageNumStart').value) || 1;
    const fontSize = parseInt(document.getElementById('pageNumFontSize').value) || 12;
    const format = document.getElementById('pageNumFormat').value;

    btn.disabled = true;
    progress.classList.add('show');
    fill.style.width = '0%';

    try {
      const arr = await pageNumFile.arrayBuffer();
      const srcPdf = await PDFLib.PDFDocument.load(arr, { ignoreEncryption: true });
      const totalPages = srcPdf.getPageCount();
      const newPdf = await PDFLib.PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      const font = await newPdf.embedFont(PDFLib.StandardFonts.Helvetica);

      for (let i = 0; i < copiedPages.length; i++) {
        const pg = newPdf.addPage(copiedPages[i]);
        const [pw, ph] = pg.getSize();
        const pageNum = startNum + i;

        let text;
        if (format === 'pageX') {
          text = '第' + pageNum + '页';
        } else if (format === 'X/Y') {
          text = pageNum + ' / ' + (startNum + totalPages - 1);
        } else {
          text = String(pageNum);
        }

        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const margin = 36;
        let x, y;

        const posMap = {
          'bottom-center': { x: (pw - textWidth) / 2, y: margin },
          'bottom-right':  { x: pw - textWidth - margin, y: margin },
          'top-center':    { x: (pw - textWidth) / 2, y: ph - margin - fontSize },
          'top-right':     { x: pw - textWidth - margin, y: ph - margin - fontSize }
        };

        const coords = posMap[position] || posMap['bottom-center'];
        x = coords.x;
        y = coords.y;

        pg.drawText(text, {
          x, y,
          size: fontSize,
          font: font,
          color: PDFLib.rgb(0.3, 0.3, 0.3)
        });

        fill.style.width = ((i + 1) / copiedPages.length * 100) + '%';
      }

      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      result.classList.add('show');
      info.innerHTML = '已为 ' + totalPages + ' 页添加页码（起始 ' + startNum + '），输出 ' + formatSize(blob.size);
      downloadBlob(blob, 'numbered.pdf');
    } catch (err) {
      alert('添加页码失败：' + err.message);
    } finally {
      btn.disabled = false;
      progress.classList.remove('show');
    }
  });
})();
