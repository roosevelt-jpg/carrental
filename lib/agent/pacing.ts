export function typingDelayMs(text: string): number {
  const factor = 18;
  return Math.min(Math.max(text.length * factor, 800), 4000);
}

export function remainingTypingDelayMs(text: string, typingStartedAt: number): number {
  return Math.max(0, typingDelayMs(text) - (Date.now() - typingStartedAt));
}

export function betweenMessageDelayMs(): number {
  return 1000 + Math.floor(Math.random() * 1500);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
