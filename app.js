/* ============================================================
   PDFvault — client-side PDF toolkit
   All processing happens in the browser via pdf-lib, pdf.js, jsPDF
   ============================================================ */

const { PDFDocument, degrees, rgb, StandardFonts } = PDFLib;
const { jsPDF } = window.jspdf;
// Configure PDF.js so it works whether the page is opened from a web server
// OR directly from disk (file://). If a worker blob URL was provided by the
// page (single-file build), use it; otherwise run on the main thread.
(function configurePdfWorker(){
  try {
    if (window.__PDF_WORKER_SRC__) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = window.__PDF_WORKER_SRC__;
    } else {
      // No external worker available: force main-thread ("fake worker") mode.
      // Setting workerPort to null + disableWorker makes PDF.js skip the worker
      // without throwing the "No workerSrc specified" error.
      pdfjsLib.GlobalWorkerOptions.workerPort = null;
      if (pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;
      pdfjsLib.disableWorker = true;
      if (pdfjsLib.PDFJS) pdfjsLib.PDFJS.disableWorker = true;
    }
  } catch(e){ console.warn('pdf worker config:', e); }
})();

/* ---------- Tool catalog ---------- */
const TOOLS = [
  // ORGANIZE
  { id:'merge', cat:'organize', icon:'🔗', theme:'ico-org', tag:'hot',
    title:'Merge PDF', desc:'Combine multiple PDFs into one document, in any order.' },
  { id:'split', cat:'organize', icon:'✂️', theme:'ico-blue',
    title:'Split PDF', desc:'Separate one PDF into multiple files or page ranges.' },
  { id:'remove', cat:'organize', icon:'🗑️', theme:'ico-red',
    title:'Remove pages', desc:'Delete the pages you don\'t need from your PDF.' },
  { id:'extract', cat:'organize', icon:'📑', theme:'ico-purple',
    title:'Extract pages', desc:'Pull selected pages out into a brand-new PDF.' },
  { id:'organize', cat:'organize', icon:'🔀', theme:'ico-teal',
    title:'Organize PDF', desc:'Reorder, rotate and delete pages visually.' },

  // CONVERT — to PDF
  { id:'jpgtopdf', cat:'convert', icon:'🖼️', theme:'ico-green',
    title:'JPG to PDF', desc:'Turn images into a PDF with adjustable layout.' },
  { id:'wordtopdf', cat:'convert', icon:'📝', theme:'ico-blue',
    title:'Word to PDF', desc:'Convert .docx documents into clean PDF files.' },
  { id:'htmltopdf', cat:'convert', icon:'🌐', theme:'ico-amber',
    title:'HTML to PDF', desc:'Render an HTML file or snippet into a PDF.' },
  { id:'texttopdf', cat:'convert', icon:'📃', theme:'ico-indigo',
    title:'Text to PDF', desc:'Convert plain .txt files into formatted PDFs.' },

  // CONVERT — from PDF
  { id:'pdftojpg', cat:'convert', icon:'📸', theme:'ico-pink', tag:'hot',
    title:'PDF to JPG', desc:'Export every page of a PDF as a JPG image.' },
  { id:'pdftopng', cat:'convert', icon:'🎨', theme:'ico-purple',
    title:'PDF to PNG', desc:'Convert PDF pages into high-quality PNG images.' },
  { id:'pdftotext', cat:'convert', icon:'🔤', theme:'ico-teal',
    title:'PDF to Text', desc:'Extract all readable text out of a PDF file.' },

  // EDIT
  { id:'rotate', cat:'edit', icon:'🔄', theme:'ico-blue',
    title:'Rotate PDF', desc:'Rotate all or selected pages 90, 180 or 270°.' },
  { id:'pagenumbers', cat:'edit', icon:'#️⃣', theme:'ico-amber',
    title:'Add page numbers', desc:'Insert page numbers with position options.' },
  { id:'watermark', cat:'edit', icon:'💧', theme:'ico-teal',
    title:'Add watermark', desc:'Stamp text over every page of your PDF.' },
  { id:'addtext', cat:'edit', icon:'✏️', theme:'ico-purple', tag:'new',
    title:'Add text', desc:'Place custom text anywhere on a PDF page.' },
  { id:'sign', cat:'edit', icon:'🖋️', theme:'ico-indigo', tag:'new',
    title:'Sign PDF', desc:'Draw a signature and stamp it onto your document.' },
  { id:'editmeta', cat:'edit', icon:'🏷️', theme:'ico-pink',
    title:'Edit metadata', desc:'Change title, author and other PDF properties.' },

  // SECURITY
  { id:'protect', cat:'security', icon:'🔒', theme:'ico-red', tag:'hot',
    title:'Protect PDF', desc:'Encrypt your PDF with a password.' },
  { id:'unlock', cat:'security', icon:'🔓', theme:'ico-green',
    title:'Unlock PDF', desc:'Remove password protection you have access to.' },
  { id:'flatten', cat:'security', icon:'📏', theme:'ico-blue',
    title:'Flatten PDF', desc:'Flatten form fields and annotations into the page.' },

  // OPTIMIZE
  { id:'compress', cat:'optimize', icon:'🗜️', theme:'ico-green', tag:'hot',
    title:'Compress PDF', desc:'Shrink file size while keeping quality.' },
  { id:'repair', cat:'optimize', icon:'🔧', theme:'ico-amber',
    title:'Repair PDF', desc:'Rebuild a damaged or corrupt PDF structure.' },
  { id:'pdftopdfa', cat:'optimize', icon:'📚', theme:'ico-purple',
    title:'PDF to PDF/A', desc:'Convert to an archival PDF/A-friendly format.' },
  { id:'grayscale', cat:'optimize', icon:'⬜', theme:'ico-indigo', tag:'new',
    title:'PDF to grayscale', desc:'Convert a color PDF to black & white tones.' },
];

/* ---------- Render tools grid ---------- */
const grid = document.getElementById('toolsGrid');
function renderTools(list){
  if(!list.length){
    grid.innerHTML = `<div class="no-results"><div class="big">🔍</div>
      <h3>No tools found</h3><p>Try a different search term.</p></div>`;
    return;
  }
  grid.innerHTML = list.map(t=>`
    <button class="tool-card" data-tool="${t.id}">
      ${t.tag?`<span class="tool-tag tag-${t.tag}">${t.tag}</span>`:''}
      <div class="tool-ico ${t.theme}">${t.icon}</div>
      <h3>${t.title}</h3>
      <p>${t.desc}</p>
    </button>`).join('');
}
renderTools(TOOLS);

/* ---------- Search + category filter ---------- */
let activeCat = 'all';
const searchInput = document.getElementById('searchInput');
function applyFilters(){
  const q = searchInput.value.trim().toLowerCase();
  let list = TOOLS.filter(t=>activeCat==='all'||t.cat===activeCat);
  if(q) list = list.filter(t=>
    t.title.toLowerCase().includes(q)||t.desc.toLowerCase().includes(q));
  renderTools(list);
}
searchInput.addEventListener('input', applyFilters);

document.getElementById('catTabs').addEventListener('click', e=>{
  const tab = e.target.closest('.cat-tab');
  if(!tab) return;
  document.querySelectorAll('.cat-tab').forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');
  activeCat = tab.dataset.filter;
  applyFilters();
});

// header nav category jumps
document.querySelectorAll('[data-cat]').forEach(link=>{
  link.addEventListener('click', e=>{
    e.preventDefault();
    const cat = link.dataset.cat;
    document.querySelectorAll('.cat-tab').forEach(t=>{
      t.classList.toggle('active', t.dataset.filter===cat);
    });
    activeCat = cat; applyFilters();
    document.getElementById('tools-anchor').scrollIntoView({behavior:'smooth'});
  });
});

/* ---------- Open tool (cards + footer links) ---------- */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-tool]');
  if(!el) return;
  e.preventDefault();
  openTool(el.dataset.tool);
});

/* ---------- Helpers ---------- */
function fmtSize(bytes){
  if(bytes<1024) return bytes+' B';
  if(bytes<1048576) return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1048576).toFixed(2)+' MB';
}
function downloadBlob(bytes, name, type='application/pdf'){
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes],{type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}
/* Parse "1-3, 5, 8-10" into zero-based index array given total pages */
function parseRanges(str, total){
  const out = new Set();
  str.split(',').forEach(part=>{
    part = part.trim(); if(!part) return;
    if(part.includes('-')){
      let [a,b] = part.split('-').map(n=>parseInt(n.trim()));
      if(isNaN(a)||isNaN(b)) return;
      for(let i=a;i<=b;i++) if(i>=1&&i<=total) out.add(i-1);
    } else {
      const n = parseInt(part);
      if(!isNaN(n)&&n>=1&&n<=total) out.add(n-1);
    }
  });
  return [...out].sort((a,b)=>a-b);
}

/* ============================================================
   MODAL + WORKSPACE SYSTEM
   ============================================================ */
const overlay   = document.getElementById('modalOverlay');
const modalIco  = document.getElementById('modalIco');
const modalTitle= document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalBody = document.getElementById('modalBody');

document.getElementById('modalClose').addEventListener('click', closeModal);
overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

function closeModal(){
  overlay.classList.remove('open');
  document.body.style.overflow='';
  state = {};            // reset working state
}

/* Working state shared inside a tool session */
let state = {};

function openTool(id){
  const tool = TOOLS.find(t=>t.id===id);
  if(!tool) return;
  state = { tool, files: [] };
  modalIco.className = 'tool-ico '+tool.theme;
  modalIco.textContent = tool.icon;
  modalTitle.textContent = tool.title;
  modalDesc.textContent = tool.desc;
  modalBody.innerHTML = buildToolUI(tool);
  overlay.classList.add('open');
  document.body.style.overflow='hidden';
  wireToolUI(tool);
}

/* ---------- Decide accepted file types per tool ---------- */
function acceptFor(id){
  if(id==='jpgtopdf') return 'image/*';
  if(id==='wordtopdf') return '.docx';
  if(id==='htmltopdf') return '.html,.htm';
  if(id==='texttopdf') return '.txt';
  return 'application/pdf';
}
function multiFor(id){
  return ['merge','jpgtopdf'].includes(id);
}

/* ---------- Build the dropzone + options markup ---------- */
function buildToolUI(tool){
  const accept = acceptFor(tool.id);
  const multi  = multiFor(tool.id) ? 'multiple' : '';
  const kindLabel = accept==='image/*' ? 'images'
      : accept==='.docx' ? 'a Word file'
      : accept.includes('html') ? 'an HTML file'
      : accept==='.txt' ? 'a text file' : 'a PDF';

  return `
    <div class="dropzone" id="dropzone">
      <input type="file" id="fileInput" accept="${accept}" ${multi} hidden>
      <div class="dz-ico">📂</div>
      <h3>Drop ${kindLabel} here</h3>
      <p>or <span class="browse">browse your device</span></p>
    </div>
    <div class="file-list" id="fileList"></div>
    <div id="optionsMount"></div>
    <div class="err-msg" id="errMsg"></div>
    <div class="modal-action" id="actionMount"></div>
  `;
}

/* ---------- Wire up events after building UI ---------- */
function wireToolUI(tool){
  const dz = document.getElementById('dropzone');
  const input = document.getElementById('fileInput');

  dz.addEventListener('click', ()=>input.click());
  dz.addEventListener('dragover', e=>{e.preventDefault();dz.classList.add('drag');});
  dz.addEventListener('dragleave', ()=>dz.classList.remove('drag'));
  dz.addEventListener('drop', e=>{
    e.preventDefault(); dz.classList.remove('drag');
    handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', ()=>handleFiles(input.files));
}

function showError(msg){
  const e = document.getElementById('errMsg');
  e.textContent = msg; e.classList.add('show');
  setTimeout(()=>e.classList.remove('show'), 6000);
}

/* ---------- Handle incoming files ---------- */
function handleFiles(fileList){
  const files = [...fileList];
  if(!files.length) return;
  const multi = multiFor(state.tool.id);
  if(multi){
    state.files.push(...files);
  } else {
    state.files = [files[0]];
  }
  renderFileList();
  renderOptions();
  renderAction();
}

/* ---------- Render selected files with reorder/remove ---------- */
function renderFileList(){
  const list = document.getElementById('fileList');
  if(!state.files.length){ list.innerHTML=''; return; }
  const multi = multiFor(state.tool.id);
  list.innerHTML = state.files.map((f,i)=>`
    <div class="file-item" draggable="${multi}" data-idx="${i}">
      ${multi?'<span class="fi-handle">⠿</span>':''}
      <div class="fi-ico">${f.type.startsWith('image')?'🖼️':'📄'}</div>
      <div class="fi-info">
        <div class="name">${f.name}</div>
        <div class="size">${fmtSize(f.size)}</div>
      </div>
      <button class="fi-remove" data-remove="${i}">×</button>
    </div>`).join('');

  list.querySelectorAll('[data-remove]').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.files.splice(+b.dataset.remove,1);
      renderFileList(); renderOptions(); renderAction();
    });
  });

  if(multi) enableReorder(list);
}

/* ---------- Drag-to-reorder for merge ---------- */
function enableReorder(list){
  let dragIdx = null;
  list.querySelectorAll('.file-item').forEach(item=>{
    item.addEventListener('dragstart', ()=>{ dragIdx=+item.dataset.idx; item.classList.add('dragging'); });
    item.addEventListener('dragend', ()=>item.classList.remove('dragging'));
    item.addEventListener('dragover', e=>e.preventDefault());
    item.addEventListener('drop', e=>{
      e.preventDefault();
      const dropIdx = +item.dataset.idx;
      if(dragIdx===null||dragIdx===dropIdx) return;
      const [moved] = state.files.splice(dragIdx,1);
      state.files.splice(dropIdx,0,moved);
      renderFileList();
    });
  });
}

/* ============================================================
   PER-TOOL OPTION PANELS
   ============================================================ */
function renderOptions(){
  const mount = document.getElementById('optionsMount');
  if(!state.files.length){ mount.innerHTML=''; return; }
  const id = state.tool.id;
  let html = '';

  if(id==='split'){
    html = optWrap('Split options',`
      ${radioRow('splitMode','Mode',[['ranges','By page ranges'],['every','Every N pages'],['each','Each page → 1 file']],'ranges')}
      <div class="opt-row" id="rangeWrap">
        <label>Page ranges to extract (e.g. 1-3, 5, 8-10)</label>
        <input type="text" id="splitRanges" placeholder="1-3, 5, 8-10">
      </div>
      <div class="opt-row" id="everyWrap" style="display:none">
        <label>Pages per file</label>
        <input type="number" id="splitEvery" value="1" min="1">
      </div>`);
  }
  else if(id==='remove'){
    html = optWrap('Pages to remove',`
      <div class="opt-row">
        <label>Page numbers to delete (e.g. 2, 4, 6-8)</label>
        <input type="text" id="removePages" placeholder="2, 4, 6-8">
      </div>`);
  }
  else if(id==='extract'){
    html = optWrap('Pages to extract',`
      <div class="opt-row">
        <label>Page numbers to keep (e.g. 1-3, 7)</label>
        <input type="text" id="extractPages" placeholder="1-3, 7">
      </div>`);
  }
  else if(id==='rotate'){
    html = optWrap('Rotation',`
      ${radioRow('rotateAngle','Angle',[['90','90° ↻'],['180','180°'],['270','270° ↺']],'90')}
      <div class="opt-row">
        <label>Apply to pages (blank = all, e.g. 1-3)</label>
        <input type="text" id="rotatePages" placeholder="All pages">
      </div>`);
  }
  else if(id==='pagenumbers'){
    html = optWrap('Page number options',`
      ${radioRow('pnPos','Position',[['bc','Bottom center'],['br','Bottom right'],['bl','Bottom left'],['tc','Top center']],'bc')}
      <div class="opt-row"><label>Starting number</label>
        <input type="number" id="pnStart" value="1" min="0"></div>
      <div class="opt-row"><label>Font size</label>
        <input type="number" id="pnSize" value="12" min="6" max="48"></div>`);
  }
  else if(id==='watermark'){
    html = optWrap('Watermark options',`
      <div class="opt-row"><label>Watermark text</label>
        <input type="text" id="wmText" value="CONFIDENTIAL"></div>
      <div class="opt-row"><label>Font size</label>
        <input type="number" id="wmSize" value="50" min="8" max="200"></div>
      <div class="opt-row"><label>Opacity (%)</label>
        <input type="number" id="wmOpacity" value="20" min="5" max="100"></div>
      ${radioRow('wmRotate','Angle',[['45','Diagonal'],['0','Horizontal']],'45')}`);
  }
  else if(id==='addtext'){
    html = optWrap('Text options',`
      <div class="opt-row"><label>Text to add</label>
        <input type="text" id="atText" placeholder="Your text here"></div>
      <div class="opt-row"><label>Font size</label>
        <input type="number" id="atSize" value="18" min="6" max="120"></div>
      <div class="opt-row"><label>Horizontal position (% from left)</label>
        <input type="number" id="atX" value="10" min="0" max="100"></div>
      <div class="opt-row"><label>Vertical position (% from top)</label>
        <input type="number" id="atY" value="10" min="0" max="100"></div>
      <div class="opt-row"><label>Apply to pages (blank = all)</label>
        <input type="text" id="atPages" placeholder="All pages"></div>`);
  }
  else if(id==='protect'){
    html = optWrap('Set a password',`
      <div class="opt-row"><label>Password</label>
        <input type="text" id="pwSet" placeholder="Enter a strong password"></div>
      <p style="font-size:12.5px;color:var(--muted)">The PDF will be encrypted. You'll need this password to open it.</p>`);
  }
  else if(id==='unlock'){
    html = optWrap('Enter current password',`
      <div class="opt-row"><label>Password</label>
        <input type="text" id="pwGet" placeholder="The PDF's current password"></div>`);
  }
  else if(id==='editmeta'){
    html = optWrap('Document properties',`
      <div class="opt-row"><label>Title</label><input type="text" id="metaTitle"></div>
      <div class="opt-row"><label>Author</label><input type="text" id="metaAuthor"></div>
      <div class="opt-row"><label>Subject</label><input type="text" id="metaSubject"></div>
      <div class="opt-row"><label>Keywords (comma separated)</label><input type="text" id="metaKeywords"></div>`);
  }
  else if(id==='compress'){
    html = optWrap('Compression level',`
      ${radioRow('compressLevel','Level',[['low','Less (best quality)'],['medium','Recommended'],['high','Extreme (smallest)']],'medium')}
      <p style="font-size:12.5px;color:var(--muted)">Rasterizes pages to reduce size. Higher levels reduce image quality.</p>`);
  }
  else if(id==='jpgtopdf'){
    html = optWrap('Page options',`
      ${radioRow('jpgOrient','Orientation',[['auto','Auto'],['portrait','Portrait'],['landscape','Landscape']],'auto')}
      ${radioRow('jpgMargin','Margin',[['none','No margin'],['small','Small'],['big','Big']],'small')}`);
  }
  else if(id==='pdftojpg'||id==='pdftopng'){
    html = optWrap('Image quality',`
      ${radioRow('imgQuality','Resolution',[['1','Normal'],['1.5','High'],['2','Very high']],'1.5')}
      <p style="font-size:12.5px;color:var(--muted)">Each page becomes one image, delivered in a ZIP if there are multiple.</p>`);
  }
  else if(id==='sign'){
    html = optWrap('Draw your signature',`
      <canvas id="sigPad" width="500" height="160" style="border:1.5px dashed var(--line);border-radius:10px;width:100%;background:#fff;touch-action:none"></canvas>
      <div style="display:flex;gap:10px;margin-top:10px">
        <button class="radio-pill" id="sigClear" type="button">Clear</button>
      </div>
      ${radioRow('sigPos','Place on',[['br','Bottom right'],['bl','Bottom left'],['bc','Bottom center']],'br')}
      <div class="opt-row"><label>Apply to page (blank = last page)</label>
        <input type="text" id="sigPage" placeholder="Last page"></div>`);
  }

  mount.innerHTML = html;
  wireOptionEvents(id);
}

/* small builders */
function optWrap(title, inner){
  return `<div class="opt-panel"><h4>${title}</h4>${inner}</div>`;
}
function radioRow(name, label, opts, def){
  return `<div class="opt-row"><label>${label}</label>
    <div class="radio-group" data-radio="${name}">
      ${opts.map(([v,t])=>`<div class="radio-pill ${v===def?'sel':''}" data-val="${v}">${t}</div>`).join('')}
    </div></div>`;
}

/* radio pill behaviour + conditional panels */
function wireOptionEvents(id){
  document.querySelectorAll('[data-radio]').forEach(group=>{
    group.addEventListener('click', e=>{
      const pill = e.target.closest('.radio-pill');
      if(!pill) return;
      group.querySelectorAll('.radio-pill').forEach(p=>p.classList.remove('sel'));
      pill.classList.add('sel');
      if(group.dataset.radio==='splitMode') toggleSplitMode(pill.dataset.val);
    });
  });
  if(id==='sign') initSignaturePad();
}
function getRadio(name){
  const sel = document.querySelector(`[data-radio="${name}"] .sel`);
  return sel ? sel.dataset.val : null;
}
function toggleSplitMode(mode){
  document.getElementById('rangeWrap').style.display = mode==='ranges'?'flex':'none';
  document.getElementById('everyWrap').style.display = mode==='every'?'flex':'none';
}

/* ============================================================
   ACTION BUTTON + RESULT STATES
   ============================================================ */
function renderAction(){
  const mount = document.getElementById('actionMount');
  if(!state.files.length){ mount.innerHTML=''; return; }
  const labels = {
    merge:'Merge PDFs', split:'Split PDF', remove:'Remove pages', extract:'Extract pages',
    organize:'Save organized PDF', rotate:'Rotate PDF', pagenumbers:'Add page numbers',
    watermark:'Add watermark', addtext:'Add text', sign:'Sign PDF', editmeta:'Save metadata',
    protect:'Protect PDF', unlock:'Unlock PDF', flatten:'Flatten PDF', compress:'Compress PDF',
    repair:'Repair PDF', pdftopdfa:'Convert to PDF/A', grayscale:'Convert to grayscale',
    jpgtopdf:'Create PDF', wordtopdf:'Convert to PDF', htmltopdf:'Convert to PDF',
    texttopdf:'Convert to PDF', pdftojpg:'Convert to JPG', pdftopng:'Convert to PNG',
    pdftotext:'Extract text'
  };
  const min = multiFor(state.tool.id) ? (state.tool.id==='merge'?2:1) : 1;
  const ready = state.files.length>=min;
  mount.innerHTML = `<button class="btn-process" id="processBtn" ${ready?'':'disabled'}>
    <span id="procLabel">${labels[state.tool.id]||'Process'}</span></button>`;
  document.getElementById('processBtn').addEventListener('click', runTool);
}

function setProcessing(){
  const body = document.getElementById('modalBody');
  body.innerHTML = `<div class="processing-state">
    <div class="spin-lg"></div>
    <p>Processing your file… this happens entirely on your device.</p></div>`;
}

function showResult(blob, filename, summary){
  state.result = { blob, filename };
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="result-box">
      <div class="r-ico">✓</div>
      <h3>Done!</h3>
      <p>${summary||'Your file is ready to download.'}</p>
      <button class="btn-download" id="dlBtn">⬇ Download ${filename.length>28?filename.slice(0,25)+'…':filename}</button>
      <button class="btn-again" id="againBtn">← Process another file</button>
    </div>`;
  document.getElementById('dlBtn').addEventListener('click', ()=>{
    downloadBlob(state.result.blob, state.result.filename,
      state.result.blob.type || 'application/pdf');
  });
  document.getElementById('againBtn').addEventListener('click', ()=>openTool(state.tool.id));
}

/* ============================================================
   SIGNATURE PAD
   ============================================================ */
function initSignaturePad(){
  const canvas = document.getElementById('sigPad');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2.5; ctx.lineCap='round'; ctx.strokeStyle='#1a1d29';
  let drawing=false, hasInk=false;
  const pos = e=>{
    const r = canvas.getBoundingClientRect();
    const cx = (e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const cy = (e.touches?e.touches[0].clientY:e.clientY)-r.top;
    return [cx*(canvas.width/r.width), cy*(canvas.height/r.height)];
  };
  const start=e=>{drawing=true;hasInk=true;const[x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y);e.preventDefault();};
  const move=e=>{if(!drawing)return;const[x,y]=pos(e);ctx.lineTo(x,y);ctx.stroke();e.preventDefault();};
  const end=()=>drawing=false;
  canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);
  canvas.addEventListener('mouseup',end);canvas.addEventListener('mouseleave',end);
  canvas.addEventListener('touchstart',start);canvas.addEventListener('touchmove',move);
  canvas.addEventListener('touchend',end);
  document.getElementById('sigClear').addEventListener('click',()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;
  });
  state.sigCanvas = canvas;
  state.sigHasInk = ()=>hasInk;
}

/* read a File into an ArrayBuffer */
function readAB(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}
function readText(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });
}
function readDataURL(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ============================================================
   TOOL EXECUTION — the real processing
   ============================================================ */
async function runTool(){
  const id = state.tool.id;
  // CRITICAL: capture all option values from the DOM *before* setProcessing()
  // wipes the modal body. Tool functions read from state.opts, not the DOM.
  state.opts = captureOptions(id);
  setProcessing();
  try{
    await TOOL_FNS[id]();
  }catch(err){
    console.error(err);
    // rebuild UI and surface the error
    modalBody.innerHTML = buildToolUI(state.tool);
    wireToolUI(state.tool);
    renderFileList(); renderOptions(); renderAction();
    showError('Something went wrong: '+(err.message||'could not process this file.'));
  }
}

/* Read every option field into a plain object before the DOM is replaced */
function captureOptions(id){
  const val = sel => { const el=document.getElementById(sel); return el?el.value:''; };
  const o = {};
  // text/number inputs
  ['splitRanges','splitEvery','removePages','extractPages','rotatePages',
   'pnStart','pnSize','wmText','wmSize','wmOpacity','atText','atSize','atX','atY','atPages',
   'pwSet','pwGet','metaTitle','metaAuthor','metaSubject','metaKeywords',
   'sigPage'].forEach(k=>{ o[k]=val(k); });
  // radio groups
  ['splitMode','rotateAngle','pnPos','wmRotate','compressLevel',
   'jpgOrient','jpgMargin','imgQuality','sigPos'].forEach(k=>{ o[k]=getRadio(k); });
  // signature canvas — snapshot to data URL now
  if(id==='sign' && state.sigCanvas){
    o.sigData = (state.sigHasInk && state.sigHasInk()) ? state.sigCanvas.toDataURL('image/png') : null;
  }
  return o;
}

const TOOL_FNS = {

  /* ---- MERGE ---- */
  async merge(){
    const out = await PDFDocument.create();
    for(const f of state.files){
      const src = await PDFDocument.load(await readAB(f),{ignoreEncryption:true});
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p=>out.addPage(p));
    }
    const bytes = await out.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'merged.pdf',
      `${state.files.length} files combined into one PDF.`);
  },

  /* ---- SPLIT ---- */
  async split(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const total = src.getPageCount();
    const mode = state.opts.splitMode;
    const zip = new JSZip();

    if(mode==='ranges'){
      const idxs = parseRanges(state.opts.splitRanges, total);
      if(!idxs.length) throw new Error('Enter valid page ranges.');
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, idxs);
      pages.forEach(p=>out.addPage(p));
      const bytes = await out.save();
      return showResult(new Blob([bytes],{type:'application/pdf'}),'split.pdf',
        `Extracted ${idxs.length} page(s) into a new PDF.`);
    }

    const chunk = mode==='each' ? 1 : Math.max(1, parseInt(state.opts.splitEvery)||1);
    let part=1;
    for(let i=0;i<total;i+=chunk){
      const out = await PDFDocument.create();
      const idxs = [];
      for(let j=i;j<Math.min(i+chunk,total);j++) idxs.push(j);
      const pages = await out.copyPages(src, idxs);
      pages.forEach(p=>out.addPage(p));
      const bytes = await out.save();
      zip.file(`part-${part}.pdf`, bytes);
      part++;
    }
    const blob = await zip.generateAsync({type:'blob'});
    showResult(blob,'split-files.zip', `Split into ${part-1} files (delivered as ZIP).`);
  },

  /* ---- REMOVE PAGES ---- */
  async remove(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const total = src.getPageCount();
    const toRemove = new Set(parseRanges(state.opts.removePages, total));
    if(!toRemove.size) throw new Error('Enter which pages to remove.');
    if(toRemove.size>=total) throw new Error('You cannot remove every page.');
    const keep = [];
    for(let i=0;i<total;i++) if(!toRemove.has(i)) keep.push(i);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, keep);
    pages.forEach(p=>out.addPage(p));
    const bytes = await out.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'pages-removed.pdf',
      `Removed ${toRemove.size} page(s). ${keep.length} remain.`);
  },

  /* ---- EXTRACT PAGES ---- */
  async extract(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const total = src.getPageCount();
    const idxs = parseRanges(state.opts.extractPages, total);
    if(!idxs.length) throw new Error('Enter which pages to extract.');
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, idxs);
    pages.forEach(p=>out.addPage(p));
    const bytes = await out.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'extracted.pdf',
      `Extracted ${idxs.length} page(s) into a new PDF.`);
  },

  /* ---- ORGANIZE (visual reorder) — handled specially below ---- */
  async organize(){ await organizeProcess(); },

  /* ---- ROTATE ---- */
  async rotate(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const angle = parseInt(state.opts.rotateAngle);
    const pagesStr = (state.opts.rotatePages||'').trim();
    const total = src.getPageCount();
    const targets = pagesStr ? new Set(parseRanges(pagesStr,total)) : null;
    src.getPages().forEach((page,i)=>{
      if(!targets || targets.has(i)){
        const cur = page.getRotation().angle;
        page.setRotation(degrees((cur+angle)%360));
      }
    });
    const bytes = await src.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'rotated.pdf','Pages rotated successfully.');
  },

  /* ---- PAGE NUMBERS ---- */
  async pagenumbers(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const font = await src.embedFont(StandardFonts.Helvetica);
    const pos = state.opts.pnPos;
    const start = parseInt(state.opts.pnStart)||1;
    const size = parseInt(state.opts.pnSize)||12;
    src.getPages().forEach((page,i)=>{
      const {width,height} = page.getSize();
      const label = String(start+i);
      const tw = font.widthOfTextAtSize(label,size);
      let x,y;
      if(pos[0]==='b'){ y=24; } else { y=height-24-size; }
      if(pos[1]==='c'){ x=(width-tw)/2; }
      else if(pos[1]==='r'){ x=width-tw-36; }
      else { x=36; }
      page.drawText(label,{x,y,size,font,color:rgb(0.1,0.1,0.15)});
    });
    const bytes = await src.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'numbered.pdf','Page numbers added.');
  },

  /* ---- WATERMARK ---- */
  async watermark(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const font = await src.embedFont(StandardFonts.HelveticaBold);
    const text = state.opts.wmText || 'WATERMARK';
    const size = parseInt(state.opts.wmSize)||50;
    const opacity = (parseInt(state.opts.wmOpacity)||20)/100;
    const angle = parseInt(state.opts.wmRotate);
    src.getPages().forEach(page=>{
      const {width,height} = page.getSize();
      const tw = font.widthOfTextAtSize(text,size);
      page.drawText(text,{
        x: width/2 - (angle?tw/2.6:tw/2),
        y: height/2 - (angle?0:size/2),
        size, font, color:rgb(0.6,0.6,0.65),
        opacity, rotate:degrees(angle)
      });
    });
    const bytes = await src.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'watermarked.pdf','Watermark applied to all pages.');
  },

  /* ---- ADD TEXT ---- */
  async addtext(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const font = await src.embedFont(StandardFonts.Helvetica);
    const text = state.opts.atText;
    if(!text) throw new Error('Enter the text to add.');
    const size = parseInt(state.opts.atSize)||18;
    const xPct = (parseInt(state.opts.atX)||10)/100;
    const yPct = (parseInt(state.opts.atY)||10)/100;
    const pagesStr = (state.opts.atPages||'').trim();
    const total = src.getPageCount();
    const targets = pagesStr ? new Set(parseRanges(pagesStr,total)) : null;
    src.getPages().forEach((page,i)=>{
      if(targets && !targets.has(i)) return;
      const {width,height} = page.getSize();
      page.drawText(text,{
        x: width*xPct,
        y: height-(height*yPct)-size,
        size, font, color:rgb(0.1,0.1,0.15)
      });
    });
    const bytes = await src.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'text-added.pdf','Text added to your PDF.');
  },

  /* ---- EDIT METADATA ---- */
  async editmeta(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const t = state.opts.metaTitle;
    const a = state.opts.metaAuthor;
    const s = state.opts.metaSubject;
    const k = state.opts.metaKeywords;
    if(t) src.setTitle(t);
    if(a) src.setAuthor(a);
    if(s) src.setSubject(s);
    if(k) src.setKeywords(k.split(',').map(x=>x.trim()));
    src.setProducer('PDFvault'); src.setModificationDate(new Date());
    const bytes = await src.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'metadata.pdf','Document properties updated.');
  },

  /* ---- PROTECT (encrypt) ---- */
  async protect(){
    const pw = state.opts.pwSet;
    if(!pw) throw new Error('Enter a password.');
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    if(typeof src.encrypt !== 'function'){
      throw new Error('Encryption library not loaded. Please refresh the page.');
    }
    await src.encrypt({
      userPassword: pw,
      ownerPassword: pw,
      permissions:{ printing:'highResolution', copying:true, modifying:false }
    });
    const bytes = await src.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'protected.pdf',
      'Your PDF is now encrypted. The password is required to open it.');
  },

  /* ---- UNLOCK (decrypt with pdf.js, then rebuild) ---- */
  async unlock(){
    const pw = state.opts.pwGet || '';
    const ab = await readAB(state.files[0]);
    // pdf-lib cannot open encrypted PDFs, but pdf.js can decrypt them given the
    // password. We decrypt with pdf.js, render each page, and rebuild a fresh,
    // unprotected PDF that any viewer can open without a password.
    let pdf;
    try{
      pdf = await pdfjsLib.getDocument({data: ab.slice(0), password: pw}).promise;
    }catch(e){
      const msg = (e && e.name === 'PasswordException')
        ? 'Wrong password — please check it and try again.'
        : 'Could not open this PDF. It may be corrupted or use unsupported encryption.';
      throw new Error(msg);
    }
    const out = await PDFDocument.create();
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const canvas = await renderPageToCanvas(page, 2.0);
      const jpg = await out.embedJpg(canvas.toDataURL('image/jpeg', 0.92));
      const pg = out.addPage([canvas.width, canvas.height]);
      pg.drawImage(jpg,{x:0,y:0,width:canvas.width,height:canvas.height});
    }
    const bytes = await out.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'unlocked.pdf','Password protection removed.');
  },

  /* ---- FLATTEN ---- */
  async flatten(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    try{ const form = src.getForm(); form.flatten(); }catch(e){}
    const bytes = await src.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'flattened.pdf','Form fields flattened into the page.');
  },

  /* ---- REPAIR ---- */
  async repair(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{
      ignoreEncryption:true, throwOnInvalidObject:false, updateMetadata:false
    });
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p=>out.addPage(p));
    const bytes = await out.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'repaired.pdf','PDF structure rebuilt.');
  },

  /* ---- PDF/A (best-effort normalization) ---- */
  async pdftopdfa(){
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    src.setProducer('PDFvault PDF/A'); src.setCreator('PDFvault');
    src.setModificationDate(new Date());
    const bytes = await src.save({useObjectStreams:false});
    showResult(new Blob([bytes],{type:'application/pdf'}),'archive-pdfa.pdf',
      'Normalized for archival. For strict PDF/A validation use a dedicated validator.');
  },
};

/* ============================================================
   RENDER-BASED TOOLS (pdf.js + canvas)
   ============================================================ */

/* Render a PDF page to a canvas at given scale */
async function renderPageToCanvas(pdfPage, scale){
  const viewport = pdfPage.getViewport({scale});
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await pdfPage.render({canvasContext:ctx, viewport}).promise;
  return canvas;
}

Object.assign(TOOL_FNS, {

  /* ---- COMPRESS (rasterize pages then rebuild) ---- */
  async compress(){
    const ab = await readAB(state.files[0]);
    const origSize = state.files[0].size;
    const level = state.opts.compressLevel;
    const cfg = {
      low:    {scale:1.6, quality:0.82},
      medium: {scale:1.25,quality:0.65},
      high:   {scale:1.0, quality:0.45},
    }[level];

    const pdf = await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
    const out = await PDFDocument.create();
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const canvas = await renderPageToCanvas(page, cfg.scale);
      const jpgData = canvas.toDataURL('image/jpeg', cfg.quality);
      const jpg = await out.embedJpg(jpgData);
      const pg = out.addPage([canvas.width, canvas.height]);
      pg.drawImage(jpg,{x:0,y:0,width:canvas.width,height:canvas.height});
    }
    const bytes = await out.save();
    const newSize = bytes.length;
    const saved = Math.max(0, Math.round((1-newSize/origSize)*100));
    showResult(new Blob([bytes],{type:'application/pdf'}),'compressed.pdf',
      `${fmtSize(origSize)} → ${fmtSize(newSize)} (${saved}% smaller).`);
  },

  /* ---- GRAYSCALE ---- */
  async grayscale(){
    const ab = await readAB(state.files[0]);
    const pdf = await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
    const out = await PDFDocument.create();
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const canvas = await renderPageToCanvas(page, 1.5);
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0,0,canvas.width,canvas.height);
      const d = img.data;
      for(let p=0;p<d.length;p+=4){
        const g = 0.299*d[p]+0.587*d[p+1]+0.114*d[p+2];
        d[p]=d[p+1]=d[p+2]=g;
      }
      ctx.putImageData(img,0,0);
      const jpgData = canvas.toDataURL('image/jpeg',0.85);
      const jpg = await out.embedJpg(jpgData);
      const pg = out.addPage([canvas.width,canvas.height]);
      pg.drawImage(jpg,{x:0,y:0,width:canvas.width,height:canvas.height});
    }
    const bytes = await out.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'grayscale.pdf','Converted to grayscale.');
  },

  /* ---- PDF → JPG ---- */
  async pdftojpg(){ await pdfToImages('image/jpeg','jpg'); },
  /* ---- PDF → PNG ---- */
  async pdftopng(){ await pdfToImages('image/png','png'); },

  /* ---- PDF → TEXT ---- */
  async pdftotext(){
    const ab = await readAB(state.files[0]);
    const pdf = await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
    let full='';
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const txt = content.items.map(it=>it.str).join(' ');
      full += `--- Page ${i} ---\n${txt}\n\n`;
    }
    showResult(new Blob([full],{type:'text/plain'}),'extracted-text.txt',
      `Extracted text from ${pdf.numPages} page(s).`);
  },

  /* ---- JPG → PDF ---- */
  async jpgtopdf(){
    const orient = state.opts.jpgOrient;
    const marginOpt = state.opts.jpgMargin;
    const margin = {none:0,small:28,big:56}[marginOpt];
    const out = await PDFDocument.create();
    for(const f of state.files){
      const dataUrl = await readDataURL(f);
      const ab = await readAB(f);
      let img;
      if(f.type.includes('png')) img = await out.embedPng(ab);
      else img = await out.embedJpg(ab).catch(async()=>{
        // re-encode unknown image via canvas
        const png = await reencodeToPng(dataUrl);
        return out.embedPng(png);
      });
      const iw = img.width, ih = img.height;
      let pw,ph;
      const landscape = orient==='landscape' || (orient==='auto'&&iw>ih);
      if(landscape){ pw=842; ph=595; } else { pw=595; ph=842; }
      const page = out.addPage([pw,ph]);
      const availW = pw-margin*2, availH = ph-margin*2;
      const scale = Math.min(availW/iw, availH/ih);
      const dw=iw*scale, dh=ih*scale;
      page.drawImage(img,{x:(pw-dw)/2, y:(ph-dh)/2, width:dw, height:dh});
    }
    const bytes = await out.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'images.pdf',
      `${state.files.length} image(s) converted to PDF.`);
  },

  /* ---- TEXT → PDF ---- */
  async texttopdf(){
    const text = await readText(state.files[0]);
    const doc = new jsPDF({unit:'pt',format:'a4'});
    const margin=48, pageW=doc.internal.pageSize.getWidth();
    const pageH=doc.internal.pageSize.getHeight();
    doc.setFont('helvetica'); doc.setFontSize(11);
    const lines = doc.splitTextToSize(text, pageW-margin*2);
    let y=margin;
    lines.forEach(line=>{
      if(y>pageH-margin){ doc.addPage(); y=margin; }
      doc.text(line, margin, y); y+=16;
    });
    showResult(doc.output('blob'),'document.pdf','Text converted to PDF.');
  },

  /* ---- WORD (.docx) → PDF ---- */
  async wordtopdf(){
    const ab = await readAB(state.files[0]);
    const result = await mammoth.convertToHtml({arrayBuffer:ab});
    await htmlStringToPdf(result.value, 'word-document.pdf', 'Word document converted to PDF.');
  },

  /* ---- HTML → PDF ---- */
  async htmltopdf(){
    const html = await readText(state.files[0]);
    await htmlStringToPdf(html, 'webpage.pdf', 'HTML converted to PDF.');
  },

  /* ---- SIGN ---- */
  async sign(){
    if(!state.opts.sigData) throw new Error('Please draw your signature first.');
    const src = await PDFDocument.load(await readAB(state.files[0]),{ignoreEncryption:true});
    const sigPng = state.opts.sigData;
    const png = await src.embedPng(sigPng);
    const total = src.getPageCount();
    const pageStr = (state.opts.sigPage||'').trim();
    const pageIdx = pageStr ? Math.min(total-1, Math.max(0,parseInt(pageStr)-1)) : total-1;
    const page = src.getPages()[pageIdx];
    const {width,height} = page.getSize();
    const sw=160, sh=160*(png.height/png.width);
    const pos = state.opts.sigPos;
    let x;
    if(pos==='bl') x=40; else if(pos==='bc') x=(width-sw)/2; else x=width-sw-40;
    page.drawImage(png,{x, y:40, width:sw, height:sh});
    const bytes = await src.save();
    showResult(new Blob([bytes],{type:'application/pdf'}),'signed.pdf','Signature added to your PDF.');
  },
});

/* shared: PDF → images, zipped if multiple */
async function pdfToImages(mime, ext){
  const ab = await readAB(state.files[0]);
  const scale = parseFloat(state.opts.imgQuality)||1.5;
  const pdf = await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
  if(pdf.numPages===1){
    const page = await pdf.getPage(1);
    const canvas = await renderPageToCanvas(page, scale);
    const blob = await new Promise(r=>canvas.toBlob(r, mime, 0.92));
    return showResult(blob, `page-1.${ext}`, 'Page converted to image.');
  }
  const zip = new JSZip();
  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const canvas = await renderPageToCanvas(page, scale);
    const blob = await new Promise(r=>canvas.toBlob(r, mime, 0.92));
    zip.file(`page-${i}.${ext}`, blob);
  }
  const out = await zip.generateAsync({type:'blob'});
  showResult(out, `pages-${ext}.zip`, `${pdf.numPages} pages converted (ZIP).`);
}

/* shared: render an HTML string to PDF via html2canvas + jsPDF image paging */
async function htmlStringToPdf(htmlString, filename, summary){
  const PAGE_W = 760; // px width we render the HTML at
  const holder = document.createElement('div');
  // Render off-screen to the left (fully painted, just not in view). Do NOT use
  // opacity:0 or visibility:hidden — html2canvas honours those and captures a
  // blank image. Off-screen positioning paints real pixels we can capture.
  holder.style.cssText =
    'position:fixed;left:-10000px;top:0;z-index:-99999;'+
    'width:'+PAGE_W+'px;padding:40px;box-sizing:border-box;'+
    'font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;'+
    'color:#111111;background:#ffffff;';
  holder.innerHTML = htmlString;
  document.body.appendChild(holder);

  // Let layout/fonts settle before capture.
  await new Promise(r=>setTimeout(r, 60));

  let canvas;
  try {
    canvas = await html2canvas(holder, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: PAGE_W,
      width: PAGE_W,
      height: holder.scrollHeight
    });
  } finally {
    if(holder.parentNode) document.body.removeChild(holder);
    document.querySelectorAll('.html2pdf__overlay, .html2pdf__container').forEach(el=>el.remove());
  }

  // Build an A4 PDF and slice the tall canvas across as many pages as needed.
  const pdf = new jsPDF({unit:'pt', format:'a4'});
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;                                   // fit canvas to page width
  const imgH = canvas.height * (imgW / canvas.width);   // proportional height in pt

  if(imgH <= pageH){
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgW, imgH);
  } else {
    // Multi-page: paint the same tall image shifted up each page.
    let remaining = imgH;
    let position = 0;
    let first = true;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    while(remaining > 0){
      if(!first) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', 0, position, imgW, imgH);
      remaining -= pageH;
      position -= pageH;
      first = false;
    }
  }
  showResult(pdf.output('blob'), filename, summary);
}

/* shared: re-encode arbitrary image to PNG bytes */
async function reencodeToPng(dataUrl){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width=img.width; c.height=img.height;
      c.getContext('2d').drawImage(img,0,0);
      c.toBlob(async b=>res(await b.arrayBuffer()),'image/png');
    };
    img.onerror = rej; img.src = dataUrl;
  });
}

/* ============================================================
   ORGANIZE PDF — visual page grid (reorder / rotate / delete)
   ============================================================ */

// Hook into option rendering: when organize has a file, show thumbnails
const _renderOptions = renderOptions;
renderOptions = function(){
  _renderOptions();
  if(state.tool && state.tool.id==='organize' && state.files.length){
    buildOrganizeGrid();
  }
};

async function buildOrganizeGrid(){
  const mount = document.getElementById('optionsMount');
  mount.innerHTML = `<div class="opt-panel"><h4>Arrange pages — drag to reorder, click ⟳ to rotate, × to delete</h4>
    <div class="pdf-preview" id="orgGrid"><p style="color:var(--muted);grid-column:1/-1">Loading pages…</p></div></div>`;
  const ab = await readAB(state.files[0]);
  state.orgAB = ab.slice(0);
  const pdf = await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
  state.orgPages = [];
  const gridEl = document.getElementById('orgGrid');
  gridEl.innerHTML='';
  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const canvas = await renderPageToCanvas(page, 0.4);
    state.orgPages.push({ srcIndex:i-1, rotation:0 });
    const cell = document.createElement('div');
    cell.className='preview-page'; cell.draggable=true; cell.dataset.pos=i-1;
    cell.appendChild(canvas);
    const num = document.createElement('div'); num.className='pg-num'; num.textContent=i;
    cell.appendChild(num);
    // controls
    const ctrl = document.createElement('div');
    ctrl.style.cssText='position:absolute;top:6px;left:6px;display:flex;gap:4px';
    const rot = document.createElement('button');
    rot.textContent='⟳'; rot.title='Rotate';
    rot.style.cssText='width:24px;height:24px;border-radius:6px;background:rgba(255,255,255,.92);font-size:13px;box-shadow:var(--shadow-sm)';
    const del = document.createElement('button');
    del.textContent='×'; del.title='Delete';
    del.style.cssText='width:24px;height:24px;border-radius:6px;background:rgba(255,255,255,.92);font-size:15px;color:#dc2626;box-shadow:var(--shadow-sm)';
    ctrl.appendChild(rot); ctrl.appendChild(del);
    cell.appendChild(ctrl);

    rot.addEventListener('click', e=>{
      e.stopPropagation();
      const pos = +cell.dataset.pos;
      state.orgPages[pos].rotation = (state.orgPages[pos].rotation+90)%360;
      canvas.style.transform = `rotate(${state.orgPages[pos].rotation}deg)`;
      canvas.style.transition='transform .2s';
    });
    del.addEventListener('click', e=>{
      e.stopPropagation();
      const pos = +cell.dataset.pos;
      state.orgPages.splice(pos,1);
      cell.remove();
      reindexOrgGrid();
    });
    gridEl.appendChild(cell);
  }
  enableOrgReorder(gridEl);
}

function reindexOrgGrid(){
  document.querySelectorAll('#orgGrid .preview-page').forEach((c,i)=>{
    c.dataset.pos=i;
    c.querySelector('.pg-num').textContent=i+1;
  });
}

function enableOrgReorder(gridEl){
  let dragPos=null;
  gridEl.querySelectorAll('.preview-page').forEach(cell=>{
    cell.addEventListener('dragstart', ()=>{dragPos=+cell.dataset.pos;cell.style.opacity='.4';});
    cell.addEventListener('dragend', ()=>cell.style.opacity='1');
    cell.addEventListener('dragover', e=>e.preventDefault());
    cell.addEventListener('drop', e=>{
      e.preventDefault();
      const dropPos=+cell.dataset.pos;
      if(dragPos===null||dragPos===dropPos) return;
      const [moved]=state.orgPages.splice(dragPos,1);
      state.orgPages.splice(dropPos,0,moved);
      // rebuild DOM order
      const cells=[...gridEl.children];
      const [movedEl]=cells.splice(dragPos,1);
      gridEl.insertBefore(movedEl, gridEl.children[dropPos] || null);
      reindexOrgGrid();
      enableOrgReorder(gridEl);
    });
  });
}

async function organizeProcess(){
  if(!state.orgPages || !state.orgPages.length) throw new Error('No pages to save.');
  const src = await PDFDocument.load(state.orgAB,{ignoreEncryption:true});
  const out = await PDFDocument.create();
  const order = state.orgPages.map(p=>p.srcIndex);
  const copied = await out.copyPages(src, order);
  copied.forEach((pg,i)=>{
    const rot = state.orgPages[i].rotation;
    if(rot) pg.setRotation(degrees(rot));
    out.addPage(pg);
  });
  const bytes = await out.save();
  showResult(new Blob([bytes],{type:'application/pdf'}),'organized.pdf',
    `Saved ${order.length} page(s) in your new order.`);
}

/* ============================================================
   Mobile menu toggle
   ============================================================ */
document.querySelector('.menu-toggle').addEventListener('click', ()=>{
  document.getElementById('tools-anchor').scrollIntoView({behavior:'smooth'});
});

console.log('PDFvault ready — '+TOOLS.length+' tools loaded.');
