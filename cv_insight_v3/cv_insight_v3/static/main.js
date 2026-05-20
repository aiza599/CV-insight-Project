// PDF Upload
async function handleUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const area = document.getElementById('uploadArea');
  const status = document.getElementById('uploadStatus');
  const inner = document.getElementById('uploadInner');

  status.className = 'upload-status loading';
  status.innerHTML = '⏳ Extracting text from PDF...';
  status.classList.remove('hidden');
  inner.querySelector('.upload-title').textContent = file.name;
  area.classList.remove('success', 'error');

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const res = await fetch('/extract-pdf', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      status.className = 'upload-status err';
      status.innerHTML = '✗ ' + (data.error || 'Failed to extract text');
      area.classList.add('error');
      return;
    }

    document.getElementById('resumeText').value = data.text;
    status.className = 'upload-status ok';
    status.innerHTML = '✓ PDF extracted! Text filled below — ready to analyze.';
    area.classList.add('success');

  } catch (err) {
    status.className = 'upload-status err';
    status.innerHTML = '✗ Upload failed. Make sure Flask server is running.';
    area.classList.add('error');
  }
}

// Drag & Drop
const uploadArea = document.getElementById('uploadArea');
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--lime)'; });
uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith('.pdf')) {
    const input = document.getElementById('pdfFile');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    handleUpload(input);
  }
});

// Analyze Resume
async function analyzeResume() {
  const resumeText = document.getElementById('resumeText').value.trim();
  const jobDesc = document.getElementById('jobDesc').value.trim();
  const btn = document.getElementById('analyzeBtn');

  document.getElementById('results').classList.add('hidden');
  document.getElementById('errorBox').classList.add('hidden');

  if (!resumeText) {
    showError('Please upload a PDF or paste your resume text first.');
    return;
  }

  btn.disabled = true;
  document.getElementById('loadingSection').classList.remove('hidden');

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: resumeText, job_description: jobDesc })
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Something went wrong. Please try again.');
      return;
    }

    renderResults(data);

  } catch (err) {
    showError('Network error. Make sure Flask server is running.');
  } finally {
    btn.disabled = false;
    document.getElementById('loadingSection').classList.add('hidden');
  }
}

function renderResults(d) {
  // Score
  document.getElementById('scoreNum').textContent = d.score;
  document.getElementById('summaryTxt').textContent = d.summary;
  document.getElementById('verdictTxt').textContent = d.overall_verdict;

  const grade = document.getElementById('gradeChip');
  grade.textContent = 'Grade: ' + d.grade;
  grade.className = 'grade-chip grade-' + d.grade;

  setTimeout(() => { document.getElementById('scoreBarFill').style.width = d.score + '%'; }, 100);

  // Strengths
  const sl = document.getElementById('strengthsList');
  sl.innerHTML = '';
  (d.strengths || []).forEach(s => { const li = document.createElement('li'); li.textContent = s; sl.appendChild(li); });

  // Keywords
  const kw = document.getElementById('keywordChips');
  kw.innerHTML = '';
  (d.keywords_missing || []).forEach(k => {
    const span = document.createElement('span');
    span.className = 'chip'; span.textContent = k; kw.appendChild(span);
  });

  // ATS
  const al = document.getElementById('atsList');
  al.innerHTML = '';
  (d.ats_tips || []).forEach(t => { const li = document.createElement('li'); li.textContent = t; al.appendChild(li); });

  // Improvements
  const ig = document.getElementById('impList');
  ig.innerHTML = '';
  (d.improvements || []).forEach(i => {
    const div = document.createElement('div');
    div.className = 'imp-item';
    div.innerHTML = `<div class="imp-issue">${i.issue}</div><div class="imp-desc">${i.description}</div><div class="imp-fix">${i.fix}</div>`;
    ig.appendChild(div);
  });

  document.getElementById('results').classList.remove('hidden');
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  document.getElementById('errorMsg').textContent = msg;
  box.classList.remove('hidden');
}

function resetForm() {
  document.getElementById('results').classList.add('hidden');
  document.getElementById('resumeText').value = '';
  document.getElementById('jobDesc').value = '';
  document.getElementById('uploadStatus').classList.add('hidden');
  document.getElementById('uploadArea').classList.remove('success', 'error');
  document.getElementById('uploadArea').querySelector('.upload-title').textContent = 'Drop PDF here or click to browse';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Ctrl+Enter shortcut
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') analyzeResume();
});
