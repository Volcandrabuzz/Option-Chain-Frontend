/**
 * Web Audio API based full-volume beep sound utility.
 * Generates loud, distinctive crossover alert beeps without any external audio files.
 */

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext initialization error:', e);
    return null;
  }
}

/**
 * Plays a loud, distinctive multi-beep alarm at full volume (gain = 1.0).
 * Plays 3 rapid, powerful beeps designed to cut through background noise.
 */
export function playCrossoverBeep(direction?: 'PE_CROSSED_ABOVE' | 'CE_CROSSED_ABOVE') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Frequencies: Ascending if PE crossed above (bullish), descending if CE crossed above (bearish)
    const pattern = direction === 'PE_CROSSED_ABOVE'
      ? [850, 1150, 1450]
      : direction === 'CE_CROSSED_ABOVE'
      ? [1450, 1150, 850]
      : [1000, 1300, 1000];

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, now);
    masterGain.connect(ctx.destination);

    pattern.forEach((freq, idx) => {
      const startTime = now + idx * 0.14;
      const duration = 0.11;

      // Primary oscillator (square for punch & loudness)
      const osc1 = ctx.createOscillator();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(freq, startTime);

      // Secondary oscillator (sine for body & fullness)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 0.5, startTime);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0, startTime);
      toneGain.gain.linearRampToValueAtTime(0.8, startTime + 0.01);
      toneGain.gain.setValueAtTime(0.8, startTime + duration - 0.02);
      toneGain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc1.connect(toneGain);
      osc2.connect(toneGain);
      toneGain.connect(masterGain);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
    });
  } catch (err) {
    console.error('Audio playback error:', err);
  }
}

export function testBeepSound() {
  getAudioContext();
  playCrossoverBeep('PE_CROSSED_ABOVE');
}

