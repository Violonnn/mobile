let shouldPlayResidentLoginIntro = false;

/**
 * The launch route marks the intro only for a cold app start that opens the
 * resident login screen. The value lives only for the current app process.
 */
export function prepareResidentLoginIntroForLaunch(): void {
  shouldPlayResidentLoginIntro = true;
}

/** Reads and clears the one-time resident intro permission. */
export function takeResidentLoginIntro(): boolean {
  const shouldPlay = shouldPlayResidentLoginIntro;
  shouldPlayResidentLoginIntro = false;
  return shouldPlay;
}
