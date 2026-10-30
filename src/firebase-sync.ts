/**
 * Vitalia OS - Real-Time Multi-Device Cloud Synchronization
 * Connects Phone, PC and multiple simultaneous users via Firebase Firestore
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  onSnapshot, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Target dedicated database instance if configured, or default
const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

const WORKSPACE_DOC_ID = 'vitalia_central';
const workspaceDocRef = doc(db, 'workspaces', WORKSPACE_DOC_ID);

// Flags to control synchronization flow
let isReceivingFromCloud = false;
let isCloudSyncReady = false;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// UI Cloud Status Helper
function updateCloudStatusUI(status: 'syncing' | 'synced' | 'error' | 'connecting', message?: string) {
  const syncBadge = document.getElementById('cloud-sync-badge');
  const syncText = document.getElementById('cloud-sync-text');
  const syncDot = document.getElementById('cloud-sync-dot');

  if (syncBadge && syncText && syncDot) {
    syncBadge.classList.remove('hidden');
    if (status === 'synced') {
      syncDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      syncText.innerText = message || 'En la Nube';
      syncBadge.className = 'flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300';
    } else if (status === 'syncing') {
      syncDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-ping';
      syncText.innerText = message || 'Sincronizando...';
      syncBadge.className = 'flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300';
    } else if (status === 'error') {
      syncDot.className = 'w-2 h-2 rounded-full bg-rose-500';
      syncText.innerText = message || 'Error de Sincronización';
      syncBadge.className = 'flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-300';
    } else if (status === 'connecting') {
      syncDot.className = 'w-2 h-2 rounded-full bg-sky-500 animate-pulse';
      syncText.innerText = message || 'Conectando Nube...';
      syncBadge.className = 'flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-300';
    }
  }
}

// Prepare payload for Firestore without undefined fields or circular structures
function cleanPayload(obj: any): any {
  if (obj === undefined) return null;
  return JSON.parse(JSON.stringify(obj));
}

// Push local state to Firestore
export async function pushStateToCloud(localState: any) {
  if (!isCloudSyncReady || isReceivingFromCloud || !localState) return;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(async () => {
    try {
      updateCloudStatusUI('syncing', 'Guardando en Nube...');
      const payload = {
        patients: localState.patients || [],
        attendanceByDate: localState.attendanceByDate || {},
        fixedIncomes: localState.fixedIncomes || [],
        dailyIncomes: localState.dailyIncomes || [],
        incomes: localState.incomes || [],
        fixedExpenses: localState.fixedExpenses || [],
        quickExpenses: localState.quickExpenses || [],
        workshops: localState.workshops || [],
        inventory: localState.inventory || [],
        staff: localState.staff || [],
        calendarNotes: localState.calendarNotes || [],
        receivables: localState.receivables || [],
        aiMessages: localState.aiMessages || [],
        lastSaved: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedByDevice: navigator.userAgent.includes('Mobile') ? 'Teléfono Móvil' : 'Computador / Web'
      };

      await setDoc(workspaceDocRef, cleanPayload(payload), { merge: true });
      updateCloudStatusUI('synced', 'Sincronizado');
    } catch (err) {
      console.error('Error al guardar en Firestore:', err);
      updateCloudStatusUI('error', 'Reintentando...');
    }
  }, 250);
}

// Initialize Real-time synchronization
export async function initCloudSync() {
  updateCloudStatusUI('connecting');

  // Verify connection to Firestore as required by skill guidelines
  try {
    await getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('El cliente Firestore está desconectado temporalmente.');
    }
  }

  try {
    // Initial fetch to check if cloud database has existing data
    const initialSnap = await getDoc(workspaceDocRef);
    const win = window as any;

    if (initialSnap.exists()) {
      const cloudData = initialSnap.data();
      console.log('Datos encontrados en la nube, sincronizando estado inicial...');
      if (win.appState && cloudData) {
        isReceivingFromCloud = true;
        // Merge cloud data into appState
        if (Array.isArray(cloudData.patients) && cloudData.patients.length > 0) {
          win.appState.patients = cloudData.patients;
        }
        if (cloudData.attendanceByDate && typeof cloudData.attendanceByDate === 'object') {
          win.appState.attendanceByDate = cloudData.attendanceByDate;
        }
        if (Array.isArray(cloudData.dailyIncomes)) win.appState.dailyIncomes = cloudData.dailyIncomes;
        if (Array.isArray(cloudData.fixedIncomes)) win.appState.fixedIncomes = cloudData.fixedIncomes;
        if (Array.isArray(cloudData.incomes)) win.appState.incomes = cloudData.incomes;
        if (Array.isArray(cloudData.fixedExpenses)) win.appState.fixedExpenses = cloudData.fixedExpenses;
        if (Array.isArray(cloudData.quickExpenses)) win.appState.quickExpenses = cloudData.quickExpenses;
        if (Array.isArray(cloudData.workshops)) win.appState.workshops = cloudData.workshops;
        if (Array.isArray(cloudData.inventory)) win.appState.inventory = cloudData.inventory;
        if (Array.isArray(cloudData.staff)) win.appState.staff = cloudData.staff;
        if (Array.isArray(cloudData.calendarNotes)) win.appState.calendarNotes = cloudData.calendarNotes;
        if (Array.isArray(cloudData.receivables)) win.appState.receivables = cloudData.receivables;

        // Persist to local storage as cache
        try {
          localStorage.setItem('VITALIA_ERP_MASTER_DB_V1', JSON.stringify(win.appState));
        } catch (_) {}

        if (typeof win.renderActiveView === 'function') {
          win.renderActiveView();
        }
        isReceivingFromCloud = false;
      }
    } else {
      // First time initialization: seed Firestore with local data
      console.log('Base de datos en la nube vacía, inicializando datos de Centro Vitalia...');
      if (win.appState) {
        const payload = {
          patients: win.appState.patients || [],
          attendanceByDate: win.appState.attendanceByDate || {},
          fixedIncomes: win.appState.fixedIncomes || [],
          dailyIncomes: win.appState.dailyIncomes || [],
          incomes: win.appState.incomes || [],
          fixedExpenses: win.appState.fixedExpenses || [],
          quickExpenses: win.appState.quickExpenses || [],
          workshops: win.appState.workshops || [],
          inventory: win.appState.inventory || [],
          staff: win.appState.staff || [],
          calendarNotes: win.appState.calendarNotes || [],
          receivables: win.appState.receivables || [],
          lastSaved: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedByDevice: navigator.userAgent.includes('Mobile') ? 'Teléfono Móvil' : 'Computador / Web'
        };
        await setDoc(workspaceDocRef, cleanPayload(payload));
      }
    }

    isCloudSyncReady = true;
    updateCloudStatusUI('synced', 'Nube Conectada');

    // Attach real-time Firestore listener (changes on Phone will immediately appear on PC, and vice versa)
    onSnapshot(workspaceDocRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const w = window as any;
      if (!w.appState || !data) return;

      // Skip if local write triggered this event
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }

      console.log('⚡ Actualización en tiempo real recibida desde la nube');
      isReceivingFromCloud = true;

      try {
        if (Array.isArray(data.patients)) w.appState.patients = data.patients;
        if (data.attendanceByDate) w.appState.attendanceByDate = data.attendanceByDate;
        if (Array.isArray(data.dailyIncomes)) w.appState.dailyIncomes = data.dailyIncomes;
        if (Array.isArray(data.fixedIncomes)) w.appState.fixedIncomes = data.fixedIncomes;
        if (Array.isArray(data.incomes)) w.appState.incomes = data.incomes;
        if (Array.isArray(data.fixedExpenses)) w.appState.fixedExpenses = data.fixedExpenses;
        if (Array.isArray(data.quickExpenses)) w.appState.quickExpenses = data.quickExpenses;
        if (Array.isArray(data.workshops)) w.appState.workshops = data.workshops;
        if (Array.isArray(data.inventory)) w.appState.inventory = data.inventory;
        if (Array.isArray(data.staff)) w.appState.staff = data.staff;
        if (Array.isArray(data.calendarNotes)) w.appState.calendarNotes = data.calendarNotes;
        if (Array.isArray(data.receivables)) w.appState.receivables = data.receivables;

        // Persist local cache
        localStorage.setItem('VITALIA_ERP_MASTER_DB_V1', JSON.stringify(w.appState));

        // Re-render view
        if (typeof w.renderActiveView === 'function') {
          w.renderActiveView();
        }

        // Update badge
        const deviceSender = data.updatedByDevice || 'otro dispositivo';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-CL');
        updateCloudStatusUI('synced', `Sincronizado (${timeStr})`);

        if (typeof w.showToast === 'function') {
          w.showToast(`Actualizado desde ${deviceSender} (${timeStr})`, 'info');
        }
      } catch (err) {
        console.error('Error aplicando actualización en tiempo real:', err);
      } finally {
        isReceivingFromCloud = false;
      }
    }, (error) => {
      console.error('Error en listener de Firestore:', error);
      updateCloudStatusUI('error', 'Error Nube');
    });

  } catch (err) {
    console.error('Error inicializando Firestore sync:', err);
    updateCloudStatusUI('error', 'Sin conexión Nube');
  }
}

// Expose globally so index.html can call pushStateToCloud whenever commitState runs
(window as any).pushStateToCloud = pushStateToCloud;
(window as any).initCloudSync = initCloudSync;
(window as any).isCloudSyncReady = () => isCloudSyncReady;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initCloudSync());
} else {
  initCloudSync();
}
