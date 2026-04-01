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
    'auth/unauthorized-domain':    'Dominio non autorizzato. Aggiungi grandepinnatk.github.io in Firebase Console → Authentication → Settings → Authorized domains',
    'auth/operation-not-allowed':  'Metodo di login non abilitato. Abilita Google in Firebase Console → Authentication → Sign-in method',
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
  // Popup di conferma logout con opzione salvataggio
  const ov = document.createElement('div');
  ov.id = 'logout-confirm-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9000;backdrop-filter:blur(6px)';

  function _removePopup() { const el = document.getElementById('logout-confirm-popup'); if (el) el.remove(); }

  function _doLogout() {
    _removePopup();
    signOut(auth).catch(e => console.warn('[Auth] Logout error:', e));
  }

  function _askSave() {
    ov.innerHTML = '';
    ov.appendChild(_popupHTML(
      '💾', 'Salva progresso',
      'Vuoi salvare il tuo progresso nel gioco?',
      'Sì, salva', function() {
        _removePopup();
        if (typeof autoSaveToCurrentSlot === 'function' && window.G && window.G.myId) {
          autoSaveToCurrentSlot(window.G);
        }
        setTimeout(_doLogout, 600);
      },
      'No, esci senza salvare', _doLogout
    ));
  }

  function _popupHTML(icon, title, msg, yesLabel, yesAction, noLabel, noAction) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'background:linear-gradient(180deg,#0d1f3c,#091525)',
      'border:2px solid #2a5aaa',
      'border-radius:16px',
      'padding:28px 24px',
      'max-width:340px',
      'width:90%',
      'text-align:center',
      'box-shadow:0 8px 40px rgba(0,0,0,.7)',
    ].join(';');
    wrap.innerHTML =
      '<div style="font-size:36px;margin-bottom:12px">' + icon + '</div>' +
      '<div style="font-size:16px;font-weight:800;color:#00c2ff;margin-bottom:8px">' + title + '</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,.75);line-height:1.6;margin-bottom:22px">' + msg + '</div>' +
      '<div style="display:flex;gap:10px;justify-content:center"></div>';
    const btnRow = wrap.querySelector('div:last-child');

    const yBtn = document.createElement('button');
    yBtn.textContent = yesLabel;
    yBtn.style.cssText = [
      'padding:10px 26px',
      'font-size:13px',
      'font-weight:800',
      'border-radius:8px',
      'border:2px solid #00c2ff',
      'background:linear-gradient(135deg,#0a5ca8,#0844a0)',
      'color:#fff',
      'cursor:pointer',
      'clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)',
    ].join(';');
    yBtn.onclick = yesAction;

    const nBtn = document.createElement('button');
    nBtn.textContent = noLabel;
    nBtn.style.cssText = [
      'padding:10px 26px',
      'font-size:13px',
      'font-weight:800',
      'border-radius:8px',
      'border:2px solid #4a1428',
      'background:linear-gradient(135deg,#3d1020,#280a14)',
      'color:#e07090',
      'cursor:pointer',
      'clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)',
    ].join(';');
    nBtn.onclick = noAction;

    btnRow.appendChild(yBtn);
    btnRow.appendChild(nBtn);
    return wrap;
  }

  // Step 1: Vuoi fare logout?
  ov.appendChild(_popupHTML(
    '🔓', 'Logout',
    'Vuoi veramente fare logout?',
    'Sì', _askSave,
    'No', _removePopup
  ));
  document.body.appendChild(ov);
}

export async function wpLoginGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  _setLoading(true); _setErr('');
  try {
    // Popup è più affidabile su GitHub Pages (nessun problema di redirect loop)
    await signInWithPopup(auth, provider);
    // onAuthStateChanged gestisce il resto
  } catch (e) {
    if (e.code === 'auth/popup-blocked') {
      // Popup bloccato dal browser: fallback redirect
      try {
        await signInWithRedirect(auth, provider);
      } catch (e2) {
        _setErr(_errMsg(e2.code));
        _setLoading(false);
      }
    } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      // Utente ha chiuso il popup: nessun errore
      _setLoading(false);
    } else {
      _setErr(_errMsg(e.code));
      _setLoading(false);
    }
  }
}

// ── Aggiorna la UI con le info utente ──
function _updateAuthHeader(user) {
  // Elementi nuova UI (BS layout)
  const logoutSidebar = document.getElementById('wp-btn-logout');
  const bsUserBox     = document.getElementById('bs-user-box');
  const bsUserLbl     = document.getElementById('bs-username-lbl');
  const wlLogout      = document.getElementById('wp-welcome-logout');
  const wlUser        = document.getElementById('wp-welcome-user');
  // Elementi vecchia UI (retrocompatibilità, potrebbero non esistere)
  const loggedEl  = document.getElementById('wp-user-info');
  const cloudIcon = document.getElementById('wp-cloud-icon');

  if (user) {
    const name = user.displayName || user.email.split('@')[0];

    // Topbar BS — box utente
    if (bsUserBox) bsUserBox.style.display = '';
    if (bsUserLbl) bsUserLbl.textContent = name;

    // Sidebar — pulsante logout
    if (logoutSidebar) logoutSidebar.style.display = '';

    // Welcome screen — logout
    if (wlLogout) wlLogout.style.display = 'flex';
    if (wlUser)   wlUser.textContent = '👤 ' + name;

    // Retrocompatibilità
    if (loggedEl)  { loggedEl.textContent = '👤 ' + name; loggedEl.style.display = ''; }
    if (cloudIcon) { cloudIcon.style.display = ''; cloudIcon.title = '☁️ Cloud sync'; }
  } else {
    if (bsUserBox)     bsUserBox.style.display     = 'none';
    if (logoutSidebar) logoutSidebar.style.display = 'none';
    if (wlLogout)      wlLogout.style.display      = 'none';
    if (loggedEl)      loggedEl.style.display      = 'none';
    if (cloudIcon)     cloudIcon.style.display     = 'none';
  }
}

// ── Gestione redirect OAuth residui (fallback per popup bloccati) ──
getRedirectResult(auth).then(result => {
  // Risultato già gestito da onAuthStateChanged
  if (result?.user) console.log('[Auth] Redirect result handled for:', result.user.email);
}).catch(e => {
  if (e.code && e.code !== 'auth/no-current-user') {
    console.warn('[Auth] Redirect error:', e.code);
  }
});

// ── Auth state observer ───────────────────────
onAuthStateChanged(auth, async (user) => {
  _currentUser = user;
  _setLoading(false);

  console.log('[Auth] onAuthStateChanged — user:', user ? user.email : 'null');

  if (user) {
    _setErr('');
    _updateAuthHeader(user);

    // Nascondi pannello auth
    const authPanel = document.getElementById('wp-auth-panel');
    if (authPanel) authPanel.style.display = 'none';
    console.log('[Auth] Pannello auth nascosto');

    // Sync cloud — attendi il completamento prima di aggiornare la UI
    _showSyncIndicator(true);
    try {
      await syncOnLogin();
      console.log('[Auth] Sync completato — aggiorno UI con dati freschi');
    } catch (e) {
      console.warn('[Auth] Sync error (non bloccante):', e);
    }
    _showSyncIndicator(false);

    // Assicura che il pannello auth sia nascosto anche dopo il sync
    const authPanelAfterSync = document.getElementById('wp-auth-panel');
    if (authPanelAfterSync) authPanelAfterSync.style.display = 'none';

    // Aggiorna UI — DOPO il sync così i panel slot mostrano i dati del cloud
    _updateGameUI();

  } else {
    _updateAuthHeader(null);
    const authPanel = document.getElementById('wp-auth-panel');
    if (authPanel) authPanel.style.display = '';
    wpSwitchToLogin();
    console.log('[Auth] Utente non loggato — pannello auth mostrato');
  }
});

// Aggiorna la UI del gioco con retry (le funzioni vanilla potrebbero
// non essere ancora disponibili al primo tick del module)
function _updateGameUI() {
  const tryUpdate = (attempt) => {
    // Nomi reali delle funzioni in welcome.js
    const hasSlotsPanel   = typeof window._buildSlotsPanel === 'function';
    const hasTeamList     = typeof window._buildTeamList   === 'function';
    const hasBuildWelcome = typeof window.buildWelcomeScreen === 'function';
    console.log(`[Auth] _updateGameUI attempt ${attempt} — slotsPanel:${hasSlotsPanel} teamList:${hasTeamList} welcome:${hasBuildWelcome}`);
    if (hasSlotsPanel || hasBuildWelcome) {
      try {
        if (hasBuildWelcome) window.buildWelcomeScreen();
        else {
          if (hasSlotsPanel) window._buildSlotsPanel();
          if (hasTeamList)   window._buildTeamList();
        }
        console.log('[Auth] UI welcome aggiornata');
      } catch(e) {
        console.warn('[Auth] UI update error:', e);
      }
    } else if (attempt < 20) {
      setTimeout(() => tryUpdate(attempt + 1), 150);
    } else {
      console.warn('[Auth] Funzioni welcome non disponibili dopo 3s');
    }
  };
  tryUpdate(1);
}

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
