const SOUND_KEY = "isSoundEnabled";

function isSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null || v === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, String(enabled));
  } catch {
    // quota exceeded
  }
}

export function getSoundEnabled(): boolean {
  return isSoundEnabled();
}

const audioCache = new Map<string, HTMLAudioElement>();

function play(src: string): void {
  if (!isSoundEnabled()) return;

  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audioCache.set(src, audio);
  }

  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function playSuccessSound(): void {
  play("/sounds/success.mp3");
}

export function playErrorSound(): void {
  play("/sounds/error.mp3");
}

export function playCheckSound(): void {
  play("/sounds/check.mp3");
}

export function playNotificationSound(): void {
  play("/sounds/notification.mp3");
}
