// ==========================================
// 📦 DATA & CONFIG
// ==========================================

// ==========================================
// 🤖 TALK TO BUDDY
// ==========================================

function goToChat() {
  // Give immediate feedback so the user knows it's working
  showToast('Connecting to your buddy... 🤖');
  
  // Add a slight delay so the toast animation plays before navigating
  setTimeout(() => {
    window.location.href = '/chats';
  }, 600);
}

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/JamesFT/Database-Quotes-JSON/master/quotes.json';
const CACHE_KEY = 'fmm_quotes_cache';
const CACHE_TIME_KEY = 'fmm_quotes_cache_time';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const moodEmojis = { sad:'😔', angry:'😡', anxious:'😰', tired:'😴', normal:'🙂' };
const moodColors = { sad:'#5b9bd5', angry:'#e74c3c', anxious:'#f39c12', tired:'#8e8e93', normal:'#2ecc71' };

// Hardcoded fallback quotes (used when offline + no cache)
const fallbackQuotes = [
  { quoteText:"This feeling is temporary.", quoteAuthor:"Unknown" },
  { quoteText:"You survived 100% of your worst days.", quoteAuthor:"Unknown" },
  { quoteText:"Calm mind = Strong decisions.", quoteAuthor:"Unknown" },
  { quoteText:"Breathe. You're going to be okay.", quoteAuthor:"Unknown" },
  { quoteText:"Stars can't shine without darkness.", quoteAuthor:"D.H. Sidebottom" },
  { quoteText:"You are stronger than you think.", quoteAuthor:"A.A. Milne" },
  { quoteText:"Feelings are visitors. Let them come and go.", quoteAuthor:"Mooji" },
  { quoteText:"The only way out is through.", quoteAuthor:"Robert Frost" },
  { quoteText:"Be gentle with yourself.", quoteAuthor:"Unknown" },
  { quoteText:"Every storm runs out of rain.", quoteAuthor:"Maya Angelou" },
  { quoteText:"Inhale courage. Exhale fear.", quoteAuthor:"Unknown" },
  { quoteText:"It's okay to not be okay.", quoteAuthor:"Unknown" },
  { quoteText:"Healing is not linear.", quoteAuthor:"Unknown" },
  { quoteText:"Rest is not quitting. It's recharging.", quoteAuthor:"Unknown" },
  { quoteText:"You are not your thoughts.", quoteAuthor:"Eckhart Tolle" },
  { quoteText:"Progress, not perfection.", quoteAuthor:"Unknown" },
  { quoteText:"Don't believe everything you think.", quoteAuthor:"Unknown" },
  { quoteText:"Self-care is not selfish.", quoteAuthor:"Unknown" },
  { quoteText:"You are enough just as you are.", quoteAuthor:"Meghan Markle" },
  { quoteText:"Peace begins with a pause.", quoteAuthor:"Unknown" },
];

// ==========================================
// 🧠 STATE
// ==========================================
let selectedMood = null;
let moodHistory = JSON.parse(localStorage.getItem('fmm_history') || '[]');
let allQuotes = [];
let filteredQuotes = [];
let lastQuoteIndex = -1;
let quoteSource = 'loading'; // 'online' | 'cached' | 'offline'

// Timers
let tratakTotalTime=120, tratakRemaining=120, tratakInterval=null, tratakRunning=false;
let breathType='box', breathDuration=60, breathRemaining=60, breathInterval=null, breathRunning=false, breathPhaseInterval=null;
let silentTotalTime=120, silentRemaining=120, silentInterval=null, silentRunning=false;

// ==========================================
// 🔊 AUDIO
// ==========================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBell() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(528, ctx.currentTime);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 2.5);
}

function playSoftTick() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
}

// ==========================================
// 🌐 QUOTE FETCHING SYSTEM
// ==========================================

async function fetchQuotes() {
  showQuoteLoading(true);

  // 1) Try to load from fresh cache first
  const cached = loadFromCache();
  if (cached) {
    allQuotes = cached;
    filteredQuotes = [...allQuotes];
    quoteSource = 'cached';
    showQuoteLoading(false);
    showRandomQuote();
    updateSourceBadge();
    console.log(`📦 Loaded ${allQuotes.length} quotes from cache`);

    // Still try to refresh in background if cache is old
    const cacheTime = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');
    if (Date.now() - cacheTime > CACHE_DURATION) {
      fetchFromGitHub(true); // silent background refresh
    }
    return;
  }

  // 2) Fetch from GitHub
  const success = await fetchFromGitHub(false);

  // 3) If failed, use fallback
  if (!success) {
    allQuotes = [...fallbackQuotes];
    filteredQuotes = [...allQuotes];
    quoteSource = 'offline';
    showQuoteLoading(false);
    showRandomQuote();
    updateSourceBadge();
    console.log(`⚠️ Using ${fallbackQuotes.length} offline fallback quotes`);
  }
}

async function fetchFromGitHub(silent = false) {
  try {
    if (!silent) showQuoteLoading(true);

    const response = await fetch(GITHUB_RAW_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // Filter out quotes with empty text
    const validQuotes = data.filter(q =>
      q.quoteText && q.quoteText.trim().length > 0
    );

    if (validQuotes.length === 0) throw new Error('No valid quotes');

    allQuotes = validQuotes;
    filteredQuotes = [...allQuotes];
    quoteSource = 'online';

    // Save to cache
    saveToCache(validQuotes);

    if (!silent) {
      showQuoteLoading(false);
      showRandomQuote();
    }

    updateSourceBadge();
    showToast(`✅ Fetched ${validQuotes.length} quotes from GitHub!`);
    console.log(`🌐 Fetched ${validQuotes.length} quotes from GitHub`);
    return true;

  } catch (error) {
    console.error('❌ GitHub fetch failed:', error.message);
    if (!silent) {
      showToast(`⚠️ Fetch failed: ${error.message}. Using fallback.`);
    }
    return false;
  }
}

function saveToCache(quotes) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(quotes));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    console.log(`💾 Cached ${quotes.length} quotes`);
  } catch (e) {
    console.warn('Cache save failed (storage full?):', e);
  }
}

function loadFromCache() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (!data) return null;
    const quotes = JSON.parse(data);
    if (!Array.isArray(quotes) || quotes.length === 0) return null;
    return quotes;
  } catch (e) {
    return null;
  }
}

async function refetchQuotes() {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spinning');
  btn.disabled = true;

  // Clear cache to force fresh fetch
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIME_KEY);

  const success = await fetchFromGitHub(false);

  if (!success) {
    // Try cache one more time, else fallback
    const cached = loadFromCache();
    if (cached) {
      allQuotes = cached;
      filteredQuotes = [...allQuotes];
      quoteSource = 'cached';
    } else {
      allQuotes = [...fallbackQuotes];
      filteredQuotes = [...allQuotes];
      quoteSource = 'offline';
    }
    showQuoteLoading(false);
    showRandomQuote();
    updateSourceBadge();
  }

  btn.classList.remove('spinning');
  btn.disabled = false;
}

// ==========================================
// 💬 QUOTE DISPLAY
// ==========================================

function showQuoteLoading(show) {
  document.getElementById('quoteLoading').style.display = show ? 'flex' : 'none';
  document.getElementById('quoteContent').style.display = show ? 'none' : 'block';
}

function showRandomQuote() {
  const pool = filteredQuotes.length > 0 ? filteredQuotes : allQuotes;
  if (pool.length === 0) return;

  let idx;
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (idx === lastQuoteIndex && pool.length > 1);
  lastQuoteIndex = idx;

  const q = pool[idx];
  const textEl = document.getElementById('quoteText');
  const authorEl = document.getElementById('quoteAuthor');

  // Trigger animation
  textEl.style.animation = 'none';
  textEl.offsetHeight;
  textEl.style.animation = 'fadeInQuote 0.6s ease';

  textEl.textContent = q.quoteText;
  authorEl.textContent = q.quoteAuthor ? `— ${q.quoteAuthor}` : '— Unknown';

  document.getElementById('quoteCount').textContent =
    `${pool.length.toLocaleString()} quotes available`;
}

function updateSourceBadge() {
  const badge = document.getElementById('quoteSource');
  const label = document.getElementById('sourceLabel');

  badge.className = 'quote-source ' + quoteSource;

  const labels = {
    online: '🌐 Live from GitHub',
    cached: '💾 Cached (Offline Ready)',
    offline: '📴 Offline Fallback'
  };
  label.textContent = labels[quoteSource] || 'Unknown';
}

function searchQuotes(query) {
  const resultsEl = document.getElementById('searchResults');
  query = query.trim().toLowerCase();

  if (!query) {
    filteredQuotes = [...allQuotes];
    resultsEl.style.display = 'none';
    document.getElementById('quoteDisplay').style.display = '';
    showRandomQuote();
    return;
  }

  filteredQuotes = allQuotes.filter(q =>
    q.quoteText.toLowerCase().includes(query) ||
    (q.quoteAuthor && q.quoteAuthor.toLowerCase().includes(query))
  );

  if (filteredQuotes.length === 0) {
    document.getElementById('quoteDisplay').style.display = 'none';
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
      <div class="glass-card" style="text-align:center;padding:40px">
        <div style="font-size:40px;margin-bottom:12px">🔍</div>
        <p style="color:var(--text-secondary)">No quotes found for "<strong>${query}</strong>"</p>
      </div>`;
    return;
  }

  // Show matching quotes as a list
  document.getElementById('quoteDisplay').style.display = 'none';
  resultsEl.style.display = 'block';

  let html = `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;font-weight:600">${filteredQuotes.length} RESULTS</div>`;
  filteredQuotes.slice(0, 15).forEach(q => {
    const highlighted = q.quoteText.replace(
      new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
      '<mark style="background:rgba(168,85,247,0.3);color:white;padding:1px 3px;border-radius:3px">$1</mark>'
    );
    html += `
      <div class="glass-card" style="padding:16px;margin-bottom:8px;cursor:pointer"
        onclick="document.getElementById('quoteSearch').value='';searchQuotes('');">
        <div style="font-size:14px;line-height:1.5;margin-bottom:6px">"${highlighted}"</div>
        <div style="font-size:11px;color:var(--text-secondary);font-style:italic">— ${q.quoteAuthor || 'Unknown'}</div>
      </div>`;
  });

  if (filteredQuotes.length > 15) {
    html += `<p style="text-align:center;color:var(--text-secondary);font-size:12px;padding:10px">+ ${filteredQuotes.length - 15} more results</p>`;
  }

  resultsEl.innerHTML = html;
}

// ==========================================
// 🧭 NAVIGATION
// ==========================================

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  if (page === 'history') renderHistory();
  if (page === 'home') resetHomeView();
}

// ==========================================
// 🏠 HOME
// ==========================================

function updateGreeting() {
  const hour = new Date().getHours();
  let g = 'Good Evening 🌙';
  if (hour < 12) g = 'Good Morning ☀️';
  else if (hour < 17) g = 'Good Afternoon 🌤️';
  document.getElementById('greeting').textContent = g;
}

function selectMood(el) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  selectedMood = el.dataset.mood;
  document.getElementById('fixBtn').disabled = false;
}

function resetHomeView() {
  document.getElementById('mood-selection').style.display = 'block';
  const r = document.getElementById('fix-result');
  r.classList.remove('active'); r.innerHTML = '';
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  selectedMood = null;
  document.getElementById('fixBtn').disabled = true;
}

function fixMyMood() {
  if (!selectedMood) return;
  moodHistory.unshift({
    mood: selectedMood,
    emoji: moodEmojis[selectedMood],
    timestamp: Date.now(),
    fixed: true
  });
  localStorage.setItem('fmm_history', JSON.stringify(moodHistory));
  document.getElementById('mood-selection').style.display = 'none';
  const result = document.getElementById('fix-result');
  result.innerHTML = getMoodFixHTML(selectedMood);
  result.classList.add('active');
  showToast('Mood logged! Let\'s fix it 💪');
}

function getMoodFixHTML(mood) {
  const fixes = {
    sad: `
      <div class="fix-header"><span class="fix-emoji">😔</span><h2>It's Okay to Feel Sad</h2><p>Here are some things to help</p></div>
      <div class="fix-card" onclick="openBreathing()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(91,155,213,0.15)">🌬️</div><div class="fix-card-title">Calming Breathing</div></div>
        <div class="fix-card-desc">3 minutes of slow, deep breathing</div><div class="duration-badge">3 min</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="fix-card" onclick="navigateTo('quotes')">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(168,85,247,0.15)">💜</div><div class="fix-card-title">Motivational Quote</div></div>
        <div class="fix-card-desc">Read something uplifting</div><div class="fix-card-action">Read Quote →</div>
      </div>
      <div class="gratitude-card"><h4>🙏 Gratitude Moment</h4><textarea class="journal-area" placeholder="Write one thing you're grateful for..." rows="3"></textarea></div>
      <div class="reassurance"><span class="reassure-icon">💙</span>Sadness is natural. Allow yourself to feel, then gently let go.</div>
      <button class="back-btn" onclick="resetHomeView()">← Back</button>`,
    angry: `
      <div class="fix-header"><span class="fix-emoji">😡</span><h2>Let's Cool Down</h2><p>Release the tension step by step</p></div>
      <div class="fix-card" onclick="openBreathing()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(231,76,60,0.15)">📦</div><div class="fix-card-title">Box Breathing</div></div>
        <div class="fix-card-desc">1 minute to regulate your nervous system</div><div class="duration-badge">1 min</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="fix-card" onclick="openTimerMed()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(6,182,212,0.15)">🎵</div><div class="fix-card-title">Calming Silence</div></div>
        <div class="fix-card-desc">2 minutes of silent meditation</div><div class="duration-badge">2 min</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="gratitude-card" style="background:linear-gradient(135deg,rgba(231,76,60,0.1),rgba(243,156,18,0.1));border-color:rgba(231,76,60,0.2)">
        <h4>📝 Release It</h4><textarea class="journal-area" placeholder="Write what triggered you..." rows="4"></textarea>
      </div>
      <div class="reassurance"><span class="reassure-icon">🧊</span>Anger is energy. Channel it wisely. You're choosing calm — that takes strength.</div>
      <button class="back-btn" onclick="resetHomeView()">← Back</button>`,
    anxious: `
      <div class="fix-header"><span class="fix-emoji">😰</span><h2>You're Safe Right Now</h2><p>Let's bring you back to the present</p></div>
      <div class="fix-card" onclick="openGrounding()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(243,156,18,0.15)">🌿</div><div class="fix-card-title">5-4-3-2-1 Grounding</div></div>
        <div class="fix-card-desc">Anchor yourself in the present moment</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="fix-card" onclick="openBreathing()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(108,92,231,0.15)">🌬️</div><div class="fix-card-title">Slow Breathing</div></div>
        <div class="fix-card-desc">4-7-8 breathing for calm</div><div class="duration-badge">3 min</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="reassurance"><span class="reassure-icon">🛡️</span>Your anxiety is lying to you. You are not in danger.<br><strong>You are safe. You are here. You are okay.</strong></div>
      <button class="back-btn" onclick="resetHomeView()">← Back</button>`,
    tired: `
      <div class="fix-header"><span class="fix-emoji">😴</span><h2>Rest Is Productive</h2><p>Your body is asking for a pause</p></div>
      <div class="fix-card" onclick="openTimerMed()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(142,142,147,0.15)">🧘</div><div class="fix-card-title">Power Rest</div></div>
        <div class="fix-card-desc">5 minutes of silent rest to recharge</div><div class="duration-badge">5 min</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="fix-card" onclick="openBreathing()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(6,182,212,0.15)">🌬️</div><div class="fix-card-title">Energizing Breath</div></div>
        <div class="fix-card-desc">Quick breathing to boost alertness</div><div class="duration-badge">2 min</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="fix-card" onclick="navigateTo('quotes')">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(168,85,247,0.15)">⚡</div><div class="fix-card-title">Motivation Boost</div></div>
        <div class="fix-card-desc">Powerful words to reignite your fire</div><div class="fix-card-action">Get Inspired →</div>
      </div>
      <div class="reassurance"><span class="reassure-icon">🔋</span>Rest is not quitting — it's recharging. Take this break. You've earned it.</div>
      <button class="back-btn" onclick="resetHomeView()">← Back</button>`,
    normal: `
      <div class="fix-header"><span class="fix-emoji">🙂</span><h2>You're Doing Great!</h2><p>Let's make this even better</p></div>
      <div class="fix-card" onclick="openTratak()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(46,204,113,0.15)">🕯️</div><div class="fix-card-title">Tratak Focus</div></div>
        <div class="fix-card-desc">Enhance concentration and inner calm</div><div class="duration-badge">5 min</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="fix-card" onclick="openTimerMed()">
        <div class="fix-card-header"><div class="fix-icon" style="background:rgba(108,92,231,0.15)">🧘</div><div class="fix-card-title">Mindful Meditation</div></div>
        <div class="fix-card-desc">Deepen your peace with silence</div><div class="duration-badge">5 min</div><div class="fix-card-action">Start →</div>
      </div>
      <div class="gratitude-card"><h4>🌟 Amplify Good Mood</h4><textarea class="journal-area" placeholder="What made you feel good today?" rows="3"></textarea></div>
      <div class="reassurance"><span class="reassure-icon">✨</span>Feeling normal is wonderful. Appreciate this calm — it's your strength.</div>
      <button class="back-btn" onclick="resetHomeView()">← Back</button>`
  };
  return fixes[mood] || '';
}

// ==========================================
// 📊 HISTORY
// ==========================================

function renderHistory() {
  const list = document.getElementById('historyList');
  const clearBtn = document.getElementById('clearBtn');
  if (moodHistory.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>No mood entries yet.<br>Start by selecting your mood!</p></div>`;
    clearBtn.style.display = 'none';
  } else {
    let html = '';
    moodHistory.slice(0, 20).forEach(entry => {
      const d = new Date(entry.timestamp);
      html += `<div class="history-item">
        <span class="history-emoji">${entry.emoji}</span>
        <div class="history-info">
          <div class="history-mood">${entry.mood}</div>
          <div class="history-date">${d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} at ${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <span class="history-badge fixed">Fixed ✓</span>
      </div>`;
    });
    list.innerHTML = html;
    clearBtn.style.display = 'block';
  }
  document.getElementById('statTotal').textContent = moodHistory.length;
  document.getElementById('statFixed').textContent = moodHistory.filter(e => e.fixed).length;
  // Streak
  let streak = 0;
  const uniqueDays = [...new Set(moodHistory.map(e => new Date(e.timestamp).toDateString()))].sort((a,b) => new Date(b)-new Date(a));
  for (let i = 0; i < uniqueDays.length; i++) {
    const exp = new Date(); exp.setDate(exp.getDate() - i);
    if (uniqueDays[i] === exp.toDateString()) streak++; else break;
  }
  document.getElementById('statStreak').textContent = streak;
  renderMoodChart();
}

function renderMoodChart() {
  const counts = { sad:0, angry:0, anxious:0, tired:0, normal:0 };
  moodHistory.forEach(e => { if (counts[e.mood] !== undefined) counts[e.mood]++; });
  const max = Math.max(...Object.values(counts), 1);
  let html = '';
  Object.keys(counts).forEach(mood => {
    const h = (counts[mood]/max)*100;
    html += `<div class="chart-bar-wrapper">
      <div class="chart-bar" style="height:${Math.max(h,4)}%;background:${moodColors[mood]}"></div>
      <div class="chart-label">${moodEmojis[mood]}<br>${counts[mood]}</div>
    </div>`;
  });
  document.getElementById('moodChart').innerHTML = html;
}

function clearHistory() {
  if (confirm('Clear all mood history?')) {
    moodHistory = [];
    localStorage.setItem('fmm_history', '[]');
    renderHistory();
    showToast('History cleared');
  }
}

// ==========================================
// 🔔 TOAST
// ==========================================

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ==========================================
// 🪟 MODALS
// ==========================================

function openTratak() { document.getElementById('modal-tratak').classList.add('active'); }
function openBreathing() { document.getElementById('modal-breathing').classList.add('active'); }
function openTimerMed() { document.getElementById('modal-timer').classList.add('active'); }
function openGrounding() {
  document.getElementById('modal-grounding').classList.add('active');
  document.querySelectorAll('.grounding-step').forEach(s => s.classList.remove('completed'));
  document.getElementById('groundingComplete').style.display = 'none';
}

function closeModal(name) {
  document.getElementById('modal-' + name).classList.remove('active');
  if (name === 'tratak') resetTratak();
  if (name === 'breathing') resetBreathing();
  if (name === 'timer') resetSilentTimer();
}

function formatTime(s) {
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
}

// ==========================================
// 🕯️ TRATAK
// ==========================================

function setTratakTime(btn, sec) {
  document.querySelectorAll('#modal-tratak .timer-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  tratakTotalTime = sec; resetTratak();
}

function toggleTratak() {
  if (tratakRunning) {
    clearInterval(tratakInterval); tratakRunning = false;
    document.getElementById('tratakPlayBtn').textContent = '▶';
  } else {
    tratakRunning = true;
    document.getElementById('tratakPlayBtn').textContent = '⏸';
    playBell();
    tratakInterval = setInterval(() => {
      tratakRemaining--;
      document.getElementById('tratakTimer').textContent = formatTime(tratakRemaining);
      if (tratakRemaining <= 0) {
        clearInterval(tratakInterval); tratakRunning = false;
        document.getElementById('tratakPlayBtn').textContent = '▶';
        playBell(); showToast('Tratak complete! 🕯️');
      }
    }, 1000);
  }
}

function resetTratak() {
  clearInterval(tratakInterval); tratakRunning = false;
  tratakRemaining = tratakTotalTime;
  document.getElementById('tratakTimer').textContent = formatTime(tratakTotalTime);
  document.getElementById('tratakPlayBtn').textContent = '▶';
}

// ==========================================
// 🌬️ BREATHING
// ==========================================

function setBreathType(btn, type) {
  document.querySelectorAll('.breath-type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  breathType = type; resetBreathing();
}

function setBreathDuration(btn, sec) {
  document.querySelectorAll('#modal-breathing .timer-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  breathDuration = sec; resetBreathing();
}

function toggleBreathing() {
  if (breathRunning) stopBreathing(); else startBreathing();
}

function startBreathing() {
  breathRunning = true;
  document.getElementById('breathPlayBtn').textContent = '⏸';
  playBell();
  const circle = document.getElementById('breathCircle');
  const text = document.getElementById('breathText');
  let phases = breathType === 'box'
    ? [{name:'Inhale',duration:4,class:'inhale'},{name:'Hold',duration:4,class:'hold'},{name:'Exhale',duration:4,class:'exhale'},{name:'Hold',duration:4,class:'hold'}]
    : [{name:'Inhale',duration:4,class:'inhale'},{name:'Hold',duration:7,class:'hold'},{name:'Exhale',duration:8,class:'exhale'}];
  let phaseIdx = 0;

  function runPhase() {
    if (!breathRunning) return;
    const phase = phases[phaseIdx % phases.length];
    circle.className = 'breath-circle ' + phase.class;
    circle.style.transition = `transform ${phase.duration}s ease-in-out`;
    text.textContent = phase.name;
    let pt = phase.duration;
    const pc = setInterval(() => {
      if (!breathRunning) { clearInterval(pc); return; }
      pt--;
      if (pt <= 0) { clearInterval(pc); phaseIdx++; playSoftTick(); runPhase(); }
    }, 1000);
    breathPhaseInterval = pc;
  }
  runPhase();

  breathInterval = setInterval(() => {
    breathRemaining--;
    document.getElementById('breathTimer').textContent = formatTime(breathRemaining);
    if (breathRemaining <= 0) {
      stopBreathing(); playBell(); showToast('Breathing complete! 🌬️');
    }
  }, 1000);
}

function stopBreathing() {
  breathRunning = false;
  clearInterval(breathInterval); clearInterval(breathPhaseInterval);
  document.getElementById('breathPlayBtn').textContent = '▶';
  const c = document.getElementById('breathCircle');
  c.className = 'breath-circle'; c.style.transition = 'transform 0.5s ease';
  document.getElementById('breathText').textContent = 'Paused';
}

function resetBreathing() {
  stopBreathing(); breathRemaining = breathDuration;
  document.getElementById('breathTimer').textContent = formatTime(breathDuration);
  document.getElementById('breathText').textContent = 'Ready';
}

// ==========================================
// ⏱️ SILENT TIMER
// ==========================================

function setSilentTime(btn, sec) {
  document.querySelectorAll('#modal-timer .timer-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  silentTotalTime = sec; resetSilentTimer();
}

function toggleSilentTimer() {
  if (silentRunning) {
    clearInterval(silentInterval); silentRunning = false;
    document.getElementById('silentPlayBtn').textContent = '▶';
    document.getElementById('silentTimerLabel').textContent = 'PAUSED';
  } else {
    silentRunning = true;
    document.getElementById('silentPlayBtn').textContent = '⏸';
    document.getElementById('silentTimerLabel').textContent = 'MEDITATING';
    playBell();
    silentInterval = setInterval(() => {
      silentRemaining--;
      document.getElementById('silentTimerDisplay').textContent = formatTime(silentRemaining);
      const circ = 2 * Math.PI * 100;
      document.getElementById('timerProgress').style.strokeDashoffset = -((silentTotalTime - silentRemaining) / silentTotalTime) * circ;
      if (silentRemaining <= 0) {
        clearInterval(silentInterval); silentRunning = false;
        document.getElementById('silentPlayBtn').textContent = '▶';
        document.getElementById('silentTimerLabel').textContent = 'COMPLETE';
        playBell(); setTimeout(playBell, 1500);
        showToast('Meditation complete! 🧘');
      }
    }, 1000);
  }
}

function resetSilentTimer() {
  clearInterval(silentInterval); silentRunning = false;
  silentRemaining = silentTotalTime;
  document.getElementById('silentTimerDisplay').textContent = formatTime(silentTotalTime);
  document.getElementById('silentPlayBtn').textContent = '▶';
  document.getElementById('silentTimerLabel').textContent = 'READY';
  document.getElementById('timerProgress').style.strokeDashoffset = 0;
}

// ==========================================
// 🌿 GROUNDING
// ==========================================

function completeGrounding(el) {
  el.classList.toggle('completed'); playSoftTick();
  const all = document.querySelectorAll('.grounding-step');
  const done = document.querySelectorAll('.grounding-step.completed');
  if (done.length === all.length) {
    document.getElementById('groundingComplete').style.display = 'block';
    playBell(); showToast('You\'re grounded! 🌿');
  }
}

// ==========================================
// 🚀 INIT
// ==========================================

updateGreeting();
renderHistory();
fetchQuotes(); // <-- Dynamic fetch on load!
