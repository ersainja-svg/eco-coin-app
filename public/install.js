// ─── PWA INSTALL LOGIC ───────────────────────────────────────
let deferredPrompt = null;

// Catch install prompt (Android/Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show install button
  const btn = document.getElementById('installBtn');
  if (btn) { btn.style.display = 'flex'; }
});

// Detect iOS
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

window.addEventListener('DOMContentLoaded', () => {
  if (isIos() && !isInStandaloneMode()) {
    const btn = document.getElementById('iosInstallBtn');
    if (btn) btn.style.display = 'flex';
  }
});

// Trigger native install (Android)
function triggerInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((result) => {
      if (result.outcome === 'accepted') {
        showToast('✅ Приложение установлено!');
        document.getElementById('installBtn').style.display = 'none';
      }
      deferredPrompt = null;
    });
  }
}

// ─── LANDING NAVIGATION ──────────────────────────────────────
function goToApp() {
  document.getElementById('landingScreen').classList.add('hidden');
  // If logged in go straight to app, otherwise show auth
  if (localStorage.getItem('eco_token')) {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
  } else {
    document.getElementById('authScreen').classList.remove('hidden');
  }
}

// ─── QR MODAL ────────────────────────────────────────────────
function showQrModal() {
  const modal = document.getElementById('qrModal');
  modal.style.display = 'flex';

  const url = window.location.origin;
  document.getElementById('qrUrlText').textContent = url;

  // Generate QR code
  const container = document.getElementById('qrCanvas');
  container.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: url,
      width: 200,
      height: 200,
      colorDark: '#22c55e',
      colorLight: '#060d0a',
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    // Fallback: use QR API
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=060d0a&color=22c55e`;
    img.style.borderRadius = '12px';
    container.appendChild(img);
  }
}

function closeQrModal() {
  document.getElementById('qrModal').style.display = 'none';
}

// ─── iOS MODAL ───────────────────────────────────────────────
function showIosModal() {
  document.getElementById('iosModal').style.display = 'flex';
}
function closeIosModal() {
  document.getElementById('iosModal').style.display = 'none';
}

// Close modals on overlay click
['qrModal', 'iosModal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', (e) => {
    if (e.target === el) el.style.display = 'none';
  });
});

// Installed event
window.addEventListener('appinstalled', () => {
  showToast('🌿 ЭКО Coin установлен! Открывай с рабочего стола.');
  deferredPrompt = null;
});
