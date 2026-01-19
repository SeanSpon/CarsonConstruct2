import { ipcMain, shell, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { getMainWindow } from '../window';

// Google Drive OAuth configuration
// Users need to set up their own Google Cloud project and OAuth credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = 'http://localhost:8085/oauth/callback';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file', // Create and manage files
];

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  expiry_date?: number;
}

interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

// Store tokens in memory (in production, use secure storage)
let tokenData: TokenData | null = null;

// Helper: Get OAuth URL
function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    scope: GOOGLE_SCOPES.join(' '),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Helper: Exchange code for tokens
async function exchangeCodeForTokens(code: string): Promise<TokenData> {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const tokens = JSON.parse(data);
          if (tokens.error) {
            reject(new Error(tokens.error_description || tokens.error));
          } else {
            tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
            resolve(tokens);
          }
        } catch (e) {
          reject(new Error('Failed to parse token response'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Helper: Refresh access token
async function refreshAccessToken(): Promise<void> {
  if (!tokenData?.refresh_token) {
    throw new Error('No refresh token available');
  }

  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenData!.refresh_token!,
      grant_type: 'refresh_token',
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const newTokens = JSON.parse(data);
          if (newTokens.error) {
            reject(new Error(newTokens.error_description || newTokens.error));
          } else {
            tokenData = {
              ...tokenData!,
              access_token: newTokens.access_token,
              expires_in: newTokens.expires_in,
              expiry_date: Date.now() + (newTokens.expires_in * 1000),
            };
            resolve();
          }
        } catch (e) {
          reject(new Error('Failed to refresh token'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Helper: Get valid access token
async function getValidAccessToken(): Promise<string> {
  if (!tokenData) {
    throw new Error('Not authenticated with Google Drive');
  }

  // Check if token is expired or about to expire
  if (tokenData.expiry_date && Date.now() > tokenData.expiry_date - 60000) {
    await refreshAccessToken();
  }

  return tokenData.access_token;
}

// Helper: Upload file to Google Drive
async function uploadFile(
  filePath: string,
  fileName: string,
  folderId?: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ id: string; webViewLink: string }> {
  const accessToken = await getValidAccessToken();
  const fileSize = fs.statSync(filePath).size;
  const mimeType = getMimeType(filePath);

  // Step 1: Initialize resumable upload
  const metadata = JSON.stringify({
    name: fileName,
    parents: folderId ? [folderId] : undefined,
  });

  const initResponse = await new Promise<string>((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      port: 443,
      path: '/upload/drive/v3/files?uploadType=resumable',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': fileSize.toString(),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        const uploadUrl = res.headers['location'];
        if (uploadUrl) {
          resolve(uploadUrl);
        } else {
          reject(new Error('No upload URL in response'));
        }
      } else {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          reject(new Error(`Init failed: ${res.statusCode} - ${data}`));
        });
      }
    });

    req.on('error', reject);
    req.write(metadata);
    req.end();
  });

  // Step 2: Upload file content
  return new Promise((resolve, reject) => {
    const url = new URL(initResponse);
    const fileStream = fs.createReadStream(filePath);
    let bytesUploaded = 0;

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': mimeType,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const result = JSON.parse(data);
            resolve({
              id: result.id,
              webViewLink: `https://drive.google.com/file/d/${result.id}/view`,
            });
          } catch (e) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);

    fileStream.on('data', (chunk: Buffer) => {
      bytesUploaded += chunk.length;
      if (onProgress) {
        onProgress({
          bytesUploaded,
          totalBytes: fileSize,
          percentage: Math.round((bytesUploaded / fileSize) * 100),
        });
      }
    });

    fileStream.pipe(req);
  });
}

// Helper: Get MIME type
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.json': 'application/json',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// IPC Handlers

// Check if authenticated
ipcMain.handle('cloud-check-auth', async () => {
  return {
    isAuthenticated: !!tokenData,
    hasCredentials: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
  };
});

// Start OAuth flow
ipcMain.handle('cloud-start-auth', async () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return {
      success: false,
      error: 'Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
    };
  }

  return new Promise((resolve) => {
    // Create a simple HTTP server to handle the callback
    const http = require('http');
    const server = http.createServer(async (req: any, res: any) => {
      const url = new URL(req.url, `http://localhost:8085`);
      
      if (url.pathname === '/oauth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication Failed</h1><p>You can close this window.</p></body></html>');
          server.close();
          resolve({ success: false, error });
          return;
        }

        if (code) {
          try {
            tokenData = await exchangeCodeForTokens(code);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Authentication Successful!</h1><p>You can close this window and return to PodFlow Studio.</p><script>window.close();</script></body></html>');
            server.close();
            resolve({ success: true });
          } catch (err) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h1>Authentication Failed</h1><p>${err}</p></body></html>`);
            server.close();
            resolve({ success: false, error: String(err) });
          }
        }
      }
    });

    server.listen(8085, () => {
      // Open auth URL in browser
      shell.openExternal(getAuthUrl());
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      resolve({ success: false, error: 'Authentication timed out' });
    }, 5 * 60 * 1000);
  });
});

// Sign out
ipcMain.handle('cloud-sign-out', async () => {
  tokenData = null;
  return { success: true };
});

// Upload file to Google Drive
ipcMain.handle('cloud-upload', async (_event, data: {
  filePath: string;
  fileName?: string;
  folderId?: string;
}) => {
  const win = getMainWindow();
  const { filePath, fileName, folderId } = data;

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'File not found' };
  }

  const actualFileName = fileName || path.basename(filePath);

  try {
    const result = await uploadFile(
      filePath,
      actualFileName,
      folderId,
      (progress) => {
        if (win) {
          win.webContents.send('cloud-upload-progress', progress);
        }
      },
    );

    return {
      success: true,
      fileId: result.id,
      webViewLink: result.webViewLink,
    };
  } catch (err) {
    return {
      success: false,
      error: String(err),
    };
  }
});

// Upload multiple files
ipcMain.handle('cloud-upload-batch', async (_event, data: {
  files: Array<{ filePath: string; fileName?: string }>;
  folderId?: string;
  folderName?: string;
}) => {
  const win = getMainWindow();
  const { files, folderId, folderName } = data;

  const results: Array<{
    filePath: string;
    success: boolean;
    fileId?: string;
    webViewLink?: string;
    error?: string;
  }> = [];

  let completedFiles = 0;
  const totalFiles = files.length;

  // TODO: Create folder if folderName provided

  for (const file of files) {
    if (!fs.existsSync(file.filePath)) {
      results.push({
        filePath: file.filePath,
        success: false,
        error: 'File not found',
      });
      completedFiles++;
      continue;
    }

    try {
      const result = await uploadFile(
        file.filePath,
        file.fileName || path.basename(file.filePath),
        folderId,
        (progress) => {
          if (win) {
            win.webContents.send('cloud-upload-progress', {
              ...progress,
              currentFile: completedFiles + 1,
              totalFiles,
              fileName: file.fileName || path.basename(file.filePath),
            });
          }
        },
      );

      results.push({
        filePath: file.filePath,
        success: true,
        fileId: result.id,
        webViewLink: result.webViewLink,
      });
    } catch (err) {
      results.push({
        filePath: file.filePath,
        success: false,
        error: String(err),
      });
    }

    completedFiles++;
  }

  const successCount = results.filter(r => r.success).length;

  return {
    success: successCount === totalFiles,
    totalFiles,
    successCount,
    results,
  };
});

// Get shareable link for a file
ipcMain.handle('cloud-get-link', async (_event, fileId: string) => {
  try {
    const accessToken = await getValidAccessToken();
    
    // Make file publicly viewable
    await new Promise<void>((resolve, reject) => {
      const postData = JSON.stringify({
        role: 'reader',
        type: 'anyone',
      });

      const options = {
        hostname: 'www.googleapis.com',
        port: 443,
        path: `/drive/v3/files/${fileId}/permissions`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            reject(new Error(`Failed to set permissions: ${data}`));
          });
        }
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    return {
      success: true,
      link: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
    };
  } catch (err) {
    return {
      success: false,
      error: String(err),
    };
  }
});

console.log('[Cloud] Google Drive handlers registered');
