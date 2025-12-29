// hooks/useStreamingAnimation.ts
import { useEffect, useRef, useState } from "react";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { applyFrameToMolstar } from "@/lib/molstarStreaming";
import { ProcessedFrame } from "./useServerTrajectory";

type GetFrameFn = (index: number) => Promise<ProcessedFrame | null>;

const BATCH_SIZE = 1;
const PREFETCH_AHEAD = 1; // Prefetch 1 batch ahead

export const useStreamingAnimation = (
  plugin: PluginContext | null,
  getFrameData: GetFrameFn,
  totalFrames: number,
  modelRef: string | null
) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFrameRef = useRef(1);
  const animationRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const prefetchedRef = useRef<Set<number>>(new Set()); // Track prefetched batches
  const [fps, setFps] = useState<number>(30);
  const fpsRef = useRef(fps);
  // const animationLoop = async () => {
  //   if (!isPlayingRef.current || !plugin || !modelRef) return;

  //   try {
  //     setIsLoading(true);
  //     const frameData = await getFrameData(currentFrameRef.current);

  //     if (frameData) {
  //       // 2. Apply to mol*
  //       await applyFrameToMolstar(plugin, modelRef, frameData);
  //       setCurrentFrame(currentFrameRef.current);
  //     }

  //     setIsLoading(false);
  //     if (currentFrameRef.current < totalFrames - 1) {
  //       currentFrameRef.current++;
  //       animationRef.current = requestAnimationFrame(animationLoop);
  //     } else {
  //       // End of trajectory
  //       setIsPlaying(false);
  //       isPlayingRef.current = false;
  //       currentFrameRef.current = 0;
  //     }
  //   } catch (err) {
  //     console.error("Animation loop error:", err);
  //     setError(err instanceof Error ? err.message : String(err));
  //     setIsLoading(false);
  //     setIsPlaying(false);
  //     isPlayingRef.current = false;
  //   }
  // };

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

  const animationLoop = async () => {
    if (!isPlayingRef.current || !plugin || !modelRef) return;

    try {
      setIsLoading(true);
      const frameData = await getFrameData(currentFrameRef.current);

      if (frameData) {
        await applyFrameToMolstar(plugin, modelRef, frameData);
        setCurrentFrame(currentFrameRef.current);
      }

      setIsLoading(false);
      if (currentFrameRef.current < totalFrames) {
        currentFrameRef.current = (currentFrameRef.current + 1) % totalFrames;
        animationRef.current = setTimeout(
          animationLoop,
          1000 / fpsRef.current
        ) as unknown as number;
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
        currentFrameRef.current = 0;
      }
    } catch (err) {
      console.error("Animation loop error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsLoading(false);
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };

  useEffect(() => {
    isPlayingRef.current = isPlaying;

    if (isPlaying && totalFrames > 0 && plugin && modelRef) {
      animationLoop();
    } else {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, totalFrames, plugin, modelRef, getFrameData]);

  const play = () => {
    if (totalFrames > 0 && modelRef) {
      setIsPlaying(true);
      setError(null);
    }
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const stop = () => {
    setIsPlaying(false);
    currentFrameRef.current = 0;
    setCurrentFrame(0);
  };

  const goToFrame = async (frameIndex: number) => {
    if (frameIndex < 0 || frameIndex >= totalFrames || !plugin || !modelRef)
      return;

    try {
      setIsPlaying(false);
      setIsLoading(true);
      currentFrameRef.current = frameIndex % (totalFrames - 2);
      setCurrentFrame(frameIndex % (totalFrames - 2));

      const frameData = await getFrameData(frameIndex);
      if (frameData) {
        await applyFrameToMolstar(plugin, modelRef, frameData);
      }

      // Reset prefetch tracking when seeking
      prefetchedRef.current.clear();

      setError(null);
    } catch (err) {
      console.error("Error going to frame:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isPlaying,
    currentFrame,
    isLoading,
    fps: fps,
    error,
    play,
    pause,
    stop,
    goToFrame,
    setFps,
  };
};
