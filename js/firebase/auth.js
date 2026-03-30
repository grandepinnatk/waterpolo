// ─────────────────────────────────────────────
// js/firebase/auth.js
// Autenticazione Firebase per Waterpolo
// Adattato dal pattern di Scacchi dei Pinci
//
// Gestisce:
//  - Login / registrazione email+password
//  - onAuthStateChanged → sync cloud → avvio gioco
//  - UI schermata login integrata nel welcome
//  - Logout con pulizia stato
// ─────────────────────────────────────────────

import { auth } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { syncOnLogin } from './cloud-save.js';

// ── Stato corrente ────────────────────────────
let _currentUser = null;
export function getCurrentUser() { return _currentUser; }

// ── Messaggi di errore leggibili ─────────────
function _errMsg(code) {
  const map = {
    'auth/email-already-in-use':  'Email già registrata',
    'auth/invalid-email':          'Email non valida',
    'auth/weak-password':          'Password troppo corta (minimo 6 caratteri)',
    'auth/wrong-password':         'Password errata',
    'auth/user-not-found':         'Nessun account con questa email',
    'auth/invalid-credential':     'Email o password errati',
    'auth/too-many-requests':      'Troppi tentativi. Riprova tra qualche minuto',
    'auth/network-request-failed': 'Errore di rete. Controlla la connessione',
  };
  return map[code] || 'Errore: ' + code;
}

function _setErr(msg) {
  const el = document.getElementById('wp-auth-err');
  if (el) { el.textContent = msg; el.style.display = msg ? '' : 'none'; }
}

function _setLoading(loading) {
  ['wp-btn-login', 'wp-btn-register', 'wp-btn-reset'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = loading;
  });
  const spinner = document.getElementById('wp-auth-spinner');
  if (spinner) spinner.style.display = loading ? '' : 'none';
}

// ── Funzioni esposte all'HTML ─────────────────
export function wpSwitchToLogin() {
  document.getElementById('wp-auth-login-form').style.display  = '';
  document.getElementById('wp-auth-reg-form').style.display    = 'none';
  document.getElementById('wp-auth-reset-form').style.display  = 'none';
  document.getElementById('wp-auth-title').textContent = 'Accedi';
  _setErr('');
}

export function wpSwitchToRegister() {
  document.getElementById('wp-auth-login-form').style.display  = 'none';
  document.getElementById('wp-auth-reg-form').style.display    = '';
  document.getElementById('wp-auth-reset-form').style.display  = 'none';
  document.getElementById('wp-auth-title').textContent = 'Crea account';
  _setErr('');
}

export function wpSwitchToReset() {
  document.getElementById('wp-auth-login-form').style.display  = 'none';
  document.getElementById('wp-auth-reg-form').style.display    = 'none';
  document.getElementById('wp-auth-reset-form').style.display  = '';
  document.getElementById('wp-auth-title').textContent = 'Recupera password';
  _setErr('');
}

export async function wpLogin() {
  const email = document.getElementById('wp-email').value.trim();
  const pw    = document.getElementById('wp-password').value;
  if (!email || !pw) { _setErr('Compila email e password'); return; }
  _setLoading(true); _setErr('');
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    // onAuthStateChanged gestisce il resto
  } catch (e) {
    _setErr(_errMsg(e.code));
    _setLoading(false);
  }
}

export async function wpRegister() {
  const name  = document.getElementById('wp-reg-name').value.trim();
  const email = document.getElementById('wp-reg-email').value.trim();
  const pw    = document.getElementById('wp-reg-password').value;
  const pw2   = document.getElementById('wp-reg-password2').value;
  if (!name || !email || !pw) { _setErr('Compila tutti i campi'); return; }
  if (name.length < 2)         { _setErr('Nome troppo corto'); return; }
  if (pw !== pw2)              { _setErr('Le password non coincidono'); return; }
  _setLoading(true); _setErr('');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, { displayName: name });
    // onAuthStateChanged gestisce il resto
  } catch (e) {
    _setErr(_errMsg(e.code));
    _setLoading(false);
  }
}

export async function wpResetPassword() {
  const email = document.getElementById('wp-reset-email').value.trim();
  if (!email) { _setErr('Inserisci la tua email'); return; }
  _setLoading(true); _setErr('');
  try {
    await sendPasswordResetEmail(auth, email);
    _setErr('');
    const el = document.getElementById('wp-reset-ok');
    if (el) el.style.display = '';
    setTimeout(() => wpSwitchToLogin(), 3000);
  } catch (e) {
    _setErr(_errMsg(e.code));
  } finally {
    _setLoading(false);
  }
}

export async function wpLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('[Auth] Logout error:', e);
  }
}

export async function wpLoginGoogle() {
  const provider = new GoogleAuthProvider();
  _setLoading(true); _setErr('');
  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged gestisce il resto
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
      // Fallback redirect se popup bloccato
      await signInWithRedirect(auth, provider);
    } else if (e.code !== 'auth/cancelled-popup-request') {
      _setErr(_errMsg(e.code));
      _setLoading(false);
    } else {
      _setLoading(false);
    }
  }
}

// ── Aggiorna la UI dell'header con le info utente ──
function _updateAuthHeader(user) {
  const loggedEl   = document.getElementById('wp-user-info');
  const logoutBtn  = document.getElementById('wp-btn-logout');
  const cloudIcon  = document.getElementById('wp-cloud-icon');

  if (!loggedEl) return;

  if (user) {
    const name = user.displayName || user.email.split('@')[0];
    loggedEl.textContent  = '👤 ' + name;
    loggedEl.style.display = '';
    if (logoutBtn)  logoutBtn.style.display  = '';
    if (cloudIcon)  cloudIcon.style.display  = '';
    cloudIcon.title = 'Salvataggi sincronizzati con il cloud ☁️';
  } else {
    loggedEl.style.display  = 'none';
    if (logoutBtn)  logoutBtn.style.display  = 'none';
    if (cloudIcon)  cloudIcon.style.display  = 'none';
  }
}

// ── Gestione redirect OAuth (es. Google su mobile) ──
getRedirectResult(auth).catch(e => {
  if (e.code && e.code !== 'auth/no-current-user') _setErr(_errMsg(e.code));
});

// ── Auth state observer ───────────────────────
onAuthStateChanged(auth, async (user) => {
  _currentUser = user;
  _setLoading(false);

  if (user) {
    // Utente loggato: sync cloud → localStorage, poi mostra il gioco
    _setErr('');
    _updateAuthHeader(user);

    // Nascondi il pannello auth e mostra il welcome
    const authPanel = document.getElementById('wp-auth-panel');
    if (authPanel) authPanel.style.display = 'none';

    // Mostra indicatore di sync
    _showSyncIndicator(true);
    try {
      await syncOnLogin();
    } catch (e) {
      console.warn('[Auth] Sync error:', e);
    }
    _showSyncIndicator(false);

    // Aggiorna la UI degli slot (ora può avere dati dal cloud)
    if (typeof renderSlots === 'function') renderSlots();
    if (typeof renderTeamList === 'function') renderTeamList();

  } else {
    // Utente non loggato: mostra pannello auth sopra al welcome
    _updateAuthHeader(null);
    const authPanel = document.getElementById('wp-auth-panel');
    if (authPanel) authPanel.style.display = '';
    wpSwitchToLogin();
  }
});

function _showSyncIndicator(show) {
  const el = document.getElementById('wp-sync-indicator');
  if (el) el.style.display = show ? '' : 'none';
}

// ── Esponi tutto su window per compatibilità ──
window.wpLogin          = wpLogin;
window.wpRegister       = wpRegister;
window.wpLogout         = wpLogout;
window.wpResetPassword  = wpResetPassword;
window.wpSwitchToLogin    = wpSwitchToLogin;
window.wpSwitchToRegister = wpSwitchToRegister;
window.wpSwitchToReset    = wpSwitchToReset;
window.wpGetCurrentUser   = getCurrentUser;
window.wpLoginGoogle      = wpLoginGoogle;

// Enter su password → login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wp-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') wpLogin();
  });
  document.getElementById('wp-reg-password2')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') wpRegister();
  });
  document.getElementById('wp-reset-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') wpResetPassword();
  });
});

console.log('[Auth] Modulo caricato');
