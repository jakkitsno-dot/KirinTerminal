import * as CryptoJS from 'crypto-js';

const VAULT_PREFIX = 'ENC:';
const VAULT_VERIFY_KEY = 'mobaxterm_vault_verify';
const VERIFY_MAGIC_WORD = 'mobaxterm_vault_ok';

/**
 * Encrypt a plain text password using the master password
 */
export const encryptPassword = (plainText: string, masterPassword: string): string => {
  if (!plainText) return plainText;
  if (plainText.startsWith(VAULT_PREFIX)) return plainText; // Already encrypted
  const encrypted = CryptoJS.AES.encrypt(plainText, masterPassword).toString();
  return VAULT_PREFIX + encrypted;
};

/**
 * Decrypt an encrypted password using the master password
 */
export const decryptPassword = (cipherText: string, masterPassword: string): string => {
  if (!cipherText) return cipherText;
  if (!cipherText.startsWith(VAULT_PREFIX)) return cipherText; // Not encrypted
  
  try {
    const actualCipher = cipherText.substring(VAULT_PREFIX.length);
    const bytes = CryptoJS.AES.decrypt(actualCipher, masterPassword);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || cipherText; // If empty (wrong password), fallback to cipher or handle error
  } catch (err) {
    console.error('Decryption failed', err);
    return cipherText;
  }
};

/**
 * Check if a string is encrypted
 */
export const isEncrypted = (text: string | undefined): boolean => {
  if (!text) return false;
  return text.startsWith(VAULT_PREFIX);
};

/**
 * Set up the vault with a new master password
 * Saves an encrypted magic word to verify future logins
 */
export const setupVault = (masterPassword: string): void => {
  const verifyToken = encryptPassword(VERIFY_MAGIC_WORD, masterPassword);
  localStorage.setItem(VAULT_VERIFY_KEY, verifyToken);
};

/**
 * Check if the vault has been set up previously
 */
export const isVaultSetup = (): boolean => {
  return !!localStorage.getItem(VAULT_VERIFY_KEY);
};

/**
 * Verify if the provided master password is correct
 */
export const verifyMasterPassword = (masterPassword: string): boolean => {
  const verifyToken = localStorage.getItem(VAULT_VERIFY_KEY);
  if (!verifyToken) return false; // Vault not setup
  
  try {
    const decrypted = decryptPassword(verifyToken, masterPassword);
    return decrypted === VERIFY_MAGIC_WORD;
  } catch (err) {
    return false;
  }
};

/**
 * Remove vault (Requires correct master password to verify intention, done at UI level)
 */
export const clearVault = (): void => {
  localStorage.removeItem(VAULT_VERIFY_KEY);
};
