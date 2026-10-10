const MICROPHONE_EXPLANATION_ACKNOWLEDGED_KEY = 'veil:permissions:microphone-explanation-acknowledged';

type PermissionExplanationStorage = Pick<Storage, 'getItem' | 'setItem'>;

let acknowledgedInMemory = false;

function getBrowserStorage(): PermissionExplanationStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function hasAcknowledgedMicrophonePermissionExplanation(
  storage: PermissionExplanationStorage | null = getBrowserStorage()
): boolean {
  if (acknowledgedInMemory) return true;
  try {
    acknowledgedInMemory = storage?.getItem(MICROPHONE_EXPLANATION_ACKNOWLEDGED_KEY) === 'true';
  } catch {
    return false;
  }
  return acknowledgedInMemory;
}

export function acknowledgeMicrophonePermissionExplanation(
  storage: PermissionExplanationStorage | null = getBrowserStorage()
): void {
  acknowledgedInMemory = true;
  try {
    storage?.setItem(MICROPHONE_EXPLANATION_ACKNOWLEDGED_KEY, 'true');
  } catch {
    // The in-memory acknowledgement still prevents repeated prompts this session.
  }
}

export function shouldShowMicrophonePermissionExplanation(
  permissionState: PermissionState | string,
  hasAcknowledged: boolean
): boolean {
  return permissionState === 'prompt' && !hasAcknowledged;
}
