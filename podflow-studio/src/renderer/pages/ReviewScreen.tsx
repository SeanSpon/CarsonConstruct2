/**
 * Screen 3: Review
 * User reviews and selects clips to export
 * 
 * Rule #2: 3 SCREENS ONLY
 * This screen is the final decision point before export
 */

import React from 'react';
import type { FC } from 'react';
import type { Clip } from '../types';

interface ReviewScreenProps {
  clips?: Clip[];
  onExport?: () => void;
}

export const ReviewScreen: FC<ReviewScreenProps> = ({ clips, onExport }) => {
  return (
    <div className="review-screen">
      <h1>Review Clips</h1>
      {clips && <p>Found {clips.length} clips</p>}
      {/* Components will be added here */}
    </div>
  );
};
