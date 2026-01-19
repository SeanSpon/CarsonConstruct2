import { memo, useState, useCallback, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  Upload, 
  LogIn,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  FolderOpen,
  FolderPlus,
  File,
  ChevronDown,
} from 'lucide-react';

interface CloudExportProps {
  files: Array<{ path: string; name: string }>;
  onClose: () => void;
  className?: string;
}

interface UploadResult {
  filePath: string;
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

function CloudExport({ files, onClose, className }: CloudExportProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    percentage: number;
    currentFile: number;
    totalFiles: number;
    fileName: string;
  } | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState(`PodFlow Export ${new Date().toLocaleDateString()}`);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [createNewFolder, setCreateNewFolder] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await window.api.checkCloudAuth();
        setIsAuthenticated(result.isAuthenticated);
        setHasCredentials(result.hasCredentials);
      } catch (err) {
        console.error('Failed to check auth:', err);
      }
    };
    checkAuth();
  }, []);

  // Listen for upload progress
  useEffect(() => {
    const handleProgress = (_event: any, progress: any) => {
      setUploadProgress(progress);
    };

    // @ts-ignore
    window.api?.onCloudUploadProgress?.(handleProgress);
    
    return () => {
      // Cleanup listener if possible
    };
  }, []);

  const handleSignIn = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    
    try {
      const result = await window.api.startCloudAuth();
      if (result.success) {
        setIsAuthenticated(true);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await window.api.signOutCloud();
      setIsAuthenticated(false);
      setUploadResults([]);
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(null);
    setUploadResults([]);
    
    try {
      const filesToUpload = files.map(f => ({
        filePath: f.path,
        fileName: f.name,
      }));
      
      const result = await window.api.uploadToCloud({
        files: filesToUpload,
        folderName: createNewFolder ? folderName : undefined,
      });
      
      setUploadResults(result.results || []);
      
      if (!result.success) {
        setError(`${result.totalFiles - result.successCount} of ${result.totalFiles} uploads failed`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [files, folderName, createNewFolder]);

  const handleCopyLink = useCallback(async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const handleOpenLink = useCallback((link: string) => {
    window.open(link, '_blank');
  }, []);

  const successfulUploads = uploadResults.filter(r => r.success);
  const failedUploads = uploadResults.filter(r => !r.success);

  return (
    <div className={`flex flex-col bg-sz-bg-secondary rounded-xl border border-sz-border max-w-lg ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sz-border">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-sz-accent" />
          <h3 className="font-medium text-sz-text">Export to Google Drive</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text transition-colors"
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Auth status */}
        {!hasCredentials ? (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-200 font-medium">Google Drive not configured</p>
              <p className="text-xs text-amber-400/80 mt-1">
                Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables to enable cloud upload.
              </p>
            </div>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-sz-bg-tertiary flex items-center justify-center mb-4">
              <CloudOff className="w-8 h-8 text-sz-text-muted" />
            </div>
            <p className="text-sz-text mb-1">Connect to Google Drive</p>
            <p className="text-sm text-sz-text-secondary mb-4">
              Sign in to upload your exports to the cloud
            </p>
            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sz-accent text-white hover:bg-sz-accent-hover disabled:opacity-50 transition-colors"
            >
              {isAuthenticating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isAuthenticating ? 'Connecting...' : 'Sign in with Google'}
            </button>
          </div>
        ) : (
          <>
            {/* Authenticated view */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-sm text-sz-text">Connected to Google Drive</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-tertiary transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </div>

            {/* Folder destination */}
            {uploadResults.length === 0 && (
              <div className="space-y-3">
                {/* Folder selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-sz-text-muted flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5" />
                      Destination folder
                    </label>
                    <button
                      onClick={() => setShowFolderInput(!showFolderInput)}
                      className="text-xs text-sz-accent hover:text-sz-accent-hover transition-colors"
                    >
                      {showFolderInput ? 'Hide options' : 'Change'}
                    </button>
                  </div>
                  
                  {showFolderInput ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={createNewFolder}
                            onChange={() => setCreateNewFolder(true)}
                            className="accent-sz-accent"
                          />
                          <span className="text-sm text-sz-text">Create new folder</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={!createNewFolder}
                            onChange={() => setCreateNewFolder(false)}
                            className="accent-sz-accent"
                          />
                          <span className="text-sm text-sz-text">My Drive root</span>
                        </label>
                      </div>
                      
                      {createNewFolder && (
                        <div className="flex items-center gap-2">
                          <FolderPlus className="w-4 h-4 text-sz-text-secondary flex-shrink-0" />
                          <input
                            type="text"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            placeholder="Folder name"
                            className="flex-1 px-3 py-2 rounded-lg bg-sz-bg-tertiary border border-sz-border text-sz-text text-sm focus:outline-none focus:border-sz-accent"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-sz-bg-tertiary">
                      {createNewFolder ? (
                        <>
                          <FolderPlus className="w-4 h-4 text-sz-accent" />
                          <span className="text-sm text-sz-text">{folderName}</span>
                        </>
                      ) : (
                        <>
                          <FolderOpen className="w-4 h-4 text-sz-text-secondary" />
                          <span className="text-sm text-sz-text-secondary">My Drive (root)</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Files to upload */}
                <div className="space-y-2">
                  <p className="text-xs text-sz-text-muted">
                    {files.length} file{files.length !== 1 ? 's' : ''} ready to upload
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded bg-sz-bg-tertiary text-sm"
                      >
                        <File className="w-4 h-4 text-sz-text-secondary" />
                        <span className="flex-1 truncate text-sz-text">{file.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Upload progress */}
            {isUploading && uploadProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-sz-text-secondary">
                    Uploading {uploadProgress.currentFile}/{uploadProgress.totalFiles}
                  </span>
                  <span className="text-sz-text">{uploadProgress.percentage}%</span>
                </div>
                <div className="h-2 bg-sz-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sz-accent transition-all"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-sz-text-muted truncate">
                  {uploadProgress.fileName}
                </p>
              </div>
            )}

            {/* Upload results */}
            {uploadResults.length > 0 && (
              <div className="space-y-3">
                {successfulUploads.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-emerald-400">
                      ✓ {successfulUploads.length} uploaded successfully
                    </p>
                    <div className="space-y-1">
                      {successfulUploads.map((result, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30"
                        >
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span className="flex-1 text-sm text-sz-text truncate">
                            {result.filePath.split(/[\\/]/).pop()}
                          </span>
                          {result.webViewLink && (
                            <>
                              <button
                                onClick={() => handleCopyLink(result.webViewLink!)}
                                className="p-1 rounded hover:bg-sz-bg-tertiary transition-colors"
                                title="Copy link"
                              >
                                {copiedLink === result.webViewLink ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-sz-text-secondary" />
                                )}
                              </button>
                              <button
                                onClick={() => handleOpenLink(result.webViewLink!)}
                                className="p-1 rounded hover:bg-sz-bg-tertiary transition-colors"
                                title="Open in Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-sz-text-secondary" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {failedUploads.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-red-400">
                      ✗ {failedUploads.length} failed
                    </p>
                    <div className="space-y-1">
                      {failedUploads.map((result, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-sm"
                        >
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <span className="flex-1 text-sz-text truncate">
                            {result.filePath.split(/[\\/]/).pop()}
                          </span>
                          <span className="text-xs text-red-400">{result.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upload button */}
            {uploadResults.length === 0 && (
              <button
                onClick={handleUpload}
                disabled={isUploading || files.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-sz-accent text-white hover:bg-sz-accent-hover disabled:opacity-50 transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CloudExport);
