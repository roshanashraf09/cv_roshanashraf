/* ============================================================
   SoloFit — front-end JS
   • Auth: validation + redirect to home.html
   • Dashboard: workouts, macros, stats, AI coach, chart
   • Storage: localStorage today; swap to your Go API later
   ============================================================ */

(function () {
  'use strict';

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'solofit_v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function defaultState(username) {
    return {
      user: {
        username: username || 'Hunter',
        joined: todayISO(),
        rank: 'E',
        rankLabel: 'Awakened',
        level: 1,
        xp: 0,
        xpNext: 100,
        totalXp: 0,
        streak: 0,
        workoutsCompleted: 0,
        totalSets: 0,
        // Profile fields (filled on profile page)
        age: null,
        gender: '',
        height: null,
        weight: null,
        goalWeight: null,
        activity: 'moderate',
        goal: '',
        profileComplete: false
      },
      stats: { STR: 10, END: 10, AGI: 10, VIT: 10, INT: 10, PER: 10 },
      targets: { kcal: 2200, protein: 180, carbs: 220, fats: 70 },
      today: { date: todayISO(), workout: {}, meals: [], dayOverride: null },
      achievements: [],
      week: [
        { d: 'Mon', kg: null, kcal: 0 },
        { d: 'Tue', kg: null, kcal: 0 },
        { d: 'Wed', kg: null, kcal: 0 },
        { d: 'Thu', kg: null, kcal: 0 },
        { d: 'Fri', kg: null, kcal: 0 },
        { d: 'Sat', kg: null, kcal: 0 },
        { d: 'Sun', kg: null, kcal: 0 }
      ]
    };
  }

  // ============================================================
  // RANK SYSTEM
  // ============================================================
  const RANKS = [
    { letter: 'E', label: 'Awakened',  min: 0 },
    { letter: 'D', label: 'Apprentice', min: 500 },
    { letter: 'C', label: 'Adept',      min: 1500 },
    { letter: 'B', label: 'Veteran',    min: 3500 },
    { letter: 'A', label: 'Elite',      min: 7000 },
    { letter: 'S', label: 'Monarch',    min: 14000 }
  ];

  function rankFor(totalXp) {
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (totalXp >= RANKS[i].min) return { ...RANKS[i], idx: i, next: RANKS[i + 1] || null };
    }
    return { ...RANKS[0], idx: 0, next: RANKS[1] };
  }

  // ============================================================
  // ACHIEVEMENTS
  // ============================================================
  const ACHIEVEMENTS = [
    { id: 'awaken',       icon: '⟁', name: 'First Awakening',   desc: 'Begin your hunter journey',     check: s => true },
    { id: 'first_set',    icon: '◆', name: 'First Set',          desc: 'Log your first set',           check: s => s.user.totalSets >= 1 },
    { id: 'first_workout',icon: '⚔', name: 'Daily Conqueror',    desc: 'Complete a full workout',      check: s => s.user.workoutsCompleted >= 1 },
    { id: 'streak_3',     icon: '⚡', name: 'Triple Threat',      desc: 'Reach a 3-day streak',         check: s => s.user.streak >= 3 },
    { id: 'streak_7',     icon: '✦', name: 'Week Warrior',       desc: 'Reach a 7-day streak',         check: s => s.user.streak >= 7 },
    { id: 'rank_d',       icon: 'D', name: 'Rise to D-Rank',     desc: 'Earn 500 total XP',            check: s => s.user.totalXp >= 500 },
    { id: 'rank_c',       icon: 'C', name: 'Rise to C-Rank',     desc: 'Earn 1,500 total XP',          check: s => s.user.totalXp >= 1500 },
    { id: 'macro_master', icon: '▣', name: 'Macro Master',       desc: 'Hit all 3 macro targets in a day', check: s => {
      const t = (s._totals || { p: 0, c: 0, f: 0 });
      return t.p >= s.targets.protein && t.c >= s.targets.carbs && t.f >= s.targets.fats;
    }},
    { id: 'meals_10',     icon: '✱', name: 'Nutrition Tracker',  desc: 'Log 10 meals total',           check: s => (s.user.mealsLogged || 0) >= 10 },
    { id: 'workouts_10',  icon: '◢', name: 'Iron Will',          desc: 'Complete 10 workouts',         check: s => s.user.workoutsCompleted >= 10 }
  ];

  function checkAchievements(s) {
    const newly = [];
    s.achievements = s.achievements || [];
    ACHIEVEMENTS.forEach(a => {
      if (!s.achievements.includes(a.id) && a.check(s)) {
        s.achievements.push(a.id);
        newly.push(a);
      }
    });
    return newly;
  }

  function setError(fieldId, msg) {
    const field = $(fieldId)?.closest('.field');
    if (!field) return;
    field.classList.add('error');
    $(fieldId + '-msg').textContent = msg;
  }

  function clearError(fieldId) {
    const field = $(fieldId)?.closest('.field');
    if (!field) return;
    field.classList.remove('error');
    $(fieldId + '-msg').textContent = '';
  }

  function showToast(text) {
    const toast = $('toast');
    if (!toast) return;
    if (text) $('toast-text').textContent = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  // ============================================================
  // AUTH PAGES (login.html, signup.html)
  // ============================================================

  function passwordScore(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  }

  const strengthEl = $('strength');
  const pwInput = $('password');
  if (strengthEl && pwInput) {
    pwInput.addEventListener('input', () => {
      const score = passwordScore(pwInput.value);
      strengthEl.classList.remove('s1', 's2', 's3', 's4');
      if (pwInput.value.length > 0) strengthEl.classList.add('s' + Math.max(score, 1));
    });
  }

  document.querySelectorAll('.field input').forEach((input) => {
    input.addEventListener('input', () => clearError(input.id));
  });

  // LOGIN
  const loginForm = $('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      const username = $('username').value.trim();
      const password = $('password').value;

      if (username.length < 3) { setError('username', 'Username must be at least 3 characters'); ok = false; }
      if (password.length < 1) { setError('password', 'Enter your password'); ok = false; }
      if (!ok) return;

      const btn = loginForm.querySelector('button[type="submit"]');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Authenticating...';

      try {
        // TODO: wire to Go backend
        // const res = await fetch('/api/auth/login', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ username, password, remember: $('remember').checked })
        // });
        // if (!res.ok) throw new Error('Invalid credentials');
        // const data = await res.json();
        // localStorage.setItem('solofit_token', data.token);

        await new Promise((r) => setTimeout(r, 700));

        // Seed local state if first run
        if (!loadState()) saveState(defaultState(username));
        else {
          const s = loadState(); s.user.username = username; saveState(s);
        }

        showToast('Welcome back, ' + username + '.');
        setTimeout(() => { window.location.href = 'home.html'; }, 900);
      } catch (err) {
        setError('password', 'Invalid username or password');
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }

  // SIGNUP
  const signupForm = $('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      const username = $('username').value.trim();
      const password = $('password').value;
      const confirm = $('confirm').value;
      const terms = $('terms').checked;

      if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
        setError('username', '3–24 chars. Letters, numbers, underscore only.'); ok = false;
      }
      if (password.length < 8) { setError('password', 'Minimum 8 characters'); ok = false; }
      else if (passwordScore(password) < 2) { setError('password', 'Add upper, lower, number or symbol'); ok = false; }
      if (confirm !== password) { setError('confirm', 'Passwords do not match'); ok = false; }
      if (!terms) {
        const row = document.querySelector('.auth-row');
        row?.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
          { duration: 280 }
        );
        ok = false;
      }
      if (!ok) return;

      const btn = signupForm.querySelector('button[type="submit"]');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Initializing...';

      try {
        // TODO: wire to Go backend
        // const res = await fetch('/api/auth/signup', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ username, password })
        // });
        // if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Signup failed'); }

        await new Promise((r) => setTimeout(r, 900));

        // Initialize a fresh hunter
        saveState(defaultState(username));

        showToast('Awakening complete. Welcome, ' + username + '.');
        setTimeout(() => { window.location.href = 'home.html'; }, 1100);
      } catch (err) {
        setError('username', err.message || 'Awakening failed. Try again.');
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }

  const forgot = $('forgot');
  if (forgot) {
    forgot.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Recovery link sent to your registered hunter ID.');
    });
  }

  // ============================================================
  // PROFILE PAGE (profile.html)
  // ============================================================
  if (document.body.classList.contains('profile-page')) {
    let pState = loadState();
    if (!pState) { pState = defaultState('Hunter'); saveState(pState); }

    // Prefill form
    const fields = ['username', 'age', 'gender', 'height', 'weight', 'goalWeight', 'activity', 'goal'];
    fields.forEach(k => { if ($(k) && pState.user[k] != null) $(k).value = pState.user[k]; });
    if ($('kcalTargetIn')) $('kcalTargetIn').value = pState.targets.kcal;
    if ($('proteinTargetIn')) $('proteinTargetIn').value = pState.targets.protein;

    // Rank ring
    const r = rankFor(pState.user.totalXp || 0);
    $('rankLetter').textContent = r.letter;
    $('rankLabel').textContent = r.label.toUpperCase();
    if (r.next) {
      const span = r.next.min - r.min;
      const into = (pState.user.totalXp || 0) - r.min;
      const pct = Math.min(1, into / span);
      const C = 2 * Math.PI * 52;
      $('rankRingFill').setAttribute('stroke-dasharray', C);
      $('rankRingFill').setAttribute('stroke-dashoffset', C * (1 - pct));
      $('rankNext').innerHTML = '<strong>' + (r.next.min - (pState.user.totalXp || 0)) + '</strong> XP to ' + r.next.letter + '-rank';
    } else {
      $('rankNext').innerHTML = '<strong>Max rank achieved</strong>';
    }

    // Achievements grid
    const ach = pState.achievements || [];
    $('achCount').textContent = ach.length + ' / ' + ACHIEVEMENTS.length;
    const grid = $('achGrid');
    ACHIEVEMENTS.forEach(a => {
      const unlocked = ach.includes(a.id);
      const el = document.createElement('div');
      el.className = 'ach ' + (unlocked ? 'unlocked' : 'locked');
      el.innerHTML = `
        <div class="ach-icon">${unlocked ? a.icon : '?'}</div>
        <div>
          <div class="ach-name">${unlocked ? a.name : '???'}</div>
          <div class="ach-desc">${a.desc}</div>
        </div>
      `;
      grid.appendChild(el);
    });

    // Save handler
    $('profileForm').addEventListener('submit', (e) => {
      e.preventDefault();
      pState.user.username = $('username').value.trim() || pState.user.username;
      pState.user.age = $('age').value ? parseInt($('age').value) : null;
      pState.user.gender = $('gender').value.trim();
      pState.user.height = $('height').value ? parseFloat($('height').value) : null;
      pState.user.weight = $('weight').value ? parseFloat($('weight').value) : null;
      pState.user.goalWeight = $('goalWeight').value ? parseFloat($('goalWeight').value) : null;
      pState.user.activity = $('activity').value.trim() || 'moderate';
      pState.user.goal = $('goal').value.trim();
      pState.targets.kcal = parseInt($('kcalTargetIn').value) || pState.targets.kcal;
      pState.targets.protein = parseInt($('proteinTargetIn').value) || pState.targets.protein;
      pState.user.profileComplete = true;

      // Seed current weight into this week if set
      if (pState.user.weight) {
        const todayIdx = (new Date().getDay() + 6) % 7;
        pState.week[todayIdx].kg = pState.user.weight;
      }

      saveState(pState);
      showToast('Profile saved · stats calibrated');
    });

    return; // stop here — dashboard logic below shouldn't run on profile page
  }

  // ============================================================
  // DASHBOARD (home.html)
  // ============================================================

  if (!document.body.classList.contains('dash-page')) return;

  // Bootstrap state — if user lands here without account, give them a demo profile
  let state = loadState();
  if (!state) { state = defaultState('Hunter'); saveState(state); }

  // ---------- WORKOUT TEMPLATES ----------
  // Mon Push | Tue Pull | Wed Legs | Thu Push | Fri Pull | Sat Legs | Sun Rest
  const WORKOUTS = {
    Push: {
      name: 'Push Day',
      exercises: [
        { name: 'Barbell Bench Press', target: '4 × 6-8', sets: 4 },
        { name: 'Overhead Press',      target: '3 × 8-10', sets: 3 },
        { name: 'Incline Dumbbell Press', target: '3 × 10', sets: 3 },
        { name: 'Lateral Raises',      target: '3 × 12-15', sets: 3 },
        { name: 'Triceps Pushdown',    target: '3 × 12', sets: 3 },
        { name: 'Cable Crunch',        target: '3 × 15', sets: 3 }
      ]
    },
    Pull: {
      name: 'Pull Day',
      exercises: [
        { name: 'Pull-ups',            target: '4 × AMRAP', sets: 4 },
        { name: 'Barbell Row',         target: '3 × 8', sets: 3 },
        { name: 'Lat Pulldown',        target: '3 × 10-12', sets: 3 },
        { name: 'Face Pulls',          target: '3 × 15', sets: 3 },
        { name: 'Barbell Curl',        target: '3 × 10', sets: 3 },
        { name: 'Hammer Curl',         target: '3 × 12', sets: 3 }
      ]
    },
    Legs: {
      name: 'Leg Day',
      exercises: [
        { name: 'Back Squat',          target: '4 × 6-8', sets: 4 },
        { name: 'Romanian Deadlift',   target: '3 × 8-10', sets: 3 },
        { name: 'Leg Press',           target: '3 × 10-12', sets: 3 },
        { name: 'Leg Curl',            target: '3 × 12', sets: 3 },
        { name: 'Calf Raise',          target: '4 × 15-20', sets: 4 },
        { name: 'Plank',               target: '3 × 60s', sets: 3 }
      ]
    },
    Rest: {
      name: 'Rest Day',
      exercises: [
        { name: 'Mobility Flow',       target: '15 min',  sets: 1 },
        { name: 'Walk',                target: '8000 steps', sets: 1 }
      ]
    }
  };

  const dayMap = ['Rest', 'Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']; // Sun..Sat
  const autoSplit = dayMap[new Date().getDay()];
  let todaysSplit = state.today.dayOverride || autoSplit;
  let todaysWorkout = WORKOUTS[todaysSplit];

  // Reset today's workout/meals if date changed
  if (state.today.date !== todayISO()) {
    state.today = { date: todayISO(), workout: {}, meals: [], dayOverride: state.today.dayOverride || null };
    saveState(state);
  }

  // ---------- XP / RANK / ACHIEVEMENT HELPERS ----------
  function awardXp(amount, reason) {
    state.user.xp = (state.user.xp || 0) + amount;
    state.user.totalXp = (state.user.totalXp || 0) + amount;

    // Level up if XP fills the bar
    while (state.user.xp >= state.user.xpNext) {
      state.user.xp -= state.user.xpNext;
      state.user.level += 1;
      state.user.xpNext = Math.round(state.user.xpNext * 1.15);
      showToast('LVL UP — you are now level ' + state.user.level);
    }

    // Rank up check
    const r = rankFor(state.user.totalXp);
    if (r.letter !== state.user.rank) {
      state.user.rank = r.letter;
      state.user.rankLabel = r.label;
      setTimeout(() => showToast('RANK UP — ascended to ' + r.letter + '-Rank'), 600);
    }

    // Achievement check
    const newAch = checkAchievements(state);
    newAch.forEach((a, i) => {
      setTimeout(() => {
        const t = $('toast');
        if (t) {
          t.classList.add('ach-toast');
          $('toast-text').textContent = a.icon + '  ' + a.name + ' unlocked';
          $('toast').querySelector('.toast-label').textContent = '★ Achievement';
          t.classList.add('show');
          setTimeout(() => {
            t.classList.remove('show');
            t.classList.remove('ach-toast');
            $('toast').querySelector('.toast-label').textContent = '⟁ System';
          }, 3500);
        }
      }, 1200 + i * 500);
    });

    saveState(state);
    updateXpDisplay();
  }

  function updateXpDisplay() {
    if (!$('lvlLabel')) return;
    $('lvlLabel').textContent = 'LVL ' + state.user.level;
    $('xpLabel').innerHTML = state.user.xp + ' <span class="total">/ ' + state.user.xpNext + ' XP</span>';
    $('xpFill').style.width = (state.user.xp / state.user.xpNext * 100) + '%';
    if ($('qsLevel')) $('qsLevel').textContent = state.user.level;
  }

  // Award "First Awakening" achievement on first dashboard visit
  if (!(state.achievements || []).includes('awaken')) {
    setTimeout(() => awardXp(10, 'awakening'), 800);
  }

  // ---------- HEADER ----------
  $('dateLabel').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short'
  }).toUpperCase();

  const greetHour = new Date().getHours();
  const greetWord = greetHour < 12 ? 'GOOD MORNING' : greetHour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  $('greeting').textContent = '⟁ ' + greetWord;
  $('hunterName').textContent = state.user.username;
  $('avatar').textContent = state.user.username.charAt(0).toUpperCase();
  $('rankTag').textContent = 'RANK ' + state.user.rank + ' · ' + state.user.rankLabel.toUpperCase();
  $('streakTag').textContent = '⚡ ' + state.user.streak + ' DAY STREAK';

  // Days until July 26, 2026
  const goalDate = new Date('2026-07-26');
  const daysLeft = Math.max(0, Math.ceil((goalDate - new Date()) / (1000 * 60 * 60 * 24)));
  const weeksLeft = Math.ceil(daysLeft / 7);
  $('weeksLeft').textContent = weeksLeft + ' weeks';

  $('lvlLabel').textContent = 'LVL ' + state.user.level;
  $('xpLabel').innerHTML = state.user.xp + ' <span class="total">/ ' + state.user.xpNext + ' XP</span>';
  $('xpFill').style.width = (state.user.xp / state.user.xpNext * 100) + '%';

  // Quick stats strip
  if ($('qsLevel')) {
    $('qsLevel').textContent = state.user.level;
    $('qsStreak').textContent = state.user.streak;
    const latestKg = state.week.filter(d => d.kg != null).pop();
    if (latestKg) $('qsWeight').textContent = latestKg.kg.toFixed(1);
    const firstKg = state.week.find(d => d.kg != null);
    if (firstKg && latestKg) {
      const delta = (firstKg.kg - latestKg.kg).toFixed(1);
      $('qsDelta').textContent = delta > 0 ? '↘ down ' + delta + 'kg this week' : '↗ up ' + Math.abs(delta) + 'kg';
    }
    $('qsWeeks').textContent = weeksLeft;
  }

  // ---------- WORKOUT RENDER ----------
  function renderWorkout() {
    $('workoutName').textContent = todaysWorkout.name;
    $('splitTag').textContent = todaysSplit.toUpperCase() + ' DAY';
    const totalSets = todaysWorkout.exercises.reduce((a, e) => a + e.sets, 0);
    $('workoutTag').textContent = todaysWorkout.exercises.length + ' EXERCISES · ~' + Math.round(totalSets * 2.5) + ' MIN';
    if ($('wmVolume')) $('wmVolume').textContent = totalSets + ' sets';

    const list = $('exerciseList');
    list.innerHTML = '';

    todaysWorkout.exercises.forEach((ex, idx) => {
      const li = document.createElement('li');
      li.className = 'exercise';
      const done = state.today.workout[idx] || [];
      if (done.length === ex.sets) li.classList.add('done');

      const left = document.createElement('div');
      left.innerHTML = `<div class="ex-name">${ex.name}</div><div class="ex-target">${ex.target}</div>`;

      const right = document.createElement('div');
      right.className = 'set-row';
      for (let i = 0; i < ex.sets; i++) {
        const b = document.createElement('button');
        b.className = 'set-btn' + (done.includes(i) ? ' done' : '');
        b.textContent = i + 1;
        b.addEventListener('click', () => toggleSet(idx, i));
        right.appendChild(b);
      }

      li.append(left, right);
      list.appendChild(li);
    });
  }

  function toggleSet(exIdx, setIdx) {
    const done = state.today.workout[exIdx] || [];
    const i = done.indexOf(setIdx);
    if (i === -1) done.push(setIdx);
    else done.splice(i, 1);
    state.today.workout[exIdx] = done;

    if (i === -1) {
      state.user.totalSets = (state.user.totalSets || 0) + 1;
      // Stat gain — small RNG +1 to a random stat per set
      const keys = Object.keys(state.stats);
      const k = keys[Math.floor(Math.random() * keys.length)];
      state.stats[k] = Math.min(100, state.stats[k] + 1);

      saveState(state);
      awardXp(5, 'set logged');

      // Workout completion check
      const totalSets = todaysWorkout.exercises.reduce((a, e) => a + e.sets, 0);
      const doneSets = Object.values(state.today.workout).reduce((a, s) => a + s.length, 0);
      if (doneSets === totalSets && !state.today.completed) {
        state.today.completed = true;
        state.user.workoutsCompleted = (state.user.workoutsCompleted || 0) + 1;
        state.user.streak = (state.user.streak || 0) + 1;
        saveState(state);
        setTimeout(() => awardXp(50, 'workout complete'), 400);
      }
    } else {
      saveState(state);
    }

    renderWorkout();
    renderStats();
  }

  renderWorkout();

  // ---------- DAY PICKER ----------
  function renderDayPicker() {
    document.querySelectorAll('.day-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.day === todaysSplit);
      btn.classList.toggle('today', btn.dataset.day === autoSplit);
    });
  }

  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newDay = btn.dataset.day;
      todaysSplit = newDay;
      todaysWorkout = WORKOUTS[newDay];
      state.today.dayOverride = (newDay === autoSplit) ? null : newDay;
      state.today.workout = {}; // reset progress when switching
      state.today.completed = false;
      saveState(state);
      renderDayPicker();
      renderWorkout();
      showToast('Switched to ' + todaysWorkout.name);
    });
  });
  renderDayPicker();

  // ---------- STATS RENDER ----------
  function renderStats() {
    const grid = $('statGrid');
    grid.innerHTML = '';
    Object.entries(state.stats).forEach(([k, v]) => {
      const div = document.createElement('div');
      div.className = 'stat-line';
      div.innerHTML = `
        <div class="bar-head"><span class="k">${k}</span><span class="v">${v * 10}<span class="of"> / 1000</span></span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${v}%"></div></div>
      `;
      grid.appendChild(div);
    });
  }
  renderStats();

  // ---------- MACROS / NUTRITION ----------
  // Tiny food DB so meal logging feels real. Values per portion noted.
  const FOOD_DB = [
    { match: /chicken breast/i, base: { kcal: 165, p: 31, c: 0,  f: 3.6 }, per: 100 },
    { match: /salmon/i,         base: { kcal: 208, p: 20, c: 0,  f: 13 },  per: 100 },
    { match: /beef|steak/i,     base: { kcal: 250, p: 26, c: 0,  f: 15 },  per: 100 },
    { match: /lamb/i,           base: { kcal: 294, p: 25, c: 0,  f: 21 },  per: 100 },
    { match: /egg/i,            base: { kcal: 78,  p: 6,  c: 0.6,f: 5 },   per: 1, unit: 'egg' },
    { match: /rice/i,           base: { kcal: 130, p: 2.7,c: 28, f: 0.3 }, per: 100 },
    { match: /oats|oat/i,       base: { kcal: 389, p: 17, c: 66, f: 7 },   per: 100 },
    { match: /banana/i,         base: { kcal: 105, p: 1.3,c: 27, f: 0.4 }, per: 1, unit: 'banana' },
    { match: /apple/i,          base: { kcal: 95,  p: 0.5,c: 25, f: 0.3 }, per: 1, unit: 'apple' },
    { match: /whey|protein shake/i, base: { kcal: 120, p: 24, c: 3, f: 1.5 }, per: 1, unit: 'scoop' },
    { match: /almond/i,         base: { kcal: 579, p: 21, c: 22, f: 50 },  per: 100 },
    { match: /yogurt|yoghurt/i, base: { kcal: 59,  p: 10, c: 3.6,f: 0.4 }, per: 100 },
    { match: /sweet potato/i,   base: { kcal: 86,  p: 1.6,c: 20, f: 0.1 }, per: 100 },
    { match: /pineapple/i,      base: { kcal: 50,  p: 0.5,c: 13, f: 0.1 }, per: 100 }
  ];

  function parseMeal(text) {
    const food = FOOD_DB.find((f) => f.match.test(text));
    if (!food) return null;
    const gMatch = text.match(/(\d+(?:\.\d+)?)\s*g/i);
    const nMatch = text.match(/^(\d+(?:\.\d+)?)\s+/);
    let qty = food.unit ? (nMatch ? parseFloat(nMatch[1]) : 1)
                        : (gMatch ? parseFloat(gMatch[1]) : 100);
    const factor = qty / food.per;
    return {
      text,
      kcal: Math.round(food.base.kcal * factor),
      p: Math.round(food.base.p * factor),
      c: Math.round(food.base.c * factor),
      f: Math.round(food.base.f * factor)
    };
  }

  function totals() {
    return state.today.meals.reduce(
      (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }),
      { kcal: 0, p: 0, c: 0, f: 0 }
    );
  }

  function renderMacros() {
    const t = totals();
    state._totals = t;
    const tg = state.targets;
    $('kcalNow').textContent = t.kcal;
    $('kcalTarget').textContent = tg.kcal;
    $('pNow').textContent = t.p; $('cNow').textContent = t.c; $('fNow').textContent = t.f;
    $('pTarget').textContent = tg.protein;
    $('cTarget').textContent = tg.carbs;
    $('fTarget').textContent = tg.fats;
    $('pBar').style.width = Math.min(100, (t.p / tg.protein) * 100) + '%';
    $('cBar').style.width = Math.min(100, (t.c / tg.carbs) * 100) + '%';
    $('fBar').style.width = Math.min(100, (t.f / tg.fats) * 100) + '%';

    const ring = $('kcalRing');
    if (ring) {
      const C = 2 * Math.PI * 88;
      const pct = Math.min(1, t.kcal / tg.kcal);
      ring.setAttribute('stroke-dasharray', C);
      ring.setAttribute('stroke-dashoffset', C * (1 - pct));
    }

    const todayIdx = (new Date().getDay() + 6) % 7;
    state.week[todayIdx].kcal = t.kcal;
    drawChart();
    renderMealLog();
  }

  function renderMealLog() {
    const list = $('mealList');
    if (!list) return;
    list.innerHTML = '';
    const meals = state.today.meals;
    $('mealCount').textContent = meals.length + (meals.length === 1 ? ' item' : ' items');

    if (meals.length === 0) {
      list.innerHTML = '<div class="meal-empty">No meals logged yet. The system is watching.</div>';
      return;
    }

    meals.forEach((m, idx) => {
      const li = document.createElement('li');
      li.className = 'meal-item';
      li.innerHTML = `
        <div>
          <div class="meal-name">${m.text}</div>
          <div class="meal-macros">
            <span class="kcal">${m.kcal} kcal</span> · ${m.p}P · ${m.c}C · ${m.f}F
          </div>
        </div>
        <button type="button" class="meal-remove" data-idx="${idx}" title="Remove">×</button>
      `;
      list.appendChild(li);
    });

    list.querySelectorAll('.meal-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        state.today.meals.splice(idx, 1);
        saveState(state);
        renderMacros();
      });
    });
  }
  renderMacros();

  $('addMealForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('mealInput').value.trim();
    if (!text) return;
    const meal = parseMeal(text);
    if (!meal) {
      showToast("Food not in my codex yet — try 'chicken', 'rice', 'eggs', salmon, oats, etc.");
      return;
    }
    state.today.meals.push(meal);
    state.user.mealsLogged = (state.user.mealsLogged || 0) + 1;
    saveState(state);
    renderMacros();
    $('mealInput').value = '';
    awardXp(2, 'meal logged');
    showToast('+' + meal.kcal + ' kcal logged · +2 XP');
  });

  // ---------- AI COACH ----------
  function getUserContext() {
    const t = totals();
    return {
      username: state.user.username,
      rank: state.user.rank,
      level: state.user.level,
      streak: state.user.streak,
      today: {
        split: todaysSplit,
        workoutName: todaysWorkout.name,
        setsCompleted: Object.values(state.today.workout).reduce((a, s) => a + s.length, 0),
        kcal: t.kcal,
        kcalTarget: state.targets.kcal,
        protein: t.p,
        proteinTarget: state.targets.protein
      },
      weeksToGoal: weeksLeft,
      stats: state.stats
    };
  }

  async function askCoach(message) {
    /* ============================================================
       This tries your real backend at /api/ai/coach first.
       If it fails (404, network error, etc.), falls back to a
       keyword stub so the UI keeps working.

       Backend contract:
         POST /api/ai/coach
         Body: { message: string, context: object }
         Returns: { reply: string }

       See FIREBASE_AI.md or AI_BACKEND.md in this folder
       for the Cloud Function / Go handler examples.
       ============================================================ */
    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': 'Bearer ' + localStorage.getItem('solofit_token')
        },
        body: JSON.stringify({ message, context: getUserContext() })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) return data.reply;
      }
    } catch (e) {
      // Network error — fall through to stub
    }

    // Fallback stub (keyword-matched)
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
    const ctx = getUserContext();
    const m = message.toLowerCase();

    if (/meal|food|eat|hungry/.test(m)) {
      const proteinLeft = Math.max(0, ctx.today.proteinTarget - ctx.today.protein);
      return `Try 200g grilled chicken + 150g basmati rice + steamed broccoli. ~480 kcal, 50g protein, 45g carbs, 6g fat. Covers a big chunk of your remaining ${proteinLeft}g protein. Halal-friendly.`;
    }
    if (/progress|how am i|doing/.test(m)) {
      return `You're at rank ${ctx.rank}, level ${ctx.level}, on a ${ctx.streak}-day streak. ${ctx.weeksToGoal} weeks to your deadline. Logged ${ctx.today.kcal}/${ctx.today.kcalTarget} kcal today. Keep your deficit under 500 kcal.`;
    }
    if (/workout|exercise|gym|short|quick|time/.test(m)) {
      if (todaysSplit === 'Rest') {
        return `Today is a rest day. 15 min mobility + 30 min walk. Don't sabotage tomorrow.`;
      }
      return `Short on time? Top 3 lifts only: ${todaysWorkout.exercises.slice(0, 3).map(e => e.name).join(', ')}. Same rep targets, no accessory work. 80% of the stimulus in 35 min.`;
    }
    if (/sleep|recover|tired/.test(m)) {
      return `Aim 7.5-8h tonight. Last meal 3h before bed, screens off 30 min before, room cool. Under 6h sleep? Drop one set per exercise tomorrow.`;
    }
    if (/cardio|fat|burn/.test(m)) {
      return `In a cut, LISS beats HIIT for preserving muscle. 30-40 min incline walk 3-4x/week. Don't add cardio unless weight loss stalls 2+ weeks.`;
    }
    if (/water|hydrat/.test(m)) {
      return `Target 3-3.5L water/day on training days. About 10% boost to energy.`;
    }
    if (/^(hi|hello|hey|sup|yo)/.test(m)) {
      return `What's up, ${ctx.username}. You're on ${ctx.today.split} day, ${ctx.today.kcal}/${ctx.today.kcalTarget} kcal banked. What do you need?`;
    }
    return `I'm in stub mode — running without a real model. Wire your backend at /api/ai/coach and I'll give you real answers using your full context (${ctx.username}, rank ${ctx.rank}, ${ctx.streak}-day streak, ${ctx.today.kcal}/${ctx.today.kcalTarget} kcal, ${weeksLeft} weeks to goal).`;
  }

  function addMsg(role, text) {
    const log = $('coachLog');
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    if (role === 'ai') {
      const lbl = document.createElement('span');
      lbl.className = 'msg-label';
      lbl.textContent = 'System';
      div.appendChild(lbl);
      div.appendChild(document.createTextNode(text));
    } else {
      div.textContent = text;
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function addTyping() {
    const log = $('coachLog');
    const div = document.createElement('div');
    div.className = 'msg ai typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  async function sendToCoach(message) {
    if (!message.trim()) return;
    addMsg('user', message);
    const typing = addTyping();
    try {
      const reply = await askCoach(message);
      typing.remove();
      addMsg('ai', reply);
    } catch (err) {
      typing.remove();
      addMsg('ai', "System offline. Couldn't reach the coach. Try again in a moment.");
    }
  }

  $('coachForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('coachInput').value.trim();
    if (!text) return;
    $('coachInput').value = '';
    sendToCoach(text);
  });

  document.querySelectorAll('.suggest-chip').forEach((chip) => {
    chip.addEventListener('click', () => sendToCoach(chip.dataset.prompt));
  });

  // ---------- WEEKLY CHART ----------
  function drawChart() {
    const svg = $('chart');
    svg.innerHTML = '';
    const W = 700, H = 260, pad = { l: 40, r: 40, t: 40, b: 45 };
    const data = state.week;

    const xs = data.map((_, i) => pad.l + (i * (W - pad.l - pad.r) / (data.length - 1)));
    const kgVals = data.map((d) => d.kg).filter((v) => v != null);
    const kgMin = Math.min(...kgVals) - 0.5;
    const kgMax = Math.max(...kgVals) + 0.5;
    const kY = (v) => pad.t + ((kgMax - v) / (kgMax - kgMin)) * (H - pad.t - pad.b);

    const kcalMax = 3000;

    // grid
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + i * (H - pad.t - pad.b) / 4;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pad.l); line.setAttribute('x2', W - pad.r);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(105, 162, 255, 0.08)');
      line.setAttribute('stroke-dasharray', '2 4');
      svg.appendChild(line);
    }

    // day labels
    data.forEach((d, i) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.textContent = d.d;
      t.setAttribute('x', xs[i]); t.setAttribute('y', H - 12);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', 'rgba(138, 153, 199, 0.65)');
      t.setAttribute('font-family', 'Rajdhani'); t.setAttribute('font-size', '11');
      t.setAttribute('letter-spacing', '2');
      svg.appendChild(t);
    });

    // defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="kcalGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffd277" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#ffd277" stop-opacity="0.05"/>
      </linearGradient>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6fe3ff"/>
        <stop offset="100%" stop-color="#5b9dff"/>
      </linearGradient>`;
    svg.appendChild(defs);

    // kcal bars
    data.forEach((d, i) => {
      if (!d.kcal) return;
      const barH = (H - pad.t - pad.b) * (d.kcal / kcalMax);
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', xs[i] - 14); r.setAttribute('y', H - pad.b - barH);
      r.setAttribute('width', 28); r.setAttribute('height', barH);
      r.setAttribute('fill', 'url(#kcalGrad)'); r.setAttribute('opacity', '0.6');
      svg.appendChild(r);
    });

    // weight line
    const pts = data.map((d, i) => d.kg != null ? `${xs[i]},${kY(d.kg)}` : null).filter(Boolean);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', pts.join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'url(#lineGrad)');
    line.setAttribute('stroke-width', '2.5');
    line.setAttribute('filter', 'drop-shadow(0 0 6px rgba(111, 227, 255, 0.6))');
    svg.appendChild(line);

    // dots + labels
    data.forEach((d, i) => {
      if (d.kg == null) return;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', xs[i]); c.setAttribute('cy', kY(d.kg));
      c.setAttribute('r', 4); c.setAttribute('fill', '#6fe3ff');
      c.setAttribute('filter', 'drop-shadow(0 0 6px #6fe3ff)');
      svg.appendChild(c);

      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.textContent = d.kg.toFixed(1);
      lbl.setAttribute('x', xs[i]); lbl.setAttribute('y', kY(d.kg) - 10);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('fill', '#6fe3ff');
      lbl.setAttribute('font-family', 'Rajdhani'); lbl.setAttribute('font-size', '11');
      lbl.setAttribute('font-weight', '600');
      svg.appendChild(lbl);
    });
  }
  drawChart();

  // ---------- LOGOUT ----------
  $('logoutBtn').addEventListener('click', () => {
    // localStorage.removeItem('solofit_token');
    showToast('Signed out. See you soon, hunter.');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
  });

})();
