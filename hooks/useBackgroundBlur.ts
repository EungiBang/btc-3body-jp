import React, { useEffect, useRef, useState } from 'react';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

// Global instance to prevent rapid create/dispose crashes
let globalSegmenter: bodySegmentation.BodySegmenter | null = null;
let isGlobalSegmenterLoading = false;
let globalSegmenterPromise: Promise<bodySegmentation.BodySegmenter> | null = null;

export const useBackgroundBlur = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isActive: boolean
) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(!!globalSegmenter);

  useEffect(() => {
    let isMounted = true;

    const initModel = async () => {
      if (globalSegmenter) {
        if (isMounted) setIsModelLoaded(true);
        return;
      }

      if (isGlobalSegmenterLoading && globalSegmenterPromise) {
        try {
          await globalSegmenterPromise;
          if (isMounted) setIsModelLoaded(true);
        } catch (e) {
          console.error("Failed to wait for global segmenter:", e);
        }
        return;
      }

      isGlobalSegmenterLoading = true;
      globalSegmenterPromise = (async () => {
        await tf.ready();
        const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
        const segmenterConfig = {
          runtime: 'tfjs',
          modelType: 'general',
        } as any;
        const segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
        globalSegmenter = segmenter;
        return segmenter;
      })();

      try {
        await globalSegmenterPromise;
        if (isMounted) setIsModelLoaded(true);
      } catch (e) {
        console.error("Body segmentation init error:", e);
      } finally {
        isGlobalSegmenterLoading = false;
      }
    };

    initModel();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isActive || !isModelLoaded) {
      // Clear any pending timeout when deactivated
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    let isMounted = true;
    // Adaptive interval: starts at 500ms (~2fps), adjusts based on device performance
    let adaptiveInterval = 500;
    const MIN_INTERVAL = 300;
    const MAX_INTERVAL = 2000;

    const processVideo = async () => {
      if (!videoRef.current || !canvasRef.current || !globalSegmenter || !isMounted) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState < 2) {
        if (isMounted) timeoutRef.current = setTimeout(processVideo, adaptiveInterval);
        return;
      }

      try {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const startTime = performance.now();

        const segmentation = await globalSegmenter.segmentPeople(video);

        if (!isMounted) return;

        // Yield to main thread between heavy operations
        // This lets timers, UI updates, and user input process
        await new Promise(r => setTimeout(r, 0));

        if (!isMounted) return;

        await bodySegmentation.drawBokehEffect(
          canvas,
          video,
          segmentation,
          0.5,  // foregroundThreshold
          10,   // backgroundBlurAmount
          3,    // edgeBlurAmount
          false // flipHorizontal
        );

        const processingTime = performance.now() - startTime;

        // Adaptive throttling: slow devices get longer intervals
        if (processingTime > 400) {
          adaptiveInterval = Math.min(adaptiveInterval + 200, MAX_INTERVAL);
        } else if (processingTime < 200 && adaptiveInterval > MIN_INTERVAL) {
          adaptiveInterval = Math.max(adaptiveInterval - 50, MIN_INTERVAL);
        }
      } catch (e) {
        console.error("Bokeh effect error:", e);
      }

      // Schedule next frame with setTimeout (non-greedy, unlike requestAnimationFrame)
      // This ensures the main thread has breathing room between blur frames
      if (isMounted) {
        timeoutRef.current = setTimeout(processVideo, adaptiveInterval);
      }
    };

    // Start first frame with a short delay
    timeoutRef.current = setTimeout(processVideo, 100);

    return () => {
      isMounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isActive, isModelLoaded, videoRef, canvasRef]);

  return { isReady: isModelLoaded };
};
