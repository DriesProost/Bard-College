/** The saved key stays in the privileged process. On Windows Electron uses DPAPI. */
export interface CredentialCipher {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend(): string;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}
export interface CredentialConfig {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
}
export class KeyVault {
  constructor(
    private config: CredentialConfig,
    private cipher: CredentialCipher,
    private platform: string,
  ) {}
  available() {
    return (
      this.cipher.isEncryptionAvailable() &&
      (this.platform !== "linux" ||
        this.cipher.getSelectedStorageBackend() !== "basic_text")
    );
  }
  protection() {
    return this.platform === "win32"
      ? "Windows DPAPI"
      : this.platform === "darwin"
        ? "macOS Keychain"
        : "Linux system keyring";
  }
  hasKey() {
    return !!this.config.get("encryptedKey", "");
  }
  save(key: string) {
    if (!key) {
      this.config.set("encryptedKey", "");
      return;
    }
    if (!this.available())
      throw Error(
        "An operating-system credential store is unavailable. The key was not saved. On Windows, use your signed-in user session. On Linux, unlock a supported keyring.",
      );
    let encrypted: string;
    try {
      encrypted = this.cipher.encryptString(key).toString("base64");
    } catch {
      throw Error(
        "The operating system could not protect this API key. The new key was not saved. Try again in your signed-in Windows session.",
      );
    }
    this.config.set("encryptedKey", encrypted);
  }
  read() {
    if (!this.hasKey())
      throw Error("Add your OpenAI API key in Settings first.");
    if (!this.available())
      throw Error(
        "Secure key storage is unavailable. You can continue writing offline.",
      );
    try {
      return this.cipher.decryptString(
        Buffer.from(this.config.get("encryptedKey", ""), "base64"),
      );
    } catch {
      throw Error(
        "The saved key cannot be unlocked by this operating-system account. Re-enter it in Settings.",
      );
    }
  }
}
