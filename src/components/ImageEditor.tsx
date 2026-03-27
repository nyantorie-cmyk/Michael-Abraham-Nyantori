import React, { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, RotateCcw, ZoomIn, ZoomOut, Move } from 'lucide-react';
import getCroppedImg from '../utils/imageUtils';

interface ImageEditorProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
  aspect?: number;
}

export function ImageEditor({ image, onCropComplete, onCancel, aspect = 1 }: ImageEditorProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onRotationChange = (rotation: number) => {
    setRotation(rotation);
  };

  const onCropCompleteInternal = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      if (croppedAreaPixels) {
        const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
        if (croppedImage) {
          onCropComplete(croppedImage);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-wine-black/90 backdrop-blur-md p-4 sm:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-4xl bg-wine-cream rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[85vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-wine-black/5 flex items-center justify-between bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
              <Move className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-wine-black">Edit Image</h3>
              <p className="text-[10px] text-wine-black/40 uppercase font-bold tracking-widest">Crop & Reposition</p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-wine-black/5 rounded-full transition-colors text-wine-black/40 hover:text-wine-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative flex-1 bg-wine-black/5">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
            onRotationChange={onRotationChange}
            classes={{
              containerClassName: 'bg-wine-black/5',
              mediaClassName: 'max-w-none',
            }}
          />
        </div>

        {/* Controls */}
        <div className="p-8 bg-white border-t border-wine-black/5 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Zoom Control */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 flex items-center gap-2">
                  <ZoomIn className="w-3 h-3" /> Zoom
                </label>
                <span className="text-[10px] font-mono text-wine-red font-bold">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setZoom(Math.max(1, zoom - 0.1))} className="p-2 text-wine-black/40 hover:text-wine-red transition-colors">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => onZoomChange(Number(e.target.value))}
                  className="flex-1 accent-wine-red h-1 bg-wine-black/5 rounded-full appearance-none cursor-pointer"
                />
                <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} className="p-2 text-wine-black/40 hover:text-wine-red transition-colors">
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rotation Control */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 flex items-center gap-2">
                  <RotateCcw className="w-3 h-3" /> Rotation
                </label>
                <span className="text-[10px] font-mono text-wine-red font-bold">{rotation}°</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setRotation((rotation - 90 + 360) % 360)} className="p-2 text-wine-black/40 hover:text-wine-red transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  value={rotation}
                  min={0}
                  max={360}
                  step={1}
                  aria-labelledby="Rotation"
                  onChange={(e) => onRotationChange(Number(e.target.value))}
                  className="flex-1 accent-wine-red h-1 bg-wine-black/5 rounded-full appearance-none cursor-pointer"
                />
                <button onClick={() => setRotation((rotation + 90) % 360)} className="p-2 text-wine-black/40 hover:text-wine-red transition-colors">
                  <RotateCcw className="w-4 h-4 scale-x-[-1]" />
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-wine-black/5">
            <button
              onClick={onCancel}
              className="px-6 py-3 rounded-2xl text-sm font-bold text-wine-black/40 hover:text-wine-black transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-wine-black text-white px-8 py-3 rounded-2xl font-bold text-sm hover:bg-wine-red transition-all flex items-center gap-2 shadow-lg shadow-wine-black/10"
            >
              <Check className="w-4 h-4" /> Apply Changes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
