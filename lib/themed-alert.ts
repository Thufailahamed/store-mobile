/**
 * App-styled replacement for Alert.alert. Same call shape:
 *   themedAlert(title, message?, buttons?)
 * Rendered by <ThemedAlertHost /> mounted once in the root layout.
 */

export type ThemedAlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type ThemedAlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: ThemedAlertButton[];
};

type Listener = (request: ThemedAlertRequest | null) => void;

let current: ThemedAlertRequest | null = null;
let seq = 0;
const listeners = new Set<Listener>();

const notify = () => listeners.forEach((l) => l(current));

export function themedAlert(title: string, message?: string, buttons?: ThemedAlertButton[]): void {
  current = {
    id: ++seq,
    title,
    message,
    buttons: buttons && buttons.length ? buttons : [{ text: "OK" }],
  };
  notify();
}

export function dismissThemedAlert(): void {
  current = null;
  notify();
}

export function subscribeThemedAlert(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
