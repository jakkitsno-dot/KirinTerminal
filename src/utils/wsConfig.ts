/**
 * Helper utility to get the central WebSocket URL for PTY, SSH, SFTP, and Network tools.
 * In Electron, it retrieves the dynamically generated auth token and attaches it to the query string.
 */
export function getBackendWsUrl(port: number = 9292): string {
  const base = `ws://127.0.0.1:${port}`;
  try {
    const electronIPC = (window as any).electronIPC;
    if (electronIPC && typeof electronIPC.getAuthToken === 'function') {
      const token = electronIPC.getAuthToken();
      if (token) {
        return `${base}?token=${encodeURIComponent(token)}`;
      }
    }
  } catch (err) {
    console.warn('[wsConfig] Failed to fetch auth token:', err);
  }
  return base;
}
