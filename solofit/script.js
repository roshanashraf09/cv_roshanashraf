/* ============================================================
   SoloFit — auth form validation
   Client-side only. Hook these up to your Go API endpoints.
   ============================================================ */

(function () {
  'use strict';

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function setError(fieldId, msg) {
    const field = $(fieldId).closest('.field');
    field.classList.add('error');
    $(fieldId + '-msg').textContent = msg;
  }

  function clearError(fieldId) {
    const field = $(fieldId).closest('.field');
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

  // ---------- password strength ----------
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
      if (pwInput.value.length > 0) {
        strengthEl.classList.add('s' + Math.max(score, 1));
      }
    });
  }

  // Clear errors on input
  document.querySelectorAll('.field input').forEach((input) => {
    input.addEventListener('input', () => clearError(input.id));
  });

  // ---------- LOGIN ----------
  const loginForm = $('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;

      const username = $('username').value.trim();
      const password = $('password').value;

      if (username.length < 3) {
        setError('username', 'Username must be at least 3 characters');
        ok = false;
      }
      if (password.length < 1) {
        setError('password', 'Enter your password');
        ok = false;
      }
      if (!ok) return;

      const btn = loginForm.querySelector('button[type="submit"]');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Authenticating...';

      try {
        // TODO: replace with your real Go endpoint
        // const res = await fetch('/api/auth/login', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ username, password, remember: $('remember').checked })
        // });
        // if (!res.ok) throw new Error('Invalid credentials');
        // const data = await res.json();
        // localStorage.setItem('token', data.token);
        // window.location.href = '/dashboard';

        await new Promise((r) => setTimeout(r, 800)); // simulated
        showToast('Welcome back, ' + username + '.');
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = original;
        }, 800);
      } catch (err) {
        setError('password', 'Invalid username or password');
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }

  // ---------- SIGNUP ----------
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
        setError('username', '3–24 chars. Letters, numbers, underscore only.');
        ok = false;
      }
      if (password.length < 8) {
        setError('password', 'Minimum 8 characters');
        ok = false;
      } else if (passwordScore(password) < 2) {
        setError('password', 'Add upper, lower, number or symbol');
        ok = false;
      }
      if (confirm !== password) {
        setError('confirm', 'Passwords do not match');
        ok = false;
      }
      if (!terms) {
        // No dedicated error slot — flash the checkbox row
        const row = document.querySelector('.auth-row');
        row.animate(
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
        // TODO: replace with your real Go endpoint
        // const res = await fetch('/api/auth/signup', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ username, password })
        // });
        // if (!res.ok) {
        //   const err = await res.json();
        //   throw new Error(err.message || 'Signup failed');
        // }

        await new Promise((r) => setTimeout(r, 1000)); // simulated
        showToast('Awakening complete. Welcome, ' + username + '.');
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = original;
          // window.location.href = '/dashboard';
        }, 1200);
      } catch (err) {
        setError('username', err.message || 'Awakening failed. Try again.');
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }

  // ---------- forgot password (stub) ----------
  const forgot = $('forgot');
  if (forgot) {
    forgot.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Recovery link will be sent to your registered hunter ID.');
    });
  }
})();
