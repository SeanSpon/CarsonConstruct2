import { ipcMain, app } from 'electron';
import { spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getMainWindow } from '../window';

console.log('[Instagram] Loading Instagram handlers module...');

// Directory for downloaded Instagram videos
const getDownloadsDir = () => {
  const dir = path.join(app.getPath('userData'), 'instagram_downloads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Check if yt-dlp is available
async function checkYtDlp(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('yt-dlp --version', (error) => {
      resolve(!error);
    });
  });
}

// Download Instagram video using yt-dlp
async function downloadInstagramVideo(
  url: string,
  onProgress?: (progress: { percent: number; message: string }) => void
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const downloadsDir = getDownloadsDir();
  const outputTemplate = path.join(downloadsDir, '%(id)s.%(ext)s');
  
  return new Promise((resolve) => {
    const args = [
      '--no-warnings',
      '-f', 'best[ext=mp4]/best', // Prefer mp4
      '-o', outputTemplate,
      '--no-playlist',
      '--no-mtime', // Don't set file modification time
      '--progress',
      url
    ];
    
    console.log('[Instagram] Downloading:', url);
    const ytdlpProcess = spawn('yt-dlp', args);
    
    let outputFile = '';
    let lastPercent = 0;
    
    ytdlpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Instagram] stdout:', output);
      
      // Parse progress: [download]  50.0% of 10.00MiB at 1.00MiB/s ETA 00:05
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (progressMatch && onProgress) {
        const percent = parseFloat(progressMatch[1]);
        if (percent > lastPercent) {
          lastPercent = percent;
          onProgress({ percent, message: `Downloading: ${percent.toFixed(1)}%` });
        }
      }
      
      // Parse destination: [download] Destination: /path/to/file.mp4
      const destMatch = output.match(/\[download\] Destination: (.+)/);
      if (destMatch) {
        outputFile = destMatch[1].trim();
      }
      
      // Already downloaded
      const alreadyMatch = output.match(/\[download\] (.+) has already been downloaded/);
      if (alreadyMatch) {
        outputFile = alreadyMatch[1].trim();
      }
    });
    
    ytdlpProcess.stderr.on('data', (data) => {
      console.error('[Instagram] stderr:', data.toString());
    });
    
    ytdlpProcess.on('close', (code) => {
      console.log('[Instagram] Process exited with code:', code);
      
      if (code === 0 && outputFile && fs.existsSync(outputFile)) {
        resolve({ success: true, filePath: outputFile });
      } else if (code === 0) {
        // Try to find the downloaded file
        const files = fs.readdirSync(downloadsDir)
          .filter(f => f.endsWith('.mp4') || f.endsWith('.webm'))
          .map(f => ({ name: f, time: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);
        
        if (files.length > 0) {
          resolve({ success: true, filePath: path.join(downloadsDir, files[0].name) });
        } else {
          resolve({ success: false, error: 'Download completed but file not found' });
        }
      } else {
        resolve({ success: false, error: `Download failed with code ${code}` });
      }
    });
    
    ytdlpProcess.on('error', (error) => {
      console.error('[Instagram] Process error:', error);
      resolve({ success: false, error: `Failed to start yt-dlp: ${error.message}` });
    });
  });
}

// Extract video ID from Instagram URL
function extractInstagramId(url: string): string | null {
  // Patterns:
  // https://www.instagram.com/reel/ABC123/
  // https://www.instagram.com/p/ABC123/
  // https://instagram.com/reel/ABC123/
  const patterns = [
    /instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/.*\/(?:reel|p)\/([A-Za-z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// IPC Handler: Check if yt-dlp is installed
ipcMain.handle('instagram-check-ytdlp', async () => {
  console.log('[Instagram] Checking yt-dlp availability...');
  const available = await checkYtDlp();
  console.log('[Instagram] yt-dlp available:', available);
  return { available };
});

// IPC Handler: Download Instagram video
ipcMain.handle('instagram-download', async (_event, data: { url: string }) => {
  const win = getMainWindow();
  const { url } = data;
  
  // Validate URL
  const videoId = extractInstagramId(url);
  if (!videoId) {
    return { 
      success: false, 
      error: 'Invalid Instagram URL. Use a URL like: https://instagram.com/reel/ABC123/' 
    };
  }
  
  // Check yt-dlp
  const ytdlpAvailable = await checkYtDlp();
  if (!ytdlpAvailable) {
    return {
      success: false,
      error: 'yt-dlp is not installed. Install it with: pip install yt-dlp'
    };
  }
  
  try {
    const result = await downloadInstagramVideo(url, (progress) => {
      if (win) {
        win.webContents.send('instagram-download-progress', progress);
      }
    });
    
    if (result.success && result.filePath) {
      // Get video metadata
      const stats = fs.statSync(result.filePath);
      
      return {
        success: true,
        filePath: result.filePath,
        fileName: path.basename(result.filePath),
        size: stats.size,
        videoId,
      };
    }
    
    return result;
  } catch (err) {
    return {
      success: false,
      error: `Download failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
});

// IPC Handler: Download TikTok video (same method works)
ipcMain.handle('tiktok-download', async (_event, data: { url: string }) => {
  const win = getMainWindow();
  const { url } = data;
  
  // Validate it's a TikTok URL
  if (!url.includes('tiktok.com')) {
    return { 
      success: false, 
      error: 'Invalid TikTok URL' 
    };
  }
  
  const ytdlpAvailable = await checkYtDlp();
  if (!ytdlpAvailable) {
    return {
      success: false,
      error: 'yt-dlp is not installed. Install it with: pip install yt-dlp'
    };
  }
  
  try {
    const result = await downloadInstagramVideo(url, (progress) => {
      if (win) {
        win.webContents.send('instagram-download-progress', progress);
      }
    });
    
    if (result.success && result.filePath) {
      const stats = fs.statSync(result.filePath);
      
      return {
        success: true,
        filePath: result.filePath,
        fileName: path.basename(result.filePath),
        size: stats.size,
      };
    }
    
    return result;
  } catch (err) {
    return {
      success: false,
      error: `Download failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
});

// IPC Handler: List downloaded style reference videos
ipcMain.handle('instagram-list-downloads', async () => {
  const downloadsDir = getDownloadsDir();
  
  try {
    const files = fs.readdirSync(downloadsDir)
      .filter(f => f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov'))
      .map(f => {
        const filePath = path.join(downloadsDir, f);
        const stats = fs.statSync(filePath);
        return {
          fileName: f,
          filePath,
          size: stats.size,
          downloadedAt: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.downloadedAt - a.downloadedAt);
    
    return { success: true, files };
  } catch (err) {
    return { success: false, files: [], error: String(err) };
  }
});

// IPC Handler: Delete downloaded video
ipcMain.handle('instagram-delete-download', async (_event, data: { filePath: string }) => {
  try {
    if (fs.existsSync(data.filePath)) {
      fs.unlinkSync(data.filePath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

console.log('[Instagram] Handlers registered');
