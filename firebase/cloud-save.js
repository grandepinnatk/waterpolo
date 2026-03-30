// ─────────────────────────────────────────────
// js/firebase/cloud-save.js
// Sync salvataggi: localStorage ↔ Firebase RTDB
//
// Struttura RTDB:
//   saves/{uid}/slot_0   ← payload JSON del gioco
//   saves/{uid}/slot_1
//   saves/{uid}/slot_2
//
// Esposto su window.CloudSave per compatibilità
// con il resto del gioco (vanilla JS, no modules)
// ─────────────────────────────────────────────

import { auth, db }  from './firebase.js';
import { ref, set, get, remove }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const SLOT_PREFIX = 'wp_slot_';   // stesso prefisso di save.js
const TOTAL_SLOTS = 3;

// ── Riferimento RTDB per lo slot N dell'utente corrente ──
function _ref(slotN) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Non autenticato');
  return ref(db, `saves/${uid}/slot_${slotN}`);
}

// ── Legge un singolo slot da RTDB → stringa JSON (o null) ──
async function cloudRead(slotN) {
  try {
    const snap = await get(_ref(slotN));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.warn('[CloudSave] read error slot', slotN, e);
    return null;
  }
}

// ── Scrive un singolo slot su RTDB ──
async function cloudWrite(slotN, jsonStr) {
  try {
    await set(_ref(slotN), jsonStr);
    return true;
  } catch (e) {
    console.warn('[CloudSave] write error slot', slotN, e);
    return false;
  }
}

// ── Cancella un singolo slot da RTDB ──
async function cloudDelete(slotN) {
  try {
    await remove(_ref(slotN));
    return true;
  } catch (e) {
    console.warn('[CloudSave] delete error slot', slotN, e);
    return false;
  }
}

// ── Sync al login: scarica cloud → localStorage (cloud vince se più recente) ──
export async function syncOnLogin() {
  if (!auth.currentUser) return;
  let syncCount = 0;

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const cloudJson = await cloudRead(i);
    const localJson = localStorage.getItem(SLOT_PREFIX + i);

    if (!cloudJson && !localJson) continue;

    if (cloudJson && !localJson) {
      // Cloud ha dati, locale no → scarica
      localStorage.setItem(SLOT_PREFIX + i, cloudJson);
      syncCount++;
      continue;
    }

    if (!cloudJson && localJson) {
      // Locale ha dati, cloud no → carica
      await cloudWrite(i, localJson);
      syncCount++;
      continue;
    }

    // Entrambi hanno dati → confronta savedAt
    try {
      const cloudMeta = JSON.parse(cloudJson)?.meta;
      const localMeta = JSON.parse(localJson)?.meta;
      const cloudTs   = cloudMeta?.savedAt || cloudMeta?.savedAtMs || 0;
      const localTs   = localMeta?.savedAt || localMeta?.savedAtMs || 0;

      // Confronta come stringhe ISO oppure ms
      const cloudTime = typeof cloudTs === 'number' ? cloudTs : new Date(cloudTs).getTime();
      const localTime = typeof localTs === 'number' ? localTs : new Date(localTs).getTime();

      if (cloudTime > localTime) {
        localStorage.setItem(SLOT_PREFIX + i, cloudJson);
      } else if (localTime > cloudTime) {
        await cloudWrite(i, localJson);
      }
      syncCount++;
    } catch (e) {
      // In caso di errore di parsing, il cloud vince
      localStorage.setItem(SLOT_PREFIX + i, cloudJson);
    }
  }

  if (syncCount > 0) {
    console.log(`[CloudSave] Sincronizzati ${syncCount} slot`);
  }
}

// ── Salva uno slot sia su localStorage che su cloud ──
export async function saveSlot(slotN, jsonStr) {
  localStorage.setItem(SLOT_PREFIX + slotN, jsonStr);
  if (auth.currentUser) {
    await cloudWrite(slotN, jsonStr);
  }
}

// ── Cancella uno slot da localStorage e cloud ──
export async function deleteSlot(slotN) {
  localStorage.removeItem(SLOT_PREFIX + slotN);
  if (auth.currentUser) {
    await cloudDelete(slotN);
  }
}

// ── Espone tutto su window.CloudSave ──────────
window.CloudSave = {
  syncOnLogin,
  saveSlot,
  deleteSlot,
  isLoggedIn: () => !!auth.currentUser,
};

console.log('[CloudSave] Modulo caricato');
