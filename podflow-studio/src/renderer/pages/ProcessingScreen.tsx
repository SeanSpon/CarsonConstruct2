/**
 * Screen 2: Processing
 * System analyzes the video and generates clips
 * 
 * Rule #2: 3 SCREENS ONLY
 * This screen shows progress during pipeline execution
 */

import React from 'react';
import type { FC } from 'react';
import type { ProcessingStage } from '../types';

interface ProcessingScreenProps {
  stage?: ProcessingStage;
  progress?: number;
}

export const ProcessingScreen: FC<ProcessingScreenProps> = ({ stage, progress }) => {
  return (
    <div className="processing-screen">
      <h1>Processing</h1>
      {stage && <p>Stage: {stage}</p>}
      {progress && <p>Progress: {progress}%</p>}
      {/* Components will be added here */}
    </div>
  );
};
