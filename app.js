/* ============================================================
   Pilote Olfacode — Assistant CEO
   ============================================================ */

'use strict';

/* ============================================================
   1. Configuration & state
   ============================================================ */
const STORAGE_KEY = 'pilote-olfacode.v1';
const BACKEND_URL_KEY = 'pilote-olfacode.backend_url';
const BACKEND_AUTH_KEY = 'pilote-olfacode.backend_auth';

// Backend mode : si URL+auth configurés, on persiste tout côté serveur
// Sinon, fallback localStorage (mode 100% local de la v1)
let BACKEND_URL = localStorage.getItem(BACKEND_URL_KEY) || '';
let BACKEND_AUTH = localStorage.getItem(BACKEND_AUTH_KEY) || '';
const USE_BACKEND = () => !!(BACKEND_URL && BACKEND_AUTH);

async function api(path, opts = {}) {
  if (!USE_BACKEND()) throw new Error('Backend non configuré');
  const url = BACKEND_URL.replace(/\/$/, '') + path;
  const headers = Object.assign({
    'Authorization': 'Bearer ' + BACKEND_AUTH,
    'Content-Type': 'application/json'
  }, opts.headers || {});
  const r = await fetch(url, { ...opts, headers });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'HTTP ' + r.status }));
    throw new Error(err.error || ('HTTP ' + r.status));
  }
  // certains endpoints renvoient binary (TTS) → laisser au caller
  if ((r.headers.get('content-type') || '').includes('audio/')) return r;
  return r.json();
}
const DEFAULT_SYSTEM_PROMPT = `Tu es le copilote d'exécution de Tancia Wamenya Sengo, fondatrice solo du projet Olfacode.

CONTEXTE OLFACODE :
- Plateforme verticale olfactive à 4 piliers :
  1. Olfacode Protect (registre IP blockchain pour parfumeurs Pro, 49€/dépôt) — EN PRODUCTION
  2. Studio (kit parfum personnalisé B2C 49€) — code prêt, en attente logistique
  3. Marketplace + Ambassadeurs (royalties 10-25%) — code prêt, gel actuel
  4. Insights B2B (veille tendances 99€/mois) — code prêt, en attente data critique mass
- Tancia : entrepreneure individuelle, SIRET 939 575 213 00011, basée Roubaix (59100), activité 93.29Z
- Domaine olfacode.com (DNS Gandi → Render). Smart contract Polygon : 0x37a7d24fa52f7E889912c92647443706020C378c
- Stack tech : Node.js Express, Supabase Postgres, Stripe, Polygon mainnet, Pinata IPFS, OpenAI, Resend

OBJECTIFS COURT TERME :
- 5 artisans testeurs avant mi-juillet 2026
- 10 clients payants avant octobre 2026
- Acquisition via scraping LinkedIn + Google Maps (parfumeurs indé Grasse/Paris/écoles)

DISPONIBILITÉ TANCIA :
- 15h/semaine min, jusqu'à 35-40h les semaines libres
- Solo founder, gère tech + commercial + admin + comms

TON RÔLE :
- Brief matinal : "Bonjour Tancia, voici les 3 priorités du jour basées sur la roadmap"
- Bilan soir : "Qu'as-tu accompli aujourd'hui ? Que reporter à demain ?"
- Conseils stratégiques quand sollicité (pivot, objection client, décision)
- Vigilance burnout : si elle dit qu'elle est fatiguée, suggère une pause
- Format : direct, sans baratin, actionnable. Pas de "bravo champion", des données chiffrées.
- Quand elle hésite : présente 2-3 options chiffrées, elle choisit.
- Réponses en français, ton professionnel mais chaleureux.

DONNÉES À TA DISPOSITION (transmises en contexte) :
- Roadmap : tâches en cours avec deadlines
- Budget : trésorerie, revenus, dépenses
- Prospects : pipeline d'acquisition avec statuts
- Journal de décisions : log des choix stratégiques antérieurs

Quand tu n'as pas une info, demande-la explicitement. Tu es bienveillant mais exigeant. Tu nommes les biais quand tu les vois.`;

const state = {
  settings: {
    apiKey: '',
    model: 'gpt-4o',
    voice: 'alloy',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    voiceOut: false,
    cash: 0
  },
  chats: [],         // messages : { role, content, ts }
  tasks: [],         // { id, title, quarter, priority, deadline, done, created_at }
  revenues: [],      // { id, date, label, amount }
  expenses: [],      // { id, date, label, amount, recurring }
  prospects: [],     // { id, name, persona, source, email, status, notes, created_at }
  journal: []        // { id, date, title, reason, created_at }
};

/* ============================================================
   2. Persistence localStorage
   ============================================================ */
function loadStateLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state.settings, parsed.settings || {});
    state.chats = parsed.chats || [];
    state.tasks = parsed.tasks || [];
    state.revenues = parsed.revenues || [];
    state.expenses = parsed.expenses || [];
    state.prospects = parsed.prospects || [];
    state.journal = parsed.journal || [];
  } catch (e) {
    console.warn('loadStateLocal failed', e);
  }
}

async function loadStateBackend() {
  const d = await api('/api/state');
  // mappe les champs DB → frontend state
  Object.assign(state.settings, {
    cash: d.settings.cash,
    model: d.settings.model,
    voice: d.settings.voice,
    voiceOut: !!d.settings.voice_out,
    systemPrompt: d.settings.system_prompt || DEFAULT_SYSTEM_PROMPT,
    pbAgentIds: Array.isArray(d.settings.pb_agent_ids) ? d.settings.pb_agent_ids : []
  });
  state.chats = (d.chats || []).map(m => ({ id: m.id, role: m.role, content: m.content, ts: m.ts }));
  state.tasks = (d.tasks || []).map(t => ({
    id: t.id, title: t.title, quarter: t.quarter || 'T3-2026',
    priority: t.priority || 'moyenne', deadline: t.deadline, done: !!t.done
  }));
  state.revenues = d.revenues || [];
  state.expenses = (d.expenses || []).map(e => ({ ...e, recurring: !!e.recurring }));
  state.prospects = (d.prospects || []).map(p => ({
    id: p.id, name: p.name, persona: p.persona, source: p.source, email: p.email, phone: p.phone,
    status: p.status, notes: p.notes, linkedin_url: p.linkedin_url, enrichment: p.enrichment,
    contacted_at: p.contacted_at, created_at: p.created_at, updated_at: p.updated_at
  }));
  state.journal = d.journal || [];
}

async function loadState() {
  if (USE_BACKEND()) {
    try { await loadStateBackend(); return; }
    catch (e) {
      console.error('Backend load failed, fallback local:', e.message);
      toast('⚠ Backend injoignable — mode local : ' + e.message, 'warn');
    }
  }
  loadStateLocal();
}
function saveStateLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveStateLocal failed', e);
    toast('Erreur sauvegarde locale : ' + e.message, 'error');
  }
}

// En mode backend, on persiste via les endpoints CRUD spécifiques.
// saveState() reste appelé partout mais devient un cache local secondaire.
function saveState() {
  saveStateLocal(); // toujours utile comme cache offline / fallback
}

// Wrappers async qui persistent côté backend si dispo
async function syncSettingsBackend() {
  if (!USE_BACKEND()) return;
  try {
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        cash: state.settings.cash,
        model: state.settings.model,
        voice: state.settings.voice,
        voice_out: !!state.settings.voiceOut,
        system_prompt: state.settings.systemPrompt,
        pb_agent_ids: state.settings.pbAgentIds || []
      })
    });
  } catch (e) { console.warn('syncSettings failed', e.message); }
}
async function syncTaskBackend(task, action = 'create') {
  if (!USE_BACKEND()) return;
  try {
    if (action === 'create') await api('/api/tasks', { method: 'POST', body: JSON.stringify(task) });
    else if (action === 'update') await api('/api/tasks/' + encodeURIComponent(task.id), { method: 'PATCH', body: JSON.stringify(task) });
    else if (action === 'delete') await api('/api/tasks/' + encodeURIComponent(task.id), { method: 'DELETE' });
  } catch (e) { console.warn('syncTask failed', e.message); toast('Sync task : ' + e.message, 'warn'); }
}
async function syncEntryBackend(table, entry, action = 'create') {
  if (!USE_BACKEND()) return;
  try {
    if (action === 'create') await api('/api/' + table, { method: 'POST', body: JSON.stringify(entry) });
    else if (action === 'delete') await api('/api/' + table + '/' + encodeURIComponent(entry.id), { method: 'DELETE' });
  } catch (e) { console.warn('syncEntry failed', e.message); toast('Sync : ' + e.message, 'warn'); }
}
async function syncProspectBackend(p, action = 'create') {
  if (!USE_BACKEND()) return;
  try {
    if (action === 'create') await api('/api/prospects', { method: 'POST', body: JSON.stringify(p) });
    else if (action === 'update') await api('/api/prospects/' + encodeURIComponent(p.id), { method: 'PATCH', body: JSON.stringify(p) });
    else if (action === 'delete') await api('/api/prospects/' + encodeURIComponent(p.id), { method: 'DELETE' });
  } catch (e) { console.warn('syncProspect failed', e.message); toast('Sync prospect : ' + e.message, 'warn'); }
}
async function syncJournalBackend(j, action = 'create') {
  if (!USE_BACKEND()) return;
  try {
    if (action === 'create') await api('/api/journal', { method: 'POST', body: JSON.stringify(j) });
    else if (action === 'delete') await api('/api/journal/' + encodeURIComponent(j.id), { method: 'DELETE' });
  } catch (e) { console.warn('syncJournal failed', e.message); }
}

/* ============================================================
   3. Utils
   ============================================================ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMoney = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const todayISO = () => new Date().toISOString().slice(0, 10);

function toast(message, type = '') {
  const c = $('#toastContainer');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function confirmAction(message) {
  return window.confirm(message);
}

/* ============================================================
   4. Tabs nav
   ============================================================ */
function bindTabs() {
  $$('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
      // close mobile sidebar
      $('#sidebar').classList.remove('open');
      // refresh tab content
      if (tab === 'roadmap') renderTasks();
      if (tab === 'budget') renderBudget();
      if (tab === 'prospects') renderProspects();
      if (tab === 'journal') renderJournal();
      if (tab === 'settings') renderSettings();
    });
  });
  $('#sidebarToggle').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
  });
}

/* ============================================================
   5. Chat IA — OpenAI API
   ============================================================ */
function renderChat() {
  const container = $('#chatMessages');
  if (state.chats.length === 0) {
    container.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-ico">🎙️</div>
        <h3>Bienvenue Tancia.</h3>
        <p>Demande-moi ton brief du jour, un conseil sur un message LinkedIn, l'analyse d'un KPI, ou n'importe quelle question stratégique.</p>
        <p class="muted">Tape ton message ci-dessous, ou clique sur 🎙 pour parler à voix.</p>
      </div>`;
    return;
  }
  container.innerHTML = state.chats.map(m => `
    <div class="msg ${esc(m.role)}">
      <div class="msg-meta">${m.role === 'user' ? 'T' : '✦'}</div>
      <div class="msg-bubble">${renderMarkdown(m.content)}</div>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function renderMarkdown(text) {
  // Mini markdown : gras, italique, code, listes, retours ligne
  let html = esc(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/^- (.+)$/gm, '• $1');
  html = html.replace(/^(\d+)\. (.+)$/gm, '$1. $2');
  html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  return html;
}

async function sendChatMessage(userText) {
  if (!userText || !userText.trim()) return;

  // Mode backend : on délègue tout au serveur (chat + persistance + contexte dynamique)
  if (USE_BACKEND()) {
    state.chats.push({ id: 'tmp_' + Date.now(), role: 'user', content: userText.trim(), ts: Date.now() });
    saveStateLocal();
    renderChat();
    const typingEl = appendTypingIndicator();
    try {
      const d = await api('/api/chats', { method: 'POST', body: JSON.stringify({ content: userText.trim() }) });
      typingEl.remove();
      // Le backend nous retourne les 2 messages avec IDs définitifs ; on remplace
      state.chats = state.chats.filter(m => !m.id.startsWith('tmp_'));
      state.chats.push(d.user_msg, d.assistant_msg);
      saveStateLocal();
      renderChat();
      if (state.settings.voiceOut) speakText(d.assistant_msg.content).catch(e => console.warn('TTS', e.message));
    } catch (e) {
      typingEl.remove();
      toast('Erreur : ' + e.message, 'error');
      state.chats.push({ id: 'err_' + Date.now(), role: 'assistant', content: '⚠ Erreur : ' + e.message, ts: Date.now() });
      saveStateLocal();
      renderChat();
    }
    return;
  }

  // Mode local : utilise la clé OpenAI saisie directement dans le navigateur
  if (!state.settings.apiKey) {
    toast('Configure ta clé API OpenAI (ou un backend) dans les Réglages.', 'error');
    switchTab('settings');
    return;
  }

  state.chats.push({ id: 'local_' + Date.now(), role: 'user', content: userText.trim(), ts: Date.now() });
  saveStateLocal();
  renderChat();

  const typingEl = appendTypingIndicator();

  try {
    const dynamicContext = buildDynamicContext();
    const messages = [
      { role: 'system', content: state.settings.systemPrompt + '\n\nÉTAT ACTUEL DU TABLEAU DE BORD :\n' + dynamicContext },
      ...state.chats.slice(-20).map(m => ({ role: m.role, content: m.content }))
    ];
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + state.settings.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: state.settings.model || 'gpt-4o', messages, temperature: 0.7, max_tokens: 1200 })
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error?.message || ('HTTP ' + r.status));
    }
    const data = await r.json();
    const reply = data.choices[0].message.content;
    typingEl.remove();
    state.chats.push({ id: 'local_' + Date.now() + 'a', role: 'assistant', content: reply, ts: Date.now() });
    saveStateLocal();
    renderChat();
    if (state.settings.voiceOut) speakText(reply).catch(e => console.warn('TTS failed', e));
  } catch (e) {
    typingEl.remove();
    toast('Erreur : ' + e.message, 'error');
    state.chats.push({ id: 'err_' + Date.now(), role: 'assistant', content: '⚠ Erreur : ' + e.message, ts: Date.now() });
    saveStateLocal();
    renderChat();
  }
}

function appendTypingIndicator() {
  const container = $('#chatMessages');
  const el = document.createElement('div');
  el.className = 'msg assistant typing';
  el.innerHTML = '<div class="msg-meta">✦</div><div class="msg-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function buildDynamicContext() {
  const today = new Date();
  const isoMonth = today.toISOString().slice(0, 7);

  const activeTasks = state.tasks.filter(t => !t.done).slice(0, 15);
  const overdueTasks = activeTasks.filter(t => t.deadline && t.deadline < todayISO());

  const monthRev = state.revenues.filter(r => r.date.startsWith(isoMonth)).reduce((s, r) => s + Number(r.amount), 0);
  const monthExp = state.expenses.filter(e => e.date.startsWith(isoMonth)).reduce((s, e) => s + Number(e.amount), 0);

  const pipeline = {};
  ['a_contacter', 'contacte', 'repondu', 'rdv', 'demo', 'testeur', 'client'].forEach(s => {
    pipeline[s] = state.prospects.filter(p => p.status === s).length;
  });

  const recentJournal = state.journal.slice(0, 5).map(j => `- ${j.date} : ${j.title}`).join('\n');

  return `
- Date du jour : ${today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
- Trésorerie déclarée : ${fmtMoney(state.settings.cash)}
- Revenus du mois en cours : ${fmtMoney(monthRev)}
- Dépenses du mois en cours : ${fmtMoney(monthExp)}
- Net du mois : ${fmtMoney(monthRev - monthExp)}

PIPELINE PROSPECTS :
- À contacter : ${pipeline.a_contacter} · Contactés : ${pipeline.contacte} · Ont répondu : ${pipeline.repondu}
- RDV : ${pipeline.rdv} · Démos : ${pipeline.demo} · Testeurs activés : ${pipeline.testeur} · Clients payants : ${pipeline.client}

TÂCHES EN COURS (max 15) :
${activeTasks.map(t => `- [${t.priority}] ${t.title}${t.deadline ? ' (deadline ' + t.deadline + ')' : ''}${t.deadline && t.deadline < todayISO() ? ' ⚠ EN RETARD' : ''}`).join('\n') || '(aucune)'}

${overdueTasks.length > 0 ? '⚠ ' + overdueTasks.length + ' tâche(s) en retard à traiter en priorité.' : ''}

5 DERNIÈRES DÉCISIONS JOURNAL :
${recentJournal || '(aucune)'}`;
}

async function transcribeAudio(blob) {
  if (USE_BACKEND()) {
    const url = BACKEND_URL.replace(/\/$/, '') + '/api/voice/transcribe';
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + BACKEND_AUTH, 'Content-Type': blob.type || 'audio/webm' },
      body: blob
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || ('HTTP ' + r.status));
    }
    const data = await r.json();
    return data.text;
  }
  if (!state.settings.apiKey) throw new Error('Clé API manquante');
  const fd = new FormData();
  fd.append('file', blob, 'audio.webm');
  fd.append('model', 'whisper-1');
  fd.append('language', 'fr');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + state.settings.apiKey },
    body: fd
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error?.message || ('HTTP ' + r.status));
  }
  const data = await r.json();
  return data.text;
}

async function speakText(text) {
  const input = String(text).slice(0, 4000);
  if (USE_BACKEND()) {
    const url = BACKEND_URL.replace(/\/$/, '') + '/api/voice/speak';
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + BACKEND_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, voice: state.settings.voice || 'alloy' })
    });
    if (!r.ok) throw new Error('TTS HTTP ' + r.status);
    const blob = await r.blob();
    const u = URL.createObjectURL(blob);
    await new Audio(u).play();
    return;
  }
  if (!state.settings.apiKey) return;
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + state.settings.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', voice: state.settings.voice || 'alloy', input })
  });
  if (!r.ok) throw new Error('TTS HTTP ' + r.status);
  const blob = await r.blob();
  const u = URL.createObjectURL(blob);
  await new Audio(u).play();
}

/* ============================================================
   6. Voice recording (MediaRecorder)
   ============================================================ */
let mediaRecorder = null;
let audioChunks = [];

async function toggleMicrophone() {
  const micBtn = $('#micBtn');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    micBtn.classList.remove('recording');
    return;
  }
  if (!state.settings.apiKey) {
    toast('Configure ta clé API OpenAI dans les Réglages.', 'error');
    switchTab('settings');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.addEventListener('dataavailable', e => {
      if (e.data.size > 0) audioChunks.push(e.data);
    });
    mediaRecorder.addEventListener('stop', async () => {
      stream.getTracks().forEach(t => t.stop());
      micBtn.classList.remove('recording');
      if (!audioChunks.length) return;
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      toast('Transcription en cours…');
      try {
        const text = await transcribeAudio(blob);
        if (text && text.trim()) {
          $('#chatInput').value = text.trim();
          // auto-send
          sendChatMessage(text.trim());
          $('#chatInput').value = '';
        }
      } catch (e) {
        toast('Erreur transcription : ' + e.message, 'error');
      }
    });
    mediaRecorder.start();
    micBtn.classList.add('recording');
    toast('Enregistrement… reclique pour arrêter', '');
  } catch (e) {
    toast('Impossible d\'accéder au micro : ' + e.message, 'error');
  }
}

function bindChat() {
  const form = $('#chatForm');
  const input = $('#chatInput');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendChatMessage(text);
  });
  // Auto-grow textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });
  // Cmd/Ctrl+Enter envoie
  input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
  $('#micBtn').addEventListener('click', toggleMicrophone);
  $('#voiceOut').checked = !!state.settings.voiceOut;
  $('#voiceOut').addEventListener('change', e => {
    state.settings.voiceOut = e.target.checked;
    saveState();
  });
  $('#clearChat').addEventListener('click', async () => {
    if (!confirmAction('Effacer la conversation en cours ?')) return;
    state.chats = [];
    saveState();
    renderChat();
    if (USE_BACKEND()) {
      try { await api('/api/chats', { method: 'DELETE' }); } catch (e) { console.warn(e); }
    }
  });
  $('#quickBrief').addEventListener('click', () => {
    const prompt = 'Brief du jour. Analyse mon tableau de bord (roadmap, budget, prospects) et donne-moi les 3 priorités absolues pour aujourd\'hui. Sois directe et chiffrée.';
    sendChatMessage(prompt);
  });
  $('#quickRecap').addEventListener('click', () => {
    const prompt = 'Bilan du soir. Au regard de ma roadmap et de mes objectifs (5 testeurs avant mi-juillet, 10 clients payants avant octobre), qu\'est-ce que je devrais avoir avancé aujourd\'hui ? Que reporter ? Quelle priorité pour demain ?';
    sendChatMessage(prompt);
  });
}

function switchTab(name) {
  const btn = $(`.nav-btn[data-tab="${name}"]`);
  if (btn) btn.click();
}

/* ============================================================
   7. Tab : Roadmap
   ============================================================ */
function renderTasks() {
  const filter = $('#roadmapFilter').value;
  const list = $('#taskList');
  const tasks = state.tasks.filter(t => filter === 'all' || t.quarter === filter);
  if (tasks.length === 0) {
    list.innerHTML = '<div class="empty">Aucune tâche pour ce filtre. Ajoute-en une via le formulaire, ou demande à l\'assistant : <em>"Suggère-moi 5 tâches prioritaires pour T3 2026"</em>.</div>';
    return;
  }
  // tri : priorité puis deadline
  const prioOrder = { haute: 0, moyenne: 1, basse: 2 };
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (prioOrder[a.priority] !== prioOrder[b.priority]) return prioOrder[a.priority] - prioOrder[b.priority];
    return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1;
  });
  const today = todayISO();
  list.innerHTML = tasks.map(t => `
    <div class="task ${t.done ? 'done' : ''}">
      <div class="task-check" data-toggle="${t.id}"></div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">
          <span class="task-prio ${esc(t.priority)}">${t.priority}</span>
          <span>${esc(t.quarter)}</span>
          ${t.deadline ? `<span class="task-deadline${t.deadline < today && !t.done ? ' overdue' : ''}">📅 ${fmtDate(t.deadline)}${t.deadline < today && !t.done ? ' (en retard)' : ''}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-edit="${t.id}" title="Modifier">✏</button>
        <button class="icon-btn" data-del="${t.id}" title="Supprimer">🗑</button>
      </div>
    </div>
  `).join('');

  $$('.task-check[data-toggle]', list).forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.toggle;
      const t = state.tasks.find(x => x.id === id);
      if (t) { t.done = !t.done; saveState(); renderTasks(); await syncTaskBackend({ id: t.id, done: t.done }, 'update'); }
    });
  });
  $$('[data-del]', list).forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.del;
      if (!confirmAction('Supprimer cette tâche ?')) return;
      state.tasks = state.tasks.filter(t => t.id !== id);
      saveState();
      renderTasks();
      await syncTaskBackend({ id }, 'delete');
    });
  });
  $$('[data-edit]', list).forEach(el => {
    el.addEventListener('click', () => openTaskEditModal(el.dataset.edit));
  });
}

function openTaskEditModal(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  $('#editModalContent').innerHTML = `
    <h3>Modifier la tâche</h3>
    <form id="editTaskForm">
      <div class="form-row"><label>Titre</label><input type="text" name="title" required maxlength="200" value="${esc(t.title)}"></div>
      <div class="form-row"><label>Trimestre</label><select name="quarter">
        <option value="T2-2026" ${t.quarter === 'T2-2026' ? 'selected' : ''}>T2 2026</option>
        <option value="T3-2026" ${t.quarter === 'T3-2026' ? 'selected' : ''}>T3 2026</option>
        <option value="T4-2026" ${t.quarter === 'T4-2026' ? 'selected' : ''}>T4 2026</option>
        <option value="T1-2027" ${t.quarter === 'T1-2027' ? 'selected' : ''}>T1 2027</option>
      </select></div>
      <div class="form-row"><label>Priorité</label><select name="priority">
        <option value="haute" ${t.priority === 'haute' ? 'selected' : ''}>🔴 Haute</option>
        <option value="moyenne" ${t.priority === 'moyenne' ? 'selected' : ''}>🟡 Moyenne</option>
        <option value="basse" ${t.priority === 'basse' ? 'selected' : ''}>🟢 Basse</option>
      </select></div>
      <div class="form-row"><label>Deadline</label><input type="date" name="deadline" value="${esc(t.deadline || '')}"></div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" data-modal-close>Annuler</button>
        <button type="submit" class="btn-dark">Enregistrer</button>
      </div>
    </form>`;
  openModal();
  $('#editTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    t.title = fd.get('title').toString().trim();
    t.quarter = fd.get('quarter');
    t.priority = fd.get('priority');
    t.deadline = fd.get('deadline') || null;
    saveState(); renderTasks(); closeModal();
    await syncTaskBackend(t, 'update');
    toast('Tâche mise à jour', 'success');
  });
}

function bindRoadmap() {
  $('#roadmapFilter').addEventListener('change', renderTasks);
  $('#taskAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = {
      id: uid(),
      title: $('#taskTitle').value.trim(),
      quarter: $('#taskQuarter').value,
      priority: $('#taskPriority').value,
      deadline: $('#taskDeadline').value || null,
      done: false,
      created_at: Date.now()
    };
    if (!t.title) return;
    state.tasks.push(t);
    saveState();
    await syncTaskBackend(t, 'create');
    e.target.reset();
    $('#taskQuarter').value = 'T3-2026';
    $('#taskPriority').value = 'moyenne';
    renderTasks();
    toast('Tâche ajoutée', 'success');
  });
}

/* ============================================================
   8. Tab : Budget
   ============================================================ */
function renderBudget() {
  const isoMonth = new Date().toISOString().slice(0, 7);
  const monthRev = state.revenues.filter(r => r.date.startsWith(isoMonth)).reduce((s, r) => s + Number(r.amount), 0);
  const monthExp = state.expenses.filter(e => e.date.startsWith(isoMonth)).reduce((s, e) => s + Number(e.amount), 0);

  $('#kpiCash').textContent = fmtMoney(state.settings.cash);
  $('#cashInput').value = state.settings.cash || '';
  $('#kpiRevenue').textContent = fmtMoney(monthRev);
  $('#kpiExpenses').textContent = fmtMoney(monthExp);
  $('#kpiNet').textContent = fmtMoney(monthRev - monthExp);
  $('#kpiNet').style.color = (monthRev - monthExp) >= 0 ? 'var(--green)' : 'var(--accent)';

  renderEntries('revenue');
  renderEntries('expense');
}

function renderEntries(kind) {
  const list = kind === 'revenue' ? state.revenues : state.expenses;
  const target = kind === 'revenue' ? $('#revenuesList') : $('#expensesList');
  if (!list.length) {
    target.innerHTML = `<div class="empty">Aucune ${kind === 'revenue' ? 'recette' : 'dépense'} enregistrée.</div>`;
    return;
  }
  const sorted = list.slice().sort((a, b) => b.date.localeCompare(a.date));
  target.innerHTML = sorted.map(e => `
    <div class="entry-row ${kind === 'revenue' ? 'revenue' : 'expense'} ${e.recurring ? 'recurring' : ''}">
      <div class="entry-label">
        <div>${esc(e.label)}</div>
        <div class="date">${fmtDate(e.date)}</div>
      </div>
      <div class="entry-amount">${kind === 'revenue' ? '+' : '−'}${fmtMoney(e.amount)}</div>
      <button class="icon-btn" data-del-entry="${e.id}" data-kind="${kind}" title="Supprimer">🗑</button>
    </div>
  `).join('');
  $$('[data-del-entry]', target).forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.delEntry;
      const k = el.dataset.kind;
      if (!confirmAction('Supprimer cette entrée ?')) return;
      if (k === 'revenue') state.revenues = state.revenues.filter(x => x.id !== id);
      else state.expenses = state.expenses.filter(x => x.id !== id);
      saveState();
      renderBudget();
      await syncEntryBackend(k === 'revenue' ? 'revenues' : 'expenses', { id }, 'delete');
    });
  });
}

function bindBudget() {
  $('#cashInput').addEventListener('change', async (e) => {
    const val = parseFloat(e.target.value);
    state.settings.cash = isFinite(val) ? val : 0;
    saveState();
    renderBudget();
    await syncSettingsBackend();
  });
  $$('.entry-add').forEach(form => {
    form.querySelector('input[type=date]').value = todayISO();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const kind = form.dataset.kind;
      const entry = {
        id: uid(),
        date: fd.get('date'),
        label: fd.get('label').toString().trim(),
        amount: parseFloat(fd.get('amount'))
      };
      if (!entry.label || !isFinite(entry.amount)) return;
      if (kind === 'expense') entry.recurring = !!fd.get('recurring');
      if (kind === 'revenue') state.revenues.push(entry); else state.expenses.push(entry);
      saveState();
      await syncEntryBackend(kind === 'revenue' ? 'revenues' : 'expenses', entry, 'create');
      form.reset();
      form.querySelector('input[type=date]').value = todayISO();
      renderBudget();
      toast(kind === 'revenue' ? 'Revenu ajouté' : 'Dépense ajoutée', 'success');
    });
  });
}

/* ============================================================
   9. Tab : Prospects
   ============================================================ */
const PERSONA_LABEL = {
  parfumeur_indep: 'Parfumeur indép.',
  marque_niche: 'Marque niche',
  ecole: 'École / Formateur',
  freelance: 'Freelance senior',
  artisan_candle: 'Artisan candle / cosméto'
};
const STATUS_LABEL = {
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  repondu: 'A répondu',
  rdv: 'RDV pris',
  demo: 'Démo faite',
  testeur: 'Testeur',
  client: 'Client',
  non: 'Pas intéressé'
};

function renderProspects() {
  const filter = $('#prospectFilter').value;
  const list = state.prospects.filter(p => filter === 'all' || p.status === filter);

  // KPIs
  const kpis = $('#prospectKpis');
  const counts = {};
  Object.keys(STATUS_LABEL).forEach(k => counts[k] = state.prospects.filter(p => p.status === k).length);
  kpis.innerHTML = Object.keys(STATUS_LABEL).map(k => `
    <div class="prospect-kpi">
      <div class="v">${counts[k]}</div>
      <div class="l">${esc(STATUS_LABEL[k])}</div>
    </div>
  `).join('');

  const container = $('#prospectList');
  if (!list.length) {
    container.innerHTML = '<div class="empty">Aucun prospect pour ce filtre.</div>';
    return;
  }
  list.sort((a, b) => b.created_at - a.created_at);
  container.innerHTML = list.map(p => `
    <div class="prospect">
      <div>
        <div class="name">${esc(p.name)}</div>
        <div class="source">${[p.email, p.phone].filter(Boolean).map(esc).join(' · ') || '—'}</div>
      </div>
      <div class="persona">${esc(PERSONA_LABEL[p.persona] || p.persona)}</div>
      <div class="source">${esc(p.source || '')}</div>
      <div>
        <span class="prospect-status ${esc(p.status)}">${esc(STATUS_LABEL[p.status] || p.status)}</span>
        ${p.contacted_at ? `<div class="muted small">Contacté le ${new Date(p.contacted_at).toLocaleDateString('fr-FR')}</div>` : ''}
      </div>
      <div class="prospect-actions">
        ${p.email ? `<button class="btn-dark btn-pitch" data-pitch-prospect="${p.id}" title="Générer et envoyer un pitch IA">✉ Préparer le pitch</button>` : ''}
        <button class="icon-btn" data-edit-prospect="${p.id}" title="Modifier">✏</button>
        <button class="icon-btn" data-del-prospect="${p.id}" title="Supprimer">🗑</button>
      </div>
    </div>
  `).join('');
  $$('[data-pitch-prospect]').forEach(el => {
    el.addEventListener('click', () => openPitchModal(el.dataset.pitchProspect));
  });
  $$('[data-del-prospect]').forEach(el => {
    el.addEventListener('click', async () => {
      if (!confirmAction('Supprimer ce prospect ?')) return;
      const id = el.dataset.delProspect;
      state.prospects = state.prospects.filter(p => p.id !== id);
      saveState();
      renderProspects();
      await syncProspectBackend({ id }, 'delete');
    });
  });
  $$('[data-edit-prospect]').forEach(el => {
    el.addEventListener('click', () => openProspectEdit(el.dataset.editProspect));
  });
}

function openProspectEdit(id) {
  const p = state.prospects.find(x => x.id === id);
  if (!p) return;
  $('#editModalContent').innerHTML = `
    <h3>Modifier ${esc(p.name)}</h3>
    <form id="editProspectForm">
      <div class="form-row"><label>Nom</label><input type="text" name="name" required maxlength="120" value="${esc(p.name)}"></div>
      <div class="form-row"><label>Persona</label><select name="persona">${Object.keys(PERSONA_LABEL).map(k => `<option value="${k}" ${p.persona === k ? 'selected' : ''}>${esc(PERSONA_LABEL[k])}</option>`).join('')}</select></div>
      <div class="form-row"><label>Source</label><input type="text" name="source" maxlength="80" value="${esc(p.source || '')}"></div>
      <div class="form-row"><label>Email</label><input type="email" name="email" value="${esc(p.email || '')}"></div>
      <div class="form-row"><label>Téléphone</label><input type="tel" name="phone" maxlength="50" value="${esc(p.phone || '')}"></div>
      <div class="form-row"><label>Statut</label><select name="status">${Object.keys(STATUS_LABEL).map(k => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${esc(STATUS_LABEL[k])}</option>`).join('')}</select></div>
      <div class="form-row"><label>Notes</label><textarea name="notes" rows="4" maxlength="800">${esc(p.notes || '')}</textarea></div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" data-modal-close>Annuler</button>
        <button type="submit" class="btn-dark">Enregistrer</button>
      </div>
    </form>`;
  openModal();
  $('#editProspectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    p.name = fd.get('name').toString().trim();
    p.persona = fd.get('persona');
    p.source = fd.get('source').toString().trim();
    p.email = fd.get('email').toString().trim();
    p.phone = fd.get('phone').toString().trim();
    p.status = fd.get('status');
    p.notes = fd.get('notes').toString().trim();
    saveState(); renderProspects(); closeModal();
    await syncProspectBackend(p, 'update');
    toast('Prospect mis à jour', 'success');
  });
}

async function openPitchModal(id) {
  const p = state.prospects.find(x => x.id === id);
  if (!p) return;
  if (!USE_BACKEND()) { toast('Connecte le backend (Réglages) pour générer un pitch', 'error'); return; }
  if (!p.email) { toast('Ce prospect n\'a pas d\'e-mail', 'error'); return; }

  // 1) État de chargement pendant la génération IA
  $('#editModalContent').innerHTML = `
    <h3>Pitch pour ${esc(p.name)}</h3>
    <p class="muted">✨ Génération du mail par l'IA…</p>`;
  openModal();

  let pitch;
  try {
    pitch = await api('/api/prospects/' + encodeURIComponent(id) + '/pitch', { method: 'POST' });
  } catch (e) {
    $('#editModalContent').innerHTML = `<h3>Pitch pour ${esc(p.name)}</h3>
      <p class="muted">❌ Génération échouée : ${esc(e.message)}</p>
      <div class="form-actions"><button type="button" class="btn-ghost" data-modal-close>Fermer</button></div>`;
    return;
  }

  // 2) Relecture / édition avant envoi
  $('#editModalContent').innerHTML = `
    <h3>Pitch pour ${esc(p.name)}</h3>
    <p class="muted small">Destinataire : ${esc(p.email)} · relis et ajuste avant d'envoyer.</p>
    <form id="pitchForm">
      <div class="form-row"><label>Objet</label><input type="text" name="subject" maxlength="200" required value="${esc(pitch.subject || '')}"></div>
      <div class="form-row"><label>Message</label><textarea name="body" rows="12" maxlength="4000" required>${esc(pitch.body || '')}</textarea></div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" data-modal-close>Annuler</button>
        <button type="submit" class="btn-dark">✉ Envoyer via Resend</button>
      </div>
    </form>`;

  $('#pitchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const subject = fd.get('subject').toString().trim();
    const body = fd.get('body').toString().trim();
    if (!subject || !body) { toast('Objet et message requis', 'error'); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Envoi…';
    try {
      const r = await api('/api/prospects/' + encodeURIComponent(id) + '/send', {
        method: 'POST', body: JSON.stringify({ subject, body })
      });
      // Statut → Contacté + date, en local
      p.status = 'contacte';
      p.contacted_at = r.contacted_at ? new Date(r.contacted_at).getTime() : Date.now();
      saveState();
      renderProspects();
      closeModal();
      toast('✓ Mail envoyé à ' + p.name + ' · statut « Contacté »', 'success');
    } catch (err) {
      btn.disabled = false; btn.textContent = '✉ Envoyer via Resend';
      toast('Envoi échoué : ' + err.message, 'error');
    }
  });
}

function bindProspects() {
  $('#prospectFilter').addEventListener('change', renderProspects);
  $('#prospectAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = {
      id: uid(),
      name: fd.get('name').toString().trim(),
      persona: fd.get('persona'),
      source: fd.get('source').toString().trim(),
      email: fd.get('email').toString().trim(),
      phone: (fd.get('phone') || '').toString().trim(),
      status: fd.get('status'),
      notes: '',
      created_at: Date.now()
    };
    if (!p.name) return;
    state.prospects.push(p);
    saveState();
    await syncProspectBackend(p, 'create');
    e.target.reset();
    renderProspects();
    toast('Prospect ajouté', 'success');
  });

  // Bouton sync PhantomBuster (ajouté dans renderProspects → tab-actions)
  const syncBtn = $('#pbSyncBtn');
  if (syncBtn) syncBtn.addEventListener('click', syncPhantomBuster);
}

async function syncPhantomBuster() {
  if (!USE_BACKEND()) {
    toast('Configure d\'abord le backend dans Réglages pour utiliser PhantomBuster.', 'error');
    switchTab('settings');
    return;
  }
  const btn = $('#pbSyncBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Synchro PhantomBuster…'; }
  try {
    const d = await api('/api/phantombuster/sync', { method: 'POST' });
    toast(d.message || 'Sync OK', 'success');
    // Recharge la liste des prospects
    await loadStateBackend();
    renderProspects();
  } catch (e) {
    toast('Sync : ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⟳ Sync PhantomBuster'; }
  }
}

/* ============================================================
   10. Tab : Journal
   ============================================================ */
function renderJournal() {
  const list = $('#journalList');
  if (!state.journal.length) {
    list.innerHTML = '<div class="empty">Aucune décision enregistrée. Le journal devient précieux quand tu as 3+ mois de recul.</div>';
    return;
  }
  const sorted = state.journal.slice().sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = sorted.map(j => `
    <div class="journal-entry">
      <div class="je-date">${fmtDate(j.date)}</div>
      <div class="je-title">${esc(j.title)}</div>
      <div class="je-reason">${esc(j.reason)}</div>
      <div class="je-actions"><button class="icon-btn" data-del-journal="${j.id}" title="Supprimer">🗑</button></div>
    </div>
  `).join('');
  $$('[data-del-journal]').forEach(el => {
    el.addEventListener('click', async () => {
      if (!confirmAction('Supprimer cette entrée du journal ?')) return;
      const id = el.dataset.delJournal;
      state.journal = state.journal.filter(j => j.id !== id);
      saveState();
      renderJournal();
      await syncJournalBackend({ id }, 'delete');
    });
  });
}

function bindJournal() {
  const form = $('#journalAddForm');
  form.querySelector('input[type=date]').value = todayISO();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const j = {
      id: uid(),
      date: fd.get('date'),
      title: fd.get('title').toString().trim(),
      reason: fd.get('reason').toString().trim(),
      created_at: Date.now()
    };
    if (!j.title || !j.reason) return;
    state.journal.unshift(j);
    saveState();
    await syncJournalBackend(j, 'create');
    e.target.reset();
    form.querySelector('input[type=date]').value = todayISO();
    renderJournal();
    toast('Décision enregistrée', 'success');
  });
}

/* ============================================================
   11. Tab : Settings
   ============================================================ */
function renderSettings() {
  $('#backendUrl').value = BACKEND_URL;
  $('#backendAuth').value = BACKEND_AUTH;
  $('#backendStatus').innerHTML = USE_BACKEND()
    ? '✓ Backend connecté · ' + esc(BACKEND_URL)
    : '⚠ Mode local actif (données sur ce navigateur uniquement)';
  $('#apiKey').value = state.settings.apiKey || '';
  $('#apiKeyStatus').textContent = state.settings.apiKey ? '✓ Clé configurée (cachée)' : '⚠ Aucune clé locale. L\'assistant ne fonctionnera que si tu utilises le backend cloud.';
  $('#modelChoice').value = state.settings.model || 'gpt-4o';
  $('#voiceChoice').value = state.settings.voice || 'alloy';
  $('#systemPrompt').value = state.settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  $('#pbAgentIds').value = (state.settings.pbAgentIds || []).join('\n');
}

function bindSettings() {
  // === Backend ===
  $('#backendSave').addEventListener('click', async () => {
    const url = $('#backendUrl').value.trim().replace(/\/$/, '');
    const auth = $('#backendAuth').value.trim();
    if (!url || !auth) { toast('URL et clé requises', 'error'); return; }
    BACKEND_URL = url;
    BACKEND_AUTH = auth;
    localStorage.setItem(BACKEND_URL_KEY, url);
    localStorage.setItem(BACKEND_AUTH_KEY, auth);
    try {
      await api('/api/state');
      toast('✓ Backend connecté · chargement…', 'success');
      await loadState();
      renderAll();
    } catch (e) {
      toast('Connexion échouée : ' + e.message, 'error');
      // rollback
      BACKEND_URL = ''; BACKEND_AUTH = '';
      localStorage.removeItem(BACKEND_URL_KEY);
      localStorage.removeItem(BACKEND_AUTH_KEY);
    }
    renderSettings();
  });
  $('#backendTest').addEventListener('click', async () => {
    const url = ($('#backendUrl').value.trim() || BACKEND_URL).replace(/\/$/, '');
    if (!url) { toast('URL backend manquante', 'error'); return; }
    try {
      const r = await fetch(url + '/health');
      const d = await r.json();
      toast(d.ok ? '✓ Backend OK · DB OK' : '✗ Backend KO', d.ok ? 'success' : 'error');
    } catch (e) {
      toast('Backend injoignable : ' + e.message, 'error');
    }
  });
  $('#backendDisconnect').addEventListener('click', () => {
    if (!confirmAction('Repasser en mode local ? Les futures données seront stockées sur ce navigateur uniquement.')) return;
    BACKEND_URL = ''; BACKEND_AUTH = '';
    localStorage.removeItem(BACKEND_URL_KEY);
    localStorage.removeItem(BACKEND_AUTH_KEY);
    toast('Backend déconnecté · mode local', 'warn');
    renderSettings();
  });

  // === PhantomBuster agents ===
  $('#pbAgentsSave').addEventListener('click', async () => {
    const ids = $('#pbAgentIds').value.split('\n').map(s => s.trim()).filter(Boolean);
    state.settings.pbAgentIds = ids;
    saveState();
    await syncSettingsBackend();
    toast(ids.length + ' agent(s) PhantomBuster enregistré(s)', 'success');
  });

  $('#apiKeySave').addEventListener('click', () => {
    const v = $('#apiKey').value.trim();
    if (!v.startsWith('sk-') && v.length > 0) {
      if (!confirmAction('La clé ne commence pas par "sk-". Continuer ?')) return;
    }
    state.settings.apiKey = v;
    saveState();
    renderSettings();
    toast('Clé API enregistrée', 'success');
  });
  $('#modelChoice').addEventListener('change', async e => {
    state.settings.model = e.target.value;
    saveState();
    await syncSettingsBackend();
    toast('Modèle : ' + e.target.value);
  });
  $('#voiceChoice').addEventListener('change', async e => {
    state.settings.voice = e.target.value;
    saveState();
    await syncSettingsBackend();
  });
  $('#voiceTest').addEventListener('click', async () => {
    if (!state.settings.apiKey) { toast('Configure la clé API d\'abord', 'error'); return; }
    try {
      await speakText('Bonjour Tancia. Test de la voix de votre assistant Olfacode. Tout fonctionne.');
    } catch (e) {
      toast('Erreur test voix : ' + e.message, 'error');
    }
  });
  $('#systemPromptSave').addEventListener('click', async () => {
    state.settings.systemPrompt = $('#systemPrompt').value;
    saveState();
    await syncSettingsBackend();
    toast('Instructions enregistrées', 'success');
  });
  $('#systemPromptReset').addEventListener('click', () => {
    if (!confirmAction('Restaurer les instructions par défaut ?')) return;
    state.settings.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    saveState();
    renderSettings();
    toast('Instructions réinitialisées', 'success');
  });

  $('#exportData').addEventListener('click', () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pilote-olfacode-' + todayISO() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Données exportées', 'success');
  });
  $('#importDataBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirmAction('Importer ces données ? Cela écrasera tes données actuelles.')) return;
        Object.assign(state.settings, data.settings || {});
        state.chats = data.chats || [];
        state.tasks = data.tasks || [];
        state.revenues = data.revenues || [];
        state.expenses = data.expenses || [];
        state.prospects = data.prospects || [];
        state.journal = data.journal || [];
        saveState();
        renderAll();
        toast('Données importées', 'success');
      } catch (e) {
        toast('Fichier invalide : ' + e.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  $('#resetData').addEventListener('click', () => {
    if (!confirmAction('⚠ DANGER : effacer TOUTES tes données (chats, roadmap, budget, prospects, journal) ? Cette action est irréversible. Penses-tu à exporter d\'abord ?')) return;
    if (!confirmAction('Vraiment sûre ? Confirmer une seconde fois.')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
}

/* ============================================================
   12. Modal
   ============================================================ */
function openModal() { $('#editModal').hidden = false; }
function closeModal() { $('#editModal').hidden = true; }
function bindModal() {
  $$('[data-modal-close]', $('#editModal')).forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('click', e => {
    if (e.target.matches('[data-modal-close]') || e.target === $('#editModal .modal-bg')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ============================================================
   13. Initial seed (1ère utilisation)
   ============================================================ */
function seedInitialData() {
  if (state.tasks.length > 0 || state.expenses.length > 0) return;
  // Tâches initiales basées sur ta vraie roadmap actuelle
  state.tasks = [
    { id: uid(), title: 'Scraper 30 parfumeurs indépendants sur LinkedIn', quarter: 'T3-2026', priority: 'haute', deadline: '2026-06-15', done: false, created_at: Date.now() },
    { id: uid(), title: 'Envoyer 10 cold emails par semaine (template Persona 1)', quarter: 'T3-2026', priority: 'haute', deadline: '2026-07-15', done: false, created_at: Date.now() },
    { id: uid(), title: 'Activer 5 artisans testeurs gratuits', quarter: 'T3-2026', priority: 'haute', deadline: '2026-07-15', done: false, created_at: Date.now() },
    { id: uid(), title: 'Convertir 3 testeurs en clients payants', quarter: 'T3-2026', priority: 'haute', deadline: '2026-08-31', done: false, created_at: Date.now() },
    { id: uid(), title: 'Déposer marque Olfacode à l\'INPI (290€)', quarter: 'T3-2026', priority: 'moyenne', deadline: '2026-07-31', done: false, created_at: Date.now() },
    { id: uid(), title: 'Souscrire RC Pro (Hiscox ~250€/an)', quarter: 'T3-2026', priority: 'moyenne', deadline: '2026-07-31', done: false, created_at: Date.now() },
    { id: uid(), title: 'Configurer DNS olfacode.com → Render', quarter: 'T2-2026', priority: 'haute', deadline: '2026-06-10', done: false, created_at: Date.now() },
    { id: uid(), title: 'Basculer Stripe en mode LIVE', quarter: 'T2-2026', priority: 'haute', deadline: '2026-06-10', done: false, created_at: Date.now() },
    { id: uid(), title: '10 clients payants Olfacode Protect', quarter: 'T4-2026', priority: 'haute', deadline: '2026-10-15', done: false, created_at: Date.now() },
    { id: uid(), title: 'Dossier Bpifrance Bourse French Tech (30k€)', quarter: 'T3-2026', priority: 'moyenne', deadline: '2026-09-30', done: false, created_at: Date.now() },
    { id: uid(), title: 'Plan éditorial LinkedIn (2 posts/semaine)', quarter: 'T3-2026', priority: 'moyenne', deadline: null, done: false, created_at: Date.now() },
  ];
  // Dépenses récurrentes connues
  const today = todayISO();
  state.expenses = [
    { id: uid(), date: today, label: 'Render Web Service', amount: 19, recurring: true },
    { id: uid(), date: today, label: 'Supabase (DB)', amount: 25, recurring: true },
    { id: uid(), date: today, label: 'Claude Pro / OpenAI API', amount: 18, recurring: true },
    { id: uid(), date: today, label: 'Domaine Gandi (.com .fr .net)', amount: 2.5, recurring: true },
  ];
  saveState();
}

/* ============================================================
   14. Boot
   ============================================================ */
function renderAll() {
  renderChat();
  renderTasks();
  renderBudget();
  renderProspects();
  renderJournal();
  renderSettings();
}

async function init() {
  await loadState();
  if (!USE_BACKEND()) seedInitialData(); // seed seulement en mode local
  bindTabs();
  bindChat();
  bindRoadmap();
  bindBudget();
  bindProspects();
  bindJournal();
  bindSettings();
  bindModal();
  renderAll();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW reg failed', e));
  }
  if (!USE_BACKEND() && !state.settings.apiKey) {
    setTimeout(() => {
      toast('Configure ta clé OpenAI ou un backend cloud dans ⚙ Réglages', 'warn');
    }, 600);
  }
}

document.addEventListener('DOMContentLoaded', init);
