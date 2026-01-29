/**
 * Secure storage handlers for API keys using Electron safeStorage
 * 
 * This provides OS-level encryption for sensitive data:
 * - Windows: Uses DPAPI
 * - macOS: Uses Keychain
 * - Linux: Uses libsecret
 */

import { ipcMain, safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

// Storage file for encrypted keys
const SECURE_STORAGE_FILE = 'secure_keys.enc';

interface SecureKeys {
  openai_api_key?: string;
  hf_token?: string;
}

function getStoragePath(): string {
  return path.join(app.getPath('userData'), SECURE_STORAGE_FILE);
}

function loadEncryptedKeys(): SecureKeys {
  const storagePath = getStoragePath();
  
  if (!fs.existsSync(storagePath)) {
    return {};
  }
  
  try {
    const encryptedData = fs.readFileSync(storagePath);
    
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[SecureStorage] Encryption not available, cannot decrypt keys');
      return {};
    }
    
    const decryptedString = safeStorage.decryptString(encryptedData);
    return JSON.parse(decryptedString);
  } catch (err) {
    console.error('[SecureStorage] Failed to load keys:', err);
    return {};
  }
}

function saveEncryptedKeys(keys: SecureKeys): boolean {
  const storagePath = getStoragePath();
  
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[SecureStorage] Encryption not available, cannot save keys securely');
    return false;
  }
  
  try {
    const jsonString = JSON.stringify(keys);
    const encryptedBuffer = safeStorage.encryptString(jsonString);
    fs.writeFileSync(storagePath, encryptedBuffer);
    return true;
  } catch (err) {
    console.error('[SecureStorage] Failed to save keys:', err);
    return false;
  }
}

export function registerSecureStorageHandlers() {
  console.log('[IPC] Registering secure storage handlers');
  
  /**
   * Check if secure storage is available
   */
  ipcMain.handle('secure-storage-available', async () => {
    return safeStorage.isEncryptionAvailable();
  });
  
  /**
   * Store an API key securely
   */
  ipcMain.handle('secure-storage-set', async (_event, key: string, value: string) => {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Invalid key name' };
    }
    
    try {
      const keys = loadEncryptedKeys();
      
      if (value) {
        keys[key as keyof SecureKeys] = value;
      } else {
        delete keys[key as keyof SecureKeys];
      }
      
      const success = saveEncryptedKeys(keys);
      return { success };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMsg };
    }
  });
  
  /**
   * Retrieve an API key (decrypted)
   * Note: Only return to renderer when actually needed for API calls
   */
  ipcMain.handle('secure-storage-get', async (_event, key: string) => {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Invalid key name', value: null };
    }
    
    try {
      const keys = loadEncryptedKeys();
      const value = keys[key as keyof SecureKeys] || null;
      return { success: true, value };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMsg, value: null };
    }
  });
  
  /**
   * Check if a key exists (without returning the value)
   */
  ipcMain.handle('secure-storage-has', async (_event, key: string) => {
    if (!key || typeof key !== 'string') {
      return false;
    }
    
    try {
      const keys = loadEncryptedKeys();
      return !!keys[key as keyof SecureKeys];
    } catch (err) {
      return false;
    }
  });
  
  /**
   * Delete a key
   */
  ipcMain.handle('secure-storage-delete', async (_event, key: string) => {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Invalid key name' };
    }
    
    try {
      const keys = loadEncryptedKeys();
      delete keys[key as keyof SecureKeys];
      const success = saveEncryptedKeys(keys);
      return { success };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMsg };
    }
  });
  
  /**
   * List all stored key names (not values)
   */
  ipcMain.handle('secure-storage-list', async () => {
    try {
      const keys = loadEncryptedKeys();
      return Object.keys(keys).filter(k => !!keys[k as keyof SecureKeys]);
    } catch (err) {
      return [];
    }
  });
  
  console.log('[IPC] Secure storage handlers registered');
}
