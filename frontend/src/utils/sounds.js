const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export const playJoinSound = () => {
  playTone(440, 'sine', 0.1, 0.1);
  setTimeout(() => playTone(660, 'sine', 0.2, 0.1), 100);
};

export const playTickSound = () => {
  playTone(800, 'square', 0.05, 0.02);
};

export const playEndSound = () => {
  playTone(300, 'sawtooth', 0.5, 0.1);
  setTimeout(() => playTone(200, 'sawtooth', 0.8, 0.1), 200);
};

// Unlock AudioContext on first user interaction for mobile devices
const unlockAudioContext = () => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  document.removeEventListener('touchstart', unlockAudioContext);
  document.removeEventListener('click', unlockAudioContext);
};
document.addEventListener('touchstart', unlockAudioContext);
document.addEventListener('click', unlockAudioContext);

