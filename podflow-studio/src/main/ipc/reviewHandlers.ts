import { ipcMain, app } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const getProjectsDir = () => path.join(app.getPath('userData'), 'projects');

ipcMain.handle('save-clip-project', async (_event, data: {
  jobId: string;
  clipId: string;
  payload: unknown;
}) => {
  try {
    const dir = path.join(getProjectsDir(), data.jobId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${data.clipId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data.payload, null, 2));
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('load-clip-project', async (_event, data: { jobId: string; clipId: string }) => {
  try {
    const filePath = path.join(getProjectsDir(), data.jobId, `${data.clipId}.json`);
    if (!fs.existsSync(filePath)) {
      return { success: true, payload: null };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const payload = JSON.parse(raw);
    return { success: true, payload };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// NOTE: QA checks are handled in qaHandlers.ts - do not duplicate here
