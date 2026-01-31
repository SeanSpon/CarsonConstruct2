export type NormalizedRect = {
  /** Normalized left offset in [0,1]. */
  x: number;
  /** Normalized top offset in [0,1]. */
  y: number;
  /** Normalized width in (0,1]. */
  w: number;
  /** Normalized height in (0,1]. */
  h: number;
};

export type FramingModel = {
  /** Output aspect ratio (width/height), e.g. 9/16 for vertical. */
  aspect: number;
  /** Intended export width in pixels (used for preview+export geometry alignment). */
  width: number;
  /** Intended export height in pixels (used for preview+export geometry alignment). */
  height: number;
  /** Crop rectangle, normalized to the *source* frame. */
  crop: NormalizedRect;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampPositive01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1e-6, Math.min(1, value));
}

export function clampFramingModel(model: FramingModel): FramingModel {
  const w = clampPositive01(model.crop.w);
  const h = clampPositive01(model.crop.h);
  const x = clamp01(model.crop.x);
  const y = clamp01(model.crop.y);

  const safeX = Math.min(x, 1 - w);
  const safeY = Math.min(y, 1 - h);

  return {
    ...model,
    aspect: Number.isFinite(model.aspect) && model.aspect > 0 ? model.aspect : model.width / model.height,
    width: Math.max(1, Math.round(model.width || 1)),
    height: Math.max(1, Math.round(model.height || 1)),
    crop: {
      x: safeX,
      y: safeY,
      w,
      h,
    },
  };
}

/**
 * Center-crop a source frame to a target aspect ratio.
 * Returns a normalized crop rect (relative to the source frame).
 */
export function createCenterCropRect(
  inputWidth: number,
  inputHeight: number,
  targetAspect: number
): NormalizedRect {
  if (!Number.isFinite(inputWidth) || !Number.isFinite(inputHeight) || inputWidth <= 0 || inputHeight <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  const inputAspect = inputWidth / inputHeight;

  // If input is wider than target, crop horizontally; else crop vertically.
  if (inputAspect > targetAspect) {
    const cropWidthPx = inputHeight * targetAspect;
    const xPx = (inputWidth - cropWidthPx) / 2;
    return {
      x: clamp01(xPx / inputWidth),
      y: 0,
      w: clampPositive01(cropWidthPx / inputWidth),
      h: 1,
    };
  }

  const cropHeightPx = inputWidth / targetAspect;
  const yPx = (inputHeight - cropHeightPx) / 2;
  return {
    x: 0,
    y: clamp01(yPx / inputHeight),
    w: 1,
    h: clampPositive01(cropHeightPx / inputHeight),
  };
}

export function createCenterCropFramingModel(params: {
  inputWidth: number;
  inputHeight: number;
  targetWidth: number;
  targetHeight: number;
}): FramingModel {
  const aspect = params.targetWidth / params.targetHeight;
  const crop = createCenterCropRect(params.inputWidth, params.inputHeight, aspect);
  return clampFramingModel({
    aspect,
    width: params.targetWidth,
    height: params.targetHeight,
    crop,
  });
}

export function framingToFfmpegCropScaleFilter(
  inputWidth: number,
  inputHeight: number,
  model: FramingModel
): string {
  const safe = clampFramingModel(model);

  const cropW = Math.max(1, Math.round(inputWidth * safe.crop.w));
  const cropH = Math.max(1, Math.round(inputHeight * safe.crop.h));
  const cropX = Math.max(0, Math.round(inputWidth * safe.crop.x));
  const cropY = Math.max(0, Math.round(inputHeight * safe.crop.y));

  // Ensure we don't request a crop outside bounds after rounding.
  const boundedW = Math.min(cropW, Math.max(1, inputWidth - cropX));
  const boundedH = Math.min(cropH, Math.max(1, inputHeight - cropY));

  return `crop=${boundedW}:${boundedH}:${cropX}:${cropY},scale=${safe.width}:${safe.height}`;
}

export function framingToCssTransform(model: FramingModel): string {
  const safe = clampFramingModel(model);
  // Translate first (in element %), then scale up so the crop rect fills the viewport.
  const tx = -(safe.crop.x * 100);
  const ty = -(safe.crop.y * 100);
  const sx = 1 / safe.crop.w;
  const sy = 1 / safe.crop.h;
  return `translate(${tx}%, ${ty}%) scale(${sx}, ${sy})`;
}

/**
 * Convert a crop rect into a CSS `object-position` string.
 *
 * This matches the common “cover + focal point” framing model. It is exact for
 * center-crop style reframes where the crop size is dictated by the viewport aspect.
 */
export function framingToCssObjectPosition(model: FramingModel): string {
  const safe = clampFramingModel(model);
  const centerX = clamp01(safe.crop.x + safe.crop.w / 2);
  const centerY = clamp01(safe.crop.y + safe.crop.h / 2);
  return `${(centerX * 100).toFixed(4)}% ${(centerY * 100).toFixed(4)}%`;
}

// ============================================
// Speaker-Oriented Framing
// ============================================

/**
 * Speaker position on the horizontal axis.
 * 'left' = speaker is on left third of frame
 * 'center' = speaker is centered (or unknown)
 * 'right' = speaker is on right third of frame
 */
export type SpeakerPosition = 'left' | 'center' | 'right';

/**
 * Mapping from speaker ID to their position in the frame.
 */
export type SpeakerPositionMap = Record<string, SpeakerPosition>;

/**
 * A framing keyframe: at a given time, use a specific framing.
 */
export interface FramingKeyframe {
  /** Time in seconds (relative to clip start or absolute) */
  time: number;
  /** The framing to use at this time */
  framing: FramingModel;
  /** Speaker ID active at this keyframe (for debugging/display) */
  speakerId?: string;
}

/**
 * Create a crop rect biased towards a speaker position.
 * For vertical (9:16) exports from landscape (16:9) source, this shifts
 * the crop window left/right to follow the speaker.
 */
export function createSpeakerOrientedCropRect(
  inputWidth: number,
  inputHeight: number,
  targetAspect: number,
  speakerPosition: SpeakerPosition
): NormalizedRect {
  if (!Number.isFinite(inputWidth) || !Number.isFinite(inputHeight) || inputWidth <= 0 || inputHeight <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  const inputAspect = inputWidth / inputHeight;

  // Only apply horizontal bias when input is wider than target (typical case: 16:9 → 9:16)
  if (inputAspect > targetAspect) {
    const cropWidthPx = inputHeight * targetAspect;
    const cropWidthNorm = clampPositive01(cropWidthPx / inputWidth);
    const maxX = 1 - cropWidthNorm;

    let x: number;
    switch (speakerPosition) {
      case 'left':
        // Position crop to show left third of frame
        x = maxX * 0.15;
        break;
      case 'right':
        // Position crop to show right third of frame
        x = maxX * 0.85;
        break;
      case 'center':
      default:
        // Center crop
        x = maxX * 0.5;
        break;
    }

    return {
      x: clamp01(x),
      y: 0,
      w: cropWidthNorm,
      h: 1,
    };
  }

  // Vertical or square input: standard center crop
  const cropHeightPx = inputWidth / targetAspect;
  const yPx = (inputHeight - cropHeightPx) / 2;
  return {
    x: 0,
    y: clamp01(yPx / inputHeight),
    w: 1,
    h: clampPositive01(cropHeightPx / inputHeight),
  };
}

/**
 * Create a crop rect centered on an exact face position.
 * Unlike createSpeakerOrientedCropRect which uses categorical left/center/right,
 * this uses the precise face center X position (0-1) for accurate centering.
 */
export function createFaceCenteredCropRect(
  inputWidth: number,
  inputHeight: number,
  targetAspect: number,
  faceCenterX: number  // 0-1, where the face center is horizontally
): NormalizedRect {
  if (!Number.isFinite(inputWidth) || !Number.isFinite(inputHeight) || inputWidth <= 0 || inputHeight <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  const inputAspect = inputWidth / inputHeight;

  // Only apply horizontal centering when input is wider than target (typical case: 16:9 → 9:16)
  if (inputAspect > targetAspect) {
    const cropWidthPx = inputHeight * targetAspect;
    const cropWidthNorm = clampPositive01(cropWidthPx / inputWidth);
    const halfCropWidth = cropWidthNorm / 2;
    
    // Calculate x position to center the crop window on the face
    // faceCenterX is where the face is (0-1), we want the crop centered there
    let x = faceCenterX - halfCropWidth;
    
    // Clamp to valid range [0, 1-cropWidth]
    const maxX = 1 - cropWidthNorm;
    x = Math.max(0, Math.min(maxX, x));

    return {
      x: clamp01(x),
      y: 0,
      w: cropWidthNorm,
      h: 1,
    };
  }

  // Vertical or square input: standard center crop
  const cropHeightPx = inputWidth / targetAspect;
  const yPx = (inputHeight - cropHeightPx) / 2;
  return {
    x: 0,
    y: clamp01(yPx / inputHeight),
    w: 1,
    h: clampPositive01(cropHeightPx / inputHeight),
  };
}

/**
 * Create a face-centered framing model using exact face position.
 */
export function createFaceCenteredFramingModel(params: {
  inputWidth: number;
  inputHeight: number;
  targetWidth: number;
  targetHeight: number;
  faceCenterX: number;  // 0-1, exact face center position
}): FramingModel {
  const aspect = params.targetWidth / params.targetHeight;
  const crop = createFaceCenteredCropRect(
    params.inputWidth,
    params.inputHeight,
    aspect,
    params.faceCenterX
  );
  return clampFramingModel({
    aspect,
    width: params.targetWidth,
    height: params.targetHeight,
    crop,
  });
}

/**
 * Create a speaker-oriented framing model.
 */
export function createSpeakerOrientedFramingModel(params: {
  inputWidth: number;
  inputHeight: number;
  targetWidth: number;
  targetHeight: number;
  speakerPosition: SpeakerPosition;
}): FramingModel {
  const aspect = params.targetWidth / params.targetHeight;
  const crop = createSpeakerOrientedCropRect(
    params.inputWidth,
    params.inputHeight,
    aspect,
    params.speakerPosition
  );
  return clampFramingModel({
    aspect,
    width: params.targetWidth,
    height: params.targetHeight,
    crop,
  });
}

/**
 * Linearly interpolate between two framing models.
 * Used for smooth transitions between speaker positions.
 */
export function lerpFraming(a: FramingModel, b: FramingModel, t: number): FramingModel {
  const clampedT = clamp01(t);
  return clampFramingModel({
    aspect: a.aspect + (b.aspect - a.aspect) * clampedT,
    width: Math.round(a.width + (b.width - a.width) * clampedT),
    height: Math.round(a.height + (b.height - a.height) * clampedT),
    crop: {
      x: a.crop.x + (b.crop.x - a.crop.x) * clampedT,
      y: a.crop.y + (b.crop.y - a.crop.y) * clampedT,
      w: a.crop.w + (b.crop.w - a.crop.w) * clampedT,
      h: a.crop.h + (b.crop.h - a.crop.h) * clampedT,
    },
  });
}

/**
 * Get the interpolated framing at a given time from a list of keyframes.
 * Uses smooth interpolation between keyframes for natural camera motion.
 * 
 * @param keyframes - Sorted array of framing keyframes
 * @param time - Current time (same reference as keyframe times)
 * @param transitionDuration - How long to interpolate between keyframes (default 0.3s)
 */
export function getFramingAtTime(
  keyframes: FramingKeyframe[],
  time: number,
  transitionDuration = 0.3
): FramingModel | null {
  if (!keyframes || keyframes.length === 0) return null;

  // Single keyframe: always use it
  if (keyframes.length === 1) {
    return keyframes[0].framing;
  }

  // Find the keyframe before and after current time
  let prevKeyframe: FramingKeyframe | null = null;
  let nextKeyframe: FramingKeyframe | null = null;

  for (let i = 0; i < keyframes.length; i++) {
    if (keyframes[i].time <= time) {
      prevKeyframe = keyframes[i];
    }
    if (keyframes[i].time > time && nextKeyframe === null) {
      nextKeyframe = keyframes[i];
      break;
    }
  }

  // Before first keyframe: use first
  if (!prevKeyframe) {
    return keyframes[0].framing;
  }

  // After last keyframe or no next: use previous
  if (!nextKeyframe) {
    return prevKeyframe.framing;
  }

  // Within transition window: interpolate
  const timeSincePrev = time - prevKeyframe.time;
  if (timeSincePrev < transitionDuration) {
    const t = timeSincePrev / transitionDuration;
    // Ease-out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - t, 3);
    return lerpFraming(prevKeyframe.framing, prevKeyframe.framing, eased);
  }

  // Check if we're approaching the next keyframe
  const timeToNext = nextKeyframe.time - time;
  if (timeToNext < transitionDuration) {
    const t = 1 - (timeToNext / transitionDuration);
    // Ease-in-out for smooth acceleration/deceleration
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return lerpFraming(prevKeyframe.framing, nextKeyframe.framing, eased);
  }

  // Between transitions: hold at previous framing
  return prevKeyframe.framing;
}

/**
 * Generate framing keyframes from speaker segments.
 * Groups consecutive segments from the same speaker to avoid jitter.
 */
export function generateSpeakerKeyframes(
  speakerSegments: Array<{
    speakerId: string;
    startTime: number;
    endTime: number;
  }>,
  speakerPositions: SpeakerPositionMap,
  inputWidth: number,
  inputHeight: number,
  targetWidth: number,
  targetHeight: number,
  clipStartTime = 0,
  clipEndTime?: number,
  minSegmentGap = 0.5
): FramingKeyframe[] {
  if (!speakerSegments || speakerSegments.length === 0) {
    return [];
  }

  // Filter segments to clip range and sort by start time
  const relevantSegments = speakerSegments
    .filter(seg => {
      const segEnd = seg.endTime;
      const segStart = seg.startTime;
      if (clipEndTime !== undefined) {
        return segEnd > clipStartTime && segStart < clipEndTime;
      }
      return segEnd > clipStartTime;
    })
    .sort((a, b) => a.startTime - b.startTime);

  if (relevantSegments.length === 0) {
    return [];
  }

  // Merge consecutive segments from same speaker (with small gaps)
  const mergedSegments: Array<{
    speakerId: string;
    startTime: number;
    endTime: number;
  }> = [];

  for (const seg of relevantSegments) {
    const last = mergedSegments[mergedSegments.length - 1];
    if (last && last.speakerId === seg.speakerId && (seg.startTime - last.endTime) < minSegmentGap) {
      // Extend the previous segment
      last.endTime = seg.endTime;
    } else {
      mergedSegments.push({ ...seg });
    }
  }

  // Generate keyframes from merged segments
  const keyframes: FramingKeyframe[] = [];
  let lastSpeakerId: string | null = null;

  for (const seg of mergedSegments) {
    // Skip if same speaker as last keyframe (no need to re-orient)
    if (seg.speakerId === lastSpeakerId) continue;

    const position = speakerPositions[seg.speakerId] || 'center';
    const framing = createSpeakerOrientedFramingModel({
      inputWidth,
      inputHeight,
      targetWidth,
      targetHeight,
      speakerPosition: position,
    });

    keyframes.push({
      time: seg.startTime,
      framing,
      speakerId: seg.speakerId,
    });

    lastSpeakerId = seg.speakerId;
  }

  return keyframes;
}

/**
 * Default speaker position assignment based on speaker count and ID.
 * Assigns alternating left/right positions for 2-speaker podcasts.
 */
export function assignDefaultSpeakerPositions(
  speakerIds: string[]
): SpeakerPositionMap {
  const positions: SpeakerPositionMap = {};
  
  if (speakerIds.length === 0) return positions;
  
  if (speakerIds.length === 1) {
    positions[speakerIds[0]] = 'center';
    return positions;
  }

  // Sort speaker IDs for consistent assignment
  const sorted = [...speakerIds].sort();
  
  if (speakerIds.length === 2) {
    // Two speakers: left and right
    positions[sorted[0]] = 'left';
    positions[sorted[1]] = 'right';
  } else {
    // 3+ speakers: alternate, with overflow to center
    sorted.forEach((id, idx) => {
      if (idx === 0) positions[id] = 'left';
      else if (idx === 1) positions[id] = 'right';
      else positions[id] = 'center';
    });
  }

  return positions;
}
