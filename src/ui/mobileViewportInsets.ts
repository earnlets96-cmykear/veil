export function applyPlatformViewportInsets(
  platform: string,
  documentRoot: Pick<HTMLElement, 'classList'> = document.documentElement
): void {
  if (platform === 'android') {
    documentRoot.classList.add('veil-android-native');
  }
}
