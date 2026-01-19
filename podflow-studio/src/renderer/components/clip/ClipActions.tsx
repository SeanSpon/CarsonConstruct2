import { memo } from 'react';
import { Check, X, Play } from 'lucide-react';
import type { Clip } from '../../types';
import { Button, IconButton } from '../ui';

export interface ClipActionsProps {
  clip: Clip;
  onAccept: () => void;
  onReject: () => void;
  onReview: () => void;
}

function ClipActions({ clip, onAccept, onReject, onReview }: ClipActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onReview}
        leftIcon={<Play className="w-3.5 h-3.5" />}
        className="flex-1"
      >
        Review
      </Button>
      <IconButton
        icon={<Check className="w-4 h-4" />}
        variant={clip.status === 'accepted' ? 'success' : 'default'}
        size="md"
        onClick={onAccept}
        tooltip={clip.status === 'accepted' ? 'Undo accept' : 'Accept clip'}
        isActive={clip.status === 'accepted'}
      />
      <IconButton
        icon={<X className="w-4 h-4" />}
        variant={clip.status === 'rejected' ? 'danger' : 'default'}
        size="md"
        onClick={onReject}
        tooltip={clip.status === 'rejected' ? 'Undo reject' : 'Reject clip'}
        isActive={clip.status === 'rejected'}
      />
    </div>
  );
}

export default memo(ClipActions);
