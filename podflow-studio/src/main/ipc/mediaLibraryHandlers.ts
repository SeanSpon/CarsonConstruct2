import { ipcMain, dialog, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Get the media library directory path
function getMediaLibraryPath(): string {
  const userDataPath = app.getPath('userData');
  const mediaLibraryPath = path.join(userDataPath, 'MediaLibrary');
  
  // Create if doesn't exist
  if (!fs.existsSync(mediaLibraryPath)) {
    fs.mkdirSync(mediaLibraryPath, { recursive: true });
  }
  
  return mediaLibraryPath;
}

// Get subdirectory for specific media type
function getMediaTypePath(type: 'video' | 'audio' | 'broll' | 'music' | 'sfx'): string {
  const libraryPath = getMediaLibraryPath();
  const typePath = path.join(libraryPath, type);
  
  if (!fs.existsSync(typePath)) {
    fs.mkdirSync(typePath, { recursive: true });
  }
  
  return typePath;
}

// Get media library metadata file path
function getMetadataPath(): string {
  const libraryPath = getMediaLibraryPath();
  return path.join(libraryPath, 'library.json');
}

// Load library metadata
function loadLibraryMetadata(): MediaLibraryMetadata {
  const metadataPath = getMetadataPath();
  
  if (fs.existsSync(metadataPath)) {
    try {
      const content = fs.readFileSync(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error('[MediaLibrary] Failed to load metadata:', err);
    }
  }
  
  // Return default empty metadata
  return {
    version: '1.0.0',
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Save library metadata
function saveLibraryMetadata(metadata: MediaLibraryMetadata): void {
  const metadataPath = getMetadataPath();
  metadata.updatedAt = new Date().toISOString();
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

// Media item in library
interface MediaLibraryItem {
  id: string;
  name: string;
  fileName: string;
  originalPath: string; // Where the file was imported from
  libraryPath: string; // Path in the media library
  type: 'video' | 'audio' | 'broll' | 'music' | 'sfx';
  size: number;
  duration?: number;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  thumbnailPath?: string;
  addedAt: string;
  tags?: string[];
}

// Library metadata structure
interface MediaLibraryMetadata {
  version: string;
  items: MediaLibraryItem[];
  createdAt: string;
  updatedAt: string;
}

// Generate unique ID for media item
function generateMediaId(): string {
  return `media_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Copy file to library with progress
async function copyFileToLibrary(
  sourcePath: string,
  destPath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const readStream = fs.createReadStream(sourcePath);
    const writeStream = fs.createWriteStream(destPath);
    
    readStream.on('error', (err) => {
      console.error('[MediaLibrary] Read error:', err);
      resolve(false);
    });
    
    writeStream.on('error', (err) => {
      console.error('[MediaLibrary] Write error:', err);
      resolve(false);
    });
    
    writeStream.on('finish', () => {
      resolve(true);
    });
    
    readStream.pipe(writeStream);
  });
}

console.log('[MediaLibrary] Registering media library handlers...');

// Get library path
ipcMain.handle('media-library-get-path', async () => {
  return getMediaLibraryPath();
});

// Get all items in the library
ipcMain.handle('media-library-get-items', async () => {
  try {
    const metadata = loadLibraryMetadata();
    
    // Verify files still exist and filter out missing ones
    const validItems = metadata.items.filter((item) => {
      const exists = fs.existsSync(item.libraryPath);
      if (!exists) {
        console.log('[MediaLibrary] File no longer exists:', item.libraryPath);
      }
      return exists;
    });
    
    // Update metadata if items were removed
    if (validItems.length !== metadata.items.length) {
      metadata.items = validItems;
      saveLibraryMetadata(metadata);
    }
    
    return {
      success: true,
      items: validItems,
      libraryPath: getMediaLibraryPath(),
    };
  } catch (err) {
    console.error('[MediaLibrary] Failed to get items:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      items: [],
    };
  }
});

// Import files to library
ipcMain.handle('media-library-import', async (_event, data: {
  type: 'video' | 'audio' | 'broll' | 'music' | 'sfx';
  filePaths?: string[]; // If provided, import these files. Otherwise show dialog
}) => {
  try {
    const { type } = data;
    let filePaths = data.filePaths;
    
    // If no file paths provided, show file picker
    if (!filePaths || filePaths.length === 0) {
      const filters = type === 'video' || type === 'broll'
        ? [
            { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        : [
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'] },
            { name: 'All Files', extensions: ['*'] }
          ];
      
      const result = await dialog.showOpenDialog({
        title: `Import ${type.charAt(0).toUpperCase() + type.slice(1)} Files`,
        properties: ['openFile', 'multiSelections'],
        filters,
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, items: [], canceled: true };
      }
      
      filePaths = result.filePaths;
    }
    
    const typePath = getMediaTypePath(type);
    const metadata = loadLibraryMetadata();
    const importedItems: MediaLibraryItem[] = [];
    const errors: string[] = [];
    
    for (const sourcePath of filePaths) {
      try {
        const fileName = path.basename(sourcePath);
        const stats = fs.statSync(sourcePath);
        
        // Generate unique filename to avoid conflicts
        const id = generateMediaId();
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const uniqueFileName = `${baseName}_${id.slice(-8)}${ext}`;
        const destPath = path.join(typePath, uniqueFileName);
        
        // Copy file to library
        const copied = await copyFileToLibrary(sourcePath, destPath);
        if (!copied) {
          errors.push(`Failed to copy: ${fileName}`);
          continue;
        }
        
        // Create library item
        const item: MediaLibraryItem = {
          id,
          name: baseName,
          fileName: uniqueFileName,
          originalPath: sourcePath,
          libraryPath: destPath,
          type,
          size: stats.size,
          addedAt: new Date().toISOString(),
        };
        
        importedItems.push(item);
        metadata.items.push(item);
        
        console.log('[MediaLibrary] Imported:', fileName, '->', destPath);
      } catch (err) {
        console.error('[MediaLibrary] Failed to import file:', sourcePath, err);
        errors.push(`Failed to import: ${path.basename(sourcePath)}`);
      }
    }
    
    // Save updated metadata
    if (importedItems.length > 0) {
      saveLibraryMetadata(metadata);
    }
    
    return {
      success: true,
      items: importedItems,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err) {
    console.error('[MediaLibrary] Import failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      items: [],
    };
  }
});

// Update media item metadata (e.g., after validating with ffprobe)
ipcMain.handle('media-library-update-item', async (_event, data: {
  id: string;
  updates: Partial<MediaLibraryItem>;
}) => {
  try {
    const { id, updates } = data;
    const metadata = loadLibraryMetadata();
    
    const itemIndex = metadata.items.findIndex((item) => item.id === id);
    if (itemIndex === -1) {
      return { success: false, error: 'Item not found' };
    }
    
    // Don't allow changing id, libraryPath, or originalPath
    const safeUpdates = { ...updates };
    delete safeUpdates.id;
    delete safeUpdates.libraryPath;
    delete safeUpdates.originalPath;
    
    metadata.items[itemIndex] = {
      ...metadata.items[itemIndex],
      ...safeUpdates,
    };
    
    saveLibraryMetadata(metadata);
    
    return {
      success: true,
      item: metadata.items[itemIndex],
    };
  } catch (err) {
    console.error('[MediaLibrary] Update failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

// Remove item from library
ipcMain.handle('media-library-remove', async (_event, data: {
  id: string;
  deleteFile?: boolean; // If true, also delete the file from disk
}) => {
  try {
    const { id, deleteFile = true } = data;
    const metadata = loadLibraryMetadata();
    
    const itemIndex = metadata.items.findIndex((item) => item.id === id);
    if (itemIndex === -1) {
      return { success: false, error: 'Item not found' };
    }
    
    const item = metadata.items[itemIndex];
    
    // Delete file if requested
    if (deleteFile && fs.existsSync(item.libraryPath)) {
      try {
        fs.unlinkSync(item.libraryPath);
        console.log('[MediaLibrary] Deleted file:', item.libraryPath);
        
        // Also delete thumbnail if exists
        if (item.thumbnailPath && fs.existsSync(item.thumbnailPath)) {
          fs.unlinkSync(item.thumbnailPath);
        }
      } catch (err) {
        console.error('[MediaLibrary] Failed to delete file:', err);
      }
    }
    
    // Remove from metadata
    metadata.items.splice(itemIndex, 1);
    saveLibraryMetadata(metadata);
    
    return { success: true };
  } catch (err) {
    console.error('[MediaLibrary] Remove failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

// Open library folder in file explorer
ipcMain.handle('media-library-open-folder', async (_event, subfolder?: string) => {
  try {
    const libraryPath = getMediaLibraryPath();
    const targetPath = subfolder 
      ? path.join(libraryPath, subfolder)
      : libraryPath;
    
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    
    await shell.openPath(targetPath);
    return { success: true };
  } catch (err) {
    console.error('[MediaLibrary] Failed to open folder:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

// Get library statistics
ipcMain.handle('media-library-get-stats', async () => {
  try {
    const metadata = loadLibraryMetadata();
    const libraryPath = getMediaLibraryPath();
    
    // Count by type
    const countByType = {
      video: 0,
      audio: 0,
      broll: 0,
      music: 0,
      sfx: 0,
    };
    
    let totalSize = 0;
    
    for (const item of metadata.items) {
      countByType[item.type]++;
      totalSize += item.size;
    }
    
    return {
      success: true,
      stats: {
        totalItems: metadata.items.length,
        totalSize,
        countByType,
        libraryPath,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
      },
    };
  } catch (err) {
    console.error('[MediaLibrary] Failed to get stats:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

// Search library
ipcMain.handle('media-library-search', async (_event, data: {
  query: string;
  type?: 'video' | 'audio' | 'broll' | 'music' | 'sfx';
}) => {
  try {
    const { query, type } = data;
    const metadata = loadLibraryMetadata();
    
    const lowerQuery = query.toLowerCase();
    
    let results = metadata.items.filter((item) => {
      const matchesName = item.name.toLowerCase().includes(lowerQuery);
      const matchesTags = item.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery));
      return matchesName || matchesTags;
    });
    
    if (type) {
      results = results.filter((item) => item.type === type);
    }
    
    return {
      success: true,
      items: results,
    };
  } catch (err) {
    console.error('[MediaLibrary] Search failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      items: [],
    };
  }
});

// Add tags to item
ipcMain.handle('media-library-add-tags', async (_event, data: {
  id: string;
  tags: string[];
}) => {
  try {
    const { id, tags } = data;
    const metadata = loadLibraryMetadata();
    
    const item = metadata.items.find((item) => item.id === id);
    if (!item) {
      return { success: false, error: 'Item not found' };
    }
    
    // Merge tags, avoiding duplicates
    const existingTags = item.tags || [];
    const newTags = [...new Set([...existingTags, ...tags])];
    item.tags = newTags;
    
    saveLibraryMetadata(metadata);
    
    return { success: true, tags: newTags };
  } catch (err) {
    console.error('[MediaLibrary] Add tags failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

console.log('[MediaLibrary] Media library handlers registered successfully');
