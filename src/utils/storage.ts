// localStorage access for emoemo.
//
// Every koteitan.github.io app shares one origin, so all keys are namespaced
// with the repository name: "emoemo:<name>". Settings live in a single JSON
// object under "emoemo:state"; i18next keeps the UI language under
// "emoemo:lng" (see LANG_KEY below).
//
// Reads fall back to the pre-namespace keys so existing users keep their
// settings. Legacy keys are only ever read - never written, never removed.

const NS = 'emoemo';

const lsKey = (name: string): string => `${NS}:${name}`;

const STATE_KEY = lsKey('state');

/** Key i18next reads/writes the detected language from. */
export const LANG_KEY = lsKey('lng');

/** Pre-namespace keys, kept for read-only migration. */
const LEGACY_LOGGED_IN_KEY = 'emoemo:loggedIn';
const LEGACY_LANG_KEY = 'i18nextLng';

export interface AppState {
  /** The user logged in with NIP-07 before, so auto re-login is allowed. */
  loggedIn?: boolean;
}

/** Build the state from the legacy keys. Nothing is deleted. */
function loadLegacyState(): AppState {
  try {
    if (localStorage.getItem(LEGACY_LOGGED_IN_KEY) === '1') return { loggedIn: true };
  } catch {
    // localStorage may be unavailable (private mode, blocked cookies).
  }
  return {};
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object') return parsed as AppState;
    }
  } catch {
    // Missing, unreadable or malformed - fall through to the legacy keys.
  }
  return loadLegacyState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write errors (quota, private mode).
  }
}

/** Merge a few fields into the stored state. Always writes the new key. */
export function updateState(patch: AppState): void {
  saveState({ ...loadState(), ...patch });
}

/**
 * i18next reads and writes LANG_KEY itself, so the fallback has to happen
 * before init: copy the legacy language into the namespaced key once. The
 * legacy key is left in place.
 */
export function migrateLanguage(): void {
  try {
    if (localStorage.getItem(LANG_KEY) !== null) return;
    const legacy = localStorage.getItem(LEGACY_LANG_KEY);
    if (legacy !== null) localStorage.setItem(LANG_KEY, legacy);
  } catch {
    // Ignore - i18next falls back to the navigator language.
  }
}
