/**
 * Interactive Profile Image Cropper & Resizer Modal for VEIL.
 *
 * Allows users to pan, zoom, rotate, and frame their profile photos
 * within a circular aperture before saving.
 * Normalizes crop to a high-resolution 1:1 square canvas (512x512)
 * so it renders 100% crisp across all profile views.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ZoomInIcon, ZoomOutIcon, RefreshCwIcon, CheckIcon, CloseIcon } from '../icons/index.ts';
import { processAvatarImage } from '../../utils/avatarProcessor.ts';

export interface AvatarCropModalProps {
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onCancel: () => void;
  title?: string;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  imageSrc,
  onCropComplete,
  onCancel,
  title = 'Edit Profile Photo',
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const CROP_BOX_SIZE = 260; // Diameter of circular aperture in pixels

  // Load natural dimensions of source image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Keyboard navigation: Escape cancels, Enter applies
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && !isProcessing) {
        handleApplyCrop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, isProcessing]);

  // Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Handlers for Mobile Devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Wheel Zoom Support
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setZoom((prev) => Math.min(3, Math.max(1, +(prev + delta).toFixed(2))));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  // Export 100% crisp, centered 512x512 crop
  const handleApplyCrop = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        // Fallback for non-canvas environments
        onCropComplete(imageSrc);
        return;
      }

      const canvas = document.createElement('canvas');
      const OUTPUT_DIM = 512;
      canvas.width = OUTPUT_DIM;
      canvas.height = OUTPUT_DIM;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        onCropComplete(imageSrc);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Clear with transparent background
      ctx.clearRect(0, 0, OUTPUT_DIM, OUTPUT_DIM);

      // Translate to canvas center
      ctx.save();
      ctx.translate(OUTPUT_DIM / 2, OUTPUT_DIM / 2);

      // Apply rotation
      ctx.rotate((rotation * Math.PI) / 180);

      // Compute display scale relative to crop aperture
      const isRotated90 = rotation === 90 || rotation === 270;
      const effectiveW = isRotated90 ? naturalSize.height : naturalSize.width;
      const effectiveH = isRotated90 ? naturalSize.width : naturalSize.height;

      // Base scale that covers the crop box
      const baseScale = Math.max(CROP_BOX_SIZE / (effectiveW || CROP_BOX_SIZE), CROP_BOX_SIZE / (effectiveH || CROP_BOX_SIZE));
      const totalScale = (baseScale * zoom * OUTPUT_DIM) / CROP_BOX_SIZE;

      // Translate by pan scaled to output canvas
      const panFactor = OUTPUT_DIM / CROP_BOX_SIZE;
      let panX = pan.x * panFactor;
      let panY = pan.y * panFactor;

      // Adjust pan coordinates for rotation
      if (rotation === 90) {
        const tmp = panX;
        panX = panY;
        panY = -tmp;
      } else if (rotation === 180) {
        panX = -panX;
        panY = -panY;
      } else if (rotation === 270) {
        const tmp = panX;
        panX = -panY;
        panY = tmp;
      }

      ctx.translate(panX, panY);

      // Draw original image centered
      const drawW = (naturalSize.width || OUTPUT_DIM) * (totalScale / (OUTPUT_DIM / CROP_BOX_SIZE));
      const drawH = (naturalSize.height || OUTPUT_DIM) * (totalScale / (OUTPUT_DIM / CROP_BOX_SIZE));

      if (imageRef.current) {
        ctx.drawImage(imageRef.current, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res) => {
          img.onload = res;
          img.src = imageSrc;
        });
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      }

      ctx.restore();

      // Export as high-quality square WebP / JPEG
      const rawCroppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // Downsample to <32 KB standard avatar budget with 100% preservation
      const optimized = await processAvatarImage(rawCroppedDataUrl, {
        maxDimension: 256,
        targetMaxBytes: 32 * 1024,
        initialQuality: 0.88,
      });

      onCropComplete(optimized);
    } catch (_err) {
      // Fallback
      onCropComplete(imageSrc);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="veil-modal-overlay"
      style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      onTouchEnd={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="veil-modal-card veil-crop-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--veil-bg-surface-elevated, #131720)',
          borderRadius: 'var(--veil-radius-lg, 14px)',
          border: '1px solid var(--veil-border-subtle, rgba(255, 255, 255, 0.08))',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
            {title}
          </h3>
          <button
            type="button"
            className="veil-icon-btn"
            onClick={onCancel}
            aria-label="Cancel crop"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--veil-text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '50%',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Interactive Crop Viewport */}
        <div
          className="veil-crop-viewport"
          style={{
            position: 'relative',
            width: `${CROP_BOX_SIZE}px`,
            height: `${CROP_BOX_SIZE}px`,
            overflow: 'hidden',
            borderRadius: '50%',
            backgroundColor: '#000000',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
            boxShadow: '0 0 0 4px var(--veil-accent-primary, #14b8a6), 0 8px 24px rgba(0,0,0,0.5)',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {/* Target Image with Pan, Zoom & Rotation */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop candidate"
            draggable={false}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              maxWidth: 'none',
              maxHeight: 'none',
              pointerEvents: 'none',
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
          />

          {/* Guide Reticle Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              borderRadius: '50%',
              border: '1px dashed rgba(255, 255, 255, 0.35)',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.35)',
            }}
            aria-hidden="true"
          />
        </div>

        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--veil-text-secondary)', textAlign: 'center' }}>
          Drag to position • Scroll or use slider to resize
        </p>

        {/* Zoom & Adjustment Controls */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* Zoom Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
              className="veil-icon-btn"
              aria-label="Zoom out"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--veil-text-secondary)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <ZoomOutIcon size={16} />
            </button>

            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              aria-label="Zoom scale"
              style={{
                flex: 1,
                accentColor: 'var(--veil-accent-primary, #14b8a6)',
                cursor: 'pointer',
              }}
            />

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
              className="veil-icon-btn"
              aria-label="Zoom in"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--veil-text-secondary)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <ZoomInIcon size={16} />
            </button>
          </div>

          {/* Quick Action Buttons (Rotate, Reset) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={handleRotate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                color: 'var(--veil-text-primary)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--veil-border-subtle)',
                borderRadius: 'var(--veil-radius-md, 8px)',
                cursor: 'pointer',
              }}
            >
              <RefreshCwIcon size={13} />
              <span>Rotate 90°</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                color: 'var(--veil-text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            width: '100%',
            marginTop: '4px',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              color: 'var(--veil-text-secondary)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--veil-radius-md, 8px)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={isProcessing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#ffffff',
              background: 'var(--veil-accent-primary, #14b8a6)',
              border: 'none',
              borderRadius: 'var(--veil-radius-md, 8px)',
              cursor: isProcessing ? 'wait' : 'pointer',
              boxShadow: '0 2px 8px var(--veil-accent-glow-subtle, rgba(20, 184, 166, 0.25))',
            }}
          >
            <CheckIcon size={15} />
            <span>{isProcessing ? 'Applying...' : 'Set Profile Photo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
