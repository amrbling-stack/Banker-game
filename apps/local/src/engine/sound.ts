// Minimal viable sound set (feedback item #2): a news-card sting, a
// cash-transfer sound, a Reckoning alarm, and a master mute — nothing more,
// per the recommendation to sequence polish honestly and not build the full
// "animations and sounds" pass before balance is locked.
//
// Every sound is synthesized with the Web Audio API rather than shipped as
// audio files: this deploy target has no bundled audio asset pipeline and no
// license-clearance question to answer (see item #22, which explicitly
// defers "real soundtrack" for licensing reasons) — a few oscillator beeps
// sidestep that entirely while still giving each event a distinct,
// recognizable cue.

const MUTE_KEY = "raselmal.local.muted.v1";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  // Browsers suspend new AudioContexts until a user gesture; every call site
  // here is already inside a click handler, so resume is safe to fire.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType, gainPeak: number) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audio.currentTime + startOffset;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function play(fn: () => void) {
  if (isMuted()) return;
  try {
    fn();
  } catch {
    // Audio is a nicety, not a dependency — never let it throw into a
    // banking action.
  }
}

/** A short two-note rising sting for a drawn news card. */
export function playNewsSting() {
  play(() => {
    tone(523.25, 0, 0.12, "triangle", 0.12); // C5
    tone(783.99, 0.09, 0.16, "triangle", 0.12); // G5
  });
}

/** A single soft click/chime for any cash movement (deposit, transfer, rent, etc). */
export function playCashTransfer() {
  play(() => {
    tone(660, 0, 0.09, "sine", 0.1);
  });
}

/** An unmistakable, slightly ominous alarm for THE RECKONING. */
export function playReckoningAlarm() {
  play(() => {
    for (let i = 0; i < 3; i++) {
      tone(440, i * 0.22, 0.16, "square", 0.09);
      tone(349.23, i * 0.22 + 0.16, 0.16, "square", 0.09);
    }
  });
}
