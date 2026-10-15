const elements = {
  orb: document.querySelector('#timerOrb'),
  durationPopover: document.querySelector('#durationPopover'),
  time: document.querySelector('#timeDisplay'),
  status: document.querySelector('#statusText'),
  startPause: document.querySelector('#startPauseButton'),
  reset: document.querySelector('#resetButton'),
  actionWord: document.querySelector('#actionWord'),
  waterToggle: document.querySelector('#waterToggle'),
  water: document.querySelector('#waterAudio'),
  bellAudio: document.querySelector('#bellAudio'),
  install: document.querySelector('#installButton'),
};

let selectedMinutes = 30;
let endAt = null;
let remainingMs = selectedMinutes * 60 * 1000;
let running = false;
let tickHandle = null;
let wakeLock = null;
let installPrompt = null;
let lastIntervalRung = 0;
let longPressTimer = null;
let longPressTriggered = false;
let audioRecoveryHandle = null;
let fallbackAudioContext = null;

const pad = (value) => String(value).padStart(2, '0');

function renderTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  elements.time.textContent = `${pad(minutes)}:${pad(seconds)}`;
  document.title = running ? `${pad(minutes)}:${pad(seconds)} · Still Mind` : 'Still Mind';
}

function setPickerDisabled(disabled) {
  elements.startPause.dataset.durationLocked = String(disabled);
}

async function prepareAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass && !fallbackAudioContext) fallbackAudioContext = new AudioContextClass();
  if (fallbackAudioContext?.state === 'suspended') await fallbackAudioContext.resume();
  elements.water.load();
  elements.bellAudio.load();
}

function ringBell() {
  elements.bellAudio.currentTime = 0;
  elements.bellAudio.play().catch(playFallbackBell);
}

function playFallbackBell() {
  const context = fallbackAudioContext;
  if (!context) return;
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);
  master.connect(context.destination);
  [523.25, 784.88, 1046.5].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = [0.7, 0.22, 0.09][index];
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + 4.6);
  });
}

async function syncWater() {
  if (running && elements.waterToggle.getAttribute('aria-pressed') === 'true') {
    try { await elements.water.play(); } catch (_) { elements.status.textContent = 'Tap Resume to restore sound'; }
  } else {
    elements.water.pause();
  }
}

function startAudioRecovery() {
  clearInterval(audioRecoveryHandle);
  audioRecoveryHandle = setInterval(() => {
    if (running && elements.waterToggle.getAttribute('aria-pressed') === 'true' && elements.water.paused) syncWater();
  }, 1500);
}

function stopAudioRecovery() {
  clearInterval(audioRecoveryHandle);
  audioRecoveryHandle = null;
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) { wakeLock = null; }
}

function saveState() {
  localStorage.setItem('stillwater-session', JSON.stringify({ selectedMinutes, endAt, remainingMs, running, lastIntervalRung }));
}

function clearTick() {
  clearInterval(tickHandle);
  tickHandle = null;
}

function finishSession() {
  running = false;
  endAt = null;
  remainingMs = 0;
  clearTick();
  stopAudioRecovery();
  elements.water.pause();
  ringBell();
  elements.status.textContent = 'Session complete';
  elements.actionWord.textContent = 'again';
  elements.startPause.setAttribute('aria-label', 'Begin meditation again');
  elements.orb.classList.remove('running');
  elements.reset.hidden = false;
  setPickerDisabled(false);
  wakeLock?.release().catch(() => {});
  renderTime(0);
  saveState();
}

function tick() {
  if (!running || !endAt) return;
  const sessionMs = selectedMinutes * 60 * 1000;
  remainingMs = Math.max(0, endAt - Date.now());
  const elapsed = sessionMs - remainingMs;
  const completedIntervals = Math.min(Math.floor(elapsed / (sessionMs / 4)), 4);

  if (completedIntervals > lastIntervalRung && remainingMs > 500) {
    lastIntervalRung = completedIntervals;
    ringBell();
  }

  if (remainingMs <= 0) return finishSession();
  renderTime(remainingMs);
  saveState();
}

async function startSession() {
  await prepareAudio();
  if (remainingMs <= 0) {
    remainingMs = selectedMinutes * 60 * 1000;
    lastIntervalRung = 0;
  }
  endAt = Date.now() + remainingMs;
  running = true;
  setPickerDisabled(true);
  elements.actionWord.textContent = 'pause';
  elements.startPause.setAttribute('aria-label', 'Pause meditation');
  elements.orb.classList.add('running');
  elements.reset.hidden = false;
  elements.status.textContent = 'Breathe naturally';
  await syncWater();
  await requestWakeLock();
  clearTick();
  tickHandle = setInterval(tick, 500);
  startAudioRecovery();
  tick();
}

function pauseSession() {
  remainingMs = Math.max(0, endAt - Date.now());
  endAt = null;
  running = false;
  clearTick();
  stopAudioRecovery();
  elements.water.pause();
  elements.actionWord.textContent = 'resume';
  elements.startPause.setAttribute('aria-label', 'Resume meditation');
  elements.orb.classList.remove('running');
  elements.status.textContent = 'Paused';
  wakeLock?.release().catch(() => {});
  saveState();
}

function resetSession() {
  running = false;
  endAt = null;
  remainingMs = selectedMinutes * 60 * 1000;
  lastIntervalRung = 0;
  clearTick();
  stopAudioRecovery();
  elements.water.pause();
  elements.water.currentTime = 0;
  setPickerDisabled(false);
  elements.actionWord.textContent = 'start';
  elements.startPause.setAttribute('aria-label', 'Start meditation');
  elements.orb.classList.remove('running');
  elements.reset.hidden = true;
  elements.status.textContent = 'Ready when you are';
  wakeLock?.release().catch(() => {});
  renderTime(remainingMs);
  saveState();
}

function chooseDuration(minutes) {
  if (running) return;
  selectedMinutes = minutes;
  remainingMs = selectedMinutes * 60 * 1000;
  lastIntervalRung = 0;
  elements.durationPopover.querySelectorAll('button').forEach((button) => button.classList.toggle('selected', Number(button.dataset.minutes) === selectedMinutes));
  elements.durationPopover.hidden = true;
  renderTime(remainingMs);
  saveState();
}

function openDurationPicker() {
  if (running) return;
  elements.durationPopover.querySelectorAll('button').forEach((button) => button.classList.toggle('selected', Number(button.dataset.minutes) === selectedMinutes));
  elements.durationPopover.hidden = false;
}

elements.durationPopover.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-minutes]');
  if (button) chooseDuration(Number(button.dataset.minutes));
});

elements.startPause.addEventListener('pointerdown', () => {
  if (running) return;
  longPressTriggered = false;
  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    openDurationPicker();
    navigator.vibrate?.(20);
  }, 550);
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
  elements.startPause.addEventListener(eventName, () => clearTimeout(longPressTimer));
});

elements.startPause.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  openDurationPicker();
});

elements.startPause.addEventListener('click', (event) => {
  if (event.button !== 0) return;
  if (longPressTriggered) {
    longPressTriggered = false;
    return;
  }
  running ? pauseSession() : startSession();
});
elements.reset.addEventListener('click', resetSession);
elements.waterToggle.addEventListener('click', () => {
  const enabled = elements.waterToggle.getAttribute('aria-pressed') !== 'true';
  elements.waterToggle.setAttribute('aria-pressed', String(enabled));
  elements.waterToggle.setAttribute('aria-label', enabled ? 'Turn flowing water off' : 'Turn flowing water on');
  elements.waterToggle.classList.toggle('active', enabled);
  syncWater();
});
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.duration-popover') && !event.target.closest('.orb')) {
    elements.durationPopover.hidden = true;
  }
});
elements.water.addEventListener('pause', () => {
  if (running && elements.waterToggle.getAttribute('aria-pressed') === 'true') setTimeout(syncWater, 700);
});

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    if (running) syncWater();
  });
}

window.addEventListener('focus', () => { if (running) syncWater(); });
window.addEventListener('pageshow', () => { if (running) syncWater(); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    tick();
    if (running) {
      requestWakeLock();
      syncWater();
    }
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  elements.install.hidden = false;
});

elements.install.addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  elements.install.hidden = true;
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({ title: 'Meditation session', artist: 'Still Mind', album: 'Flowing water' });
  navigator.mediaSession.setActionHandler('play', () => { if (!running) startSession(); else syncWater(); });
  navigator.mediaSession.setActionHandler('pause', () => { if (running) pauseSession(); });
  navigator.mediaSession.setActionHandler('stop', resetSession);
}

try {
  const saved = JSON.parse(localStorage.getItem('stillwater-session'));
  if (saved && [15, 30, 45, 60, 90].includes(saved.selectedMinutes)) {
    selectedMinutes = saved.selectedMinutes;
    endAt = saved.endAt;
    remainingMs = saved.remainingMs ?? selectedMinutes * 60 * 1000;
    running = Boolean(saved.running && endAt);
    lastIntervalRung = saved.lastIntervalRung || 0;
    elements.durationPopover.querySelectorAll('button').forEach((button) => button.classList.toggle('selected', Number(button.dataset.minutes) === selectedMinutes));
    if (running) {
      remainingMs = Math.max(0, endAt - Date.now());
      setPickerDisabled(true);
      elements.actionWord.textContent = 'pause';
      elements.orb.classList.add('running');
      elements.reset.hidden = false;
      elements.status.textContent = 'Session in progress';
      tickHandle = setInterval(tick, 500);
      startAudioRecovery();
    }
  }
} catch (_) { localStorage.removeItem('stillwater-session'); }

renderTime(remainingMs);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));
