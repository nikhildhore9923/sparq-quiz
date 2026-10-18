// Sparq Web Audio Sound FX Engine
// Generates rich, instant synthetic sound effects without external audio files

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

// Global mute preference (persisted in localStorage)
let soundMuted = localStorage.getItem('sparq_sound_muted') === 'true';

export const isSoundMuted = () => soundMuted;

export const setSoundMuted = (muted) => {
  soundMuted = muted;
  localStorage.setItem('sparq_sound_muted', muted ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('sparq:sound-change', { detail: { muted } }));
};

export const toggleSound = () => {
  const next = !soundMuted;
  setSoundMuted(next);
  return next;
};

function playTone(freq, type, duration, vol, startTimeOffset = 0) {
  if (soundMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    const start = ctx.currentTime + startTimeOffset;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + duration);
  } catch (err) {
    // Audio contexts can fail silently in background tabs or unpermitted states
  }
}

// 1. Participant Joined chime (bright ascending dual tone)
export const playJoinSound = () => {
  playTone(440, 'sine', 0.12, 0.12, 0);
  playTone(660, 'sine', 0.22, 0.12, 0.08);
};

// 2. Clock tick (neutral percussive click)
export const playTickSound = () => {
  playTone(800, 'square', 0.04, 0.02, 0);
};

// 3. Urgent tick for countdown <= 5s
export const playUrgentTickSound = () => {
  playTone(950, 'triangle', 0.06, 0.04, 0);
};

// 4. Correct answer celebratory chime (C5 -> E5 -> G5)
export const playCorrectSound = () => {
  playTone(523.25, 'triangle', 0.15, 0.15, 0);       // C5
  playTone(659.25, 'triangle', 0.18, 0.15, 0.1);     // E5
  playTone(783.99, 'sine', 0.35, 0.2, 0.2);          // G5
};

// 5. Wrong answer gentle buzz
export const playWrongSound = () => {
  playTone(220, 'sawtooth', 0.2, 0.08, 0);
  playTone(180, 'sawtooth', 0.3, 0.08, 0.1);
};

// 6. Question/round end
export const playEndSound = () => {
  playTone(330, 'sine', 0.2, 0.1, 0);
  playTone(260, 'sine', 0.35, 0.1, 0.15);
};

// 7. Victory / Final Podium Fanfare (C5 -> E5 -> G5 -> C6)
export const playVictorySound = () => {
  playTone(523.25, 'triangle', 0.2, 0.18, 0);       // C5
  playTone(659.25, 'triangle', 0.2, 0.18, 0.12);    // E5
  playTone(783.99, 'triangle', 0.25, 0.18, 0.24);   // G5
  playTone(1046.50, 'sine', 0.6, 0.22, 0.38);       // C6
};

// Unlock AudioContext on first user interaction for mobile browsers
const unlockAudioContext = () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  document.removeEventListener('touchstart', unlockAudioContext);
  document.removeEventListener('click', unlockAudioContext);
  document.removeEventListener('keydown', unlockAudioContext);
};

if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', unlockAudioContext, { passive: true });
  document.addEventListener('click', unlockAudioContext, { passive: true });
  document.addEventListener('keydown', unlockAudioContext, { passive: true });
}
