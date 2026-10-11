export interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let pending: InstallPrompt | null = null;
const listeners = new Set<() => void>();
export function captureInstallPrompt(event: Event) {
  event.preventDefault(); pending = event as InstallPrompt; listeners.forEach((listener) => listener());
}
export function clearInstallPrompt() { pending = null; listeners.forEach((listener) => listener()); }
export const getInstallPrompt = () => pending;
export const getServerInstallPrompt = () => null;
export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
