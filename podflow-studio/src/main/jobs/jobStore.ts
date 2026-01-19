import fs from 'fs';
import path from 'path';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled';

export interface JobStep {
  name: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
  message?: string;
  updatedAt: number;
}

export interface JobRecord {
  id: string;
  inputPath: string;
  inputHash: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  steps: JobStep[];
  costEstimate?: {
    whisperCost: number;
    gptCost: number;
    total: number;
  };
  error?: string;
  outputs?: {
    cacheDir?: string;
    detectionsCache?: string;
    transcriptCache?: string;
    aiCache?: string;
  };
}

export class JobStore {
  private jobs = new Map<string, JobRecord>();
  private filePath: string;

  constructor(baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
    this.filePath = path.join(baseDir, 'jobs.json');
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) {
      return;
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as JobRecord[];
      parsed.forEach((job) => this.jobs.set(job.id, job));
    } catch {
      // If jobs.json is malformed, ignore and start fresh.
      this.jobs.clear();
    }
  }

  private save() {
    const payload = Array.from(this.jobs.values());
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2));
  }

  create(job: JobRecord) {
    this.jobs.set(job.id, job);
    this.save();
    return job;
  }

  update(jobId: string, patch: Partial<JobRecord>) {
    const existing = this.jobs.get(jobId);
    if (!existing) return;
    const updated: JobRecord = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    this.jobs.set(jobId, updated);
    this.save();
  }

  updateStep(jobId: string, stepName: string, patch: Partial<JobStep>) {
    const existing = this.jobs.get(jobId);
    if (!existing) return;
    const steps = existing.steps.map((step) =>
      step.name === stepName
        ? { ...step, ...patch, updatedAt: Date.now() }
        : step
    );
    this.update(jobId, { steps });
  }

  get(jobId: string) {
    return this.jobs.get(jobId);
  }
}
