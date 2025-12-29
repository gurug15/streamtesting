import { Frame, FrameResponse } from "@/lib/types";
import axios from "axios";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { useState, useCallback, useRef, useEffect } from "react";

const MDSRV_SERVER_URL = "http://localhost:5000";

// export interface TrajectoryEntry {
//   id: string;
//   name: string;
//   description: string;
//   source: string;
//   timestamp: number;
// }

export interface ProcessedFrame {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  count: number;
}

export const useServerTrajectory = (serverUrl = MDSRV_SERVER_URL) => {
  // ============ STATE ============
  const [trajectories, setTrajectories] = useState<string[]>([]);
  const [selectedTrajectory, setSelectedTrajectory] = useState<string | null>(
    null
  );
  const [frameStarts, setFrameStarts] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ CACHE ============
  const frameCache = useRef<Map<number, ProcessedFrame>>(new Map());
  const lastPrefetchFrame = useRef(-1000); // Track last prefetch to throttle requests
  const prefetchedRanges = useRef(new Set<number>()); // Track prefetched ranges to avoid duplicates

  // ============ 1. List Trajectories ============
  const listTrajectories = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios(`${serverUrl}/trajectory/list`);
      console.log("traj list response: ", response.data);
      setTrajectories(response.data || []);
    } catch (err) {
      setError(`Failed to list trajectories: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl]);

  // ============ 2. Select & Get Offsets ============
  const selectTrajectory = useCallback(
    async (entry: string) => {
      try {
        setSelectedTrajectory(entry);
        setIsLoading(true);
        frameCache.current.clear();
        prefetchedRanges.current.clear();
        lastPrefetchFrame.current = -1000;

        const response = await axios(`${serverUrl}/trajectory/${entry}/start`);

        const offsets = response.data;
        // .trim()
        // .split(/[,\s]+/)
        // .map(Number)
        // .filter((n: any) => !isNaN(n));
        console.log("offset of traj: ", offsets);
        setFrameStarts(offsets);
        return offsets;
      } catch (err) {
        setError(`Failed to load offsets: ${err}`);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [serverUrl]
  );

  // ============ HELPER: Frame Conversion ============
  const frameConversion = useCallback((frame: Frame) => {
    const count = frame.count || frame.x.length;

    const processed: ProcessedFrame = {
      x: new Float32Array(count),
      y: new Float32Array(count),
      z: new Float32Array(count),
      count,
    };

    for (let i = 0; i < count; i++) {
      processed.x[i] = frame.x[i] ?? 0;
      processed.y[i] = frame.y[i] ?? 0;
      processed.z[i] = frame.z[i] ?? 0;
    }
    return processed;
  }, []);
  // ============ PREFETCH HELPER (Async, Non-blocking, PARALLEL) ============
  const prefetchFrames = useCallback(
    async (startFrameIndex: number) => {
      // Don't prefetch if near end or invalid range
      if (
        startFrameIndex >= frameStarts.length ||
        !selectedTrajectory ||
        frameStarts.length === 0
      ) {
        return;
      }

      // Check if already prefetched to avoid duplicate requests
      if (prefetchedRanges.current.has(startFrameIndex)) {
        return;
      }

      try {
        const prefetchStart = startFrameIndex;
        const prefetchEnd = Math.min(startFrameIndex + 100, frameStarts.length);

        // Check if all frames already cached
        let allCached = true;
        for (let i = prefetchStart; i < prefetchEnd; i++) {
          if (!frameCache.current.has(i)) {
            allCached = false;
            break;
          }
        }
        if (allCached) {
          prefetchedRanges.current.add(startFrameIndex);
          return;
        }

        // Mark as prefetching to avoid duplicate requests
        prefetchedRanges.current.add(startFrameIndex);

        // ✓ PARALLEL REQUESTS: Send 5 requests at once
        const PARALLEL_COUNT = 5;
        const startTime = performance.now();

        // Process in batches of PARALLEL_COUNT
        for (
          let batchStart = prefetchStart;
          batchStart < prefetchEnd;
          batchStart += PARALLEL_COUNT
        ) {
          const batchEnd = Math.min(batchStart + PARALLEL_COUNT, prefetchEnd);

          // Create array of promises for this batch
          const batchPromises = [];

          for (
            let frameIndex = batchStart;
            frameIndex < batchEnd;
            frameIndex++
          ) {
            // Skip if already cached
            if (frameCache.current.has(frameIndex)) {
              continue;
            }

            const fetchStart = frameStarts[frameIndex];
            const fetchEnd =
              frameIndex + 1 < frameStarts.length
                ? frameStarts[frameIndex + 1]
                : frameStarts[frameStarts.length - 1];

            // Create promise for this frame
            const framePromise = axios(
              `${serverUrl}/trajectory/${
                selectedTrajectory as unknown as string
              }/offset/${fetchStart}/${fetchEnd}`
            )
              .then((response) => {
                const data: FrameResponse = response.data;

                if (data.frames && data.frames.length > 0) {
                  const frame = data.frames[0];
                  const processed: ProcessedFrame = frameConversion(frame);
                  frameCache.current.set(frameIndex, processed);
                }
              })
              .catch((err) => {
                console.warn(`Failed to fetch frame ${frameIndex}:`, err);
              });

            batchPromises.push(framePromise);
          }

          // ✓ Wait for all requests in this batch to complete
          if (batchPromises.length > 0) {
            await Promise.all(batchPromises);
          }
        }

        const endTime = performance.now();
        const timeTaken = (endTime - startTime) / 1000;

        console.log(
          `✓ Prefetched frames ${prefetchStart}-${prefetchEnd - 1} (${
            prefetchEnd - prefetchStart
          } frames in ${timeTaken.toFixed(2)}s)`
        );
      } catch (err) {
        console.warn("Prefetch failed:", err);
      }
    },
    [serverUrl, selectedTrajectory, frameStarts, frameConversion]
  );

  // ============ CACHE CLEANUP - Sliding Window ============
  const cleanupCache = useCallback((currentFrame: number) => {
    const KEEP_BEHIND = 5;
    const minFrameToKeep = Math.max(0, currentFrame - KEEP_BEHIND);

    let deletedCount = 0;

    // Delete all frames OLDER than (currentFrame - 5)
    frameCache.current.forEach((_, frameNum) => {
      if (frameNum < minFrameToKeep) {
        frameCache.current.delete(frameNum);
        deletedCount++;
      }
    });

    // Log cache size every 100 frames to avoid spam
    if (currentFrame % 100 === 0) {
      console.log(
        `Frame ${currentFrame} | Cache size: ${frameCache.current.size} | Deleted: ${deletedCount} old frames`
      );
    }
  }, []);

  // ============ 3. Fetch Single Frame with Prefetch ============
  const getFrameData = useCallback(
    async (frameIndex: number): Promise<ProcessedFrame | null> => {
      // 1. Check Cache
      if (frameCache.current.has(frameIndex)) {
        // Trigger async prefetch in background (fire and forget)
        // Only prefetch every 50 frames to throttle requests
        if (frameIndex - lastPrefetchFrame.current > 20) {
          lastPrefetchFrame.current = frameIndex;
          prefetchFrames(frameIndex + 100).catch(console.error);
        }

        // Clean up old frames
        cleanupCache(frameIndex);

        return frameCache.current.get(frameIndex)!;
      }

      if (!selectedTrajectory || frameStarts.length === 0) return null;

      try {
        frameIndex = frameIndex % (frameStarts.length - 2);
        const batchStart = frameIndex;
        const batchEnd = Math.min(frameIndex + 1, frameStarts.length);
        const start = frameStarts[batchStart];
        const end =
          batchEnd < frameStarts.length
            ? frameStarts[batchEnd]
            : frameStarts[frameStarts.length - 1] + 1;

        // Fetch current frame
        const response = await axios(
          `${serverUrl}/trajectory/${
            selectedTrajectory as unknown as string
          }/offset/${start}/${end}`
        );
        const data: FrameResponse = response.data;

        if (data.frames) {
          data.frames.forEach((frame, idx) => {
            const cacheIndex = batchStart + idx;
            const processed: ProcessedFrame = frameConversion(frame);
            frameCache.current.set(cacheIndex, processed);
          });
        }

        // Clean up old frames
        cleanupCache(frameIndex);

        // Trigger async prefetch in background (fire and forget)
        // Only prefetch every 50 frames to throttle requests
        if (frameIndex - lastPrefetchFrame.current > 50) {
          lastPrefetchFrame.current = frameIndex;
          prefetchFrames(frameIndex + 100).catch(console.error);
        }

        return frameCache.current.get(frameIndex) || null;
      } catch (err) {
        console.error(`Error fetching frame ${frameIndex}`, err);
        return null;
      }
    },
    [
      serverUrl,
      selectedTrajectory,
      frameStarts,
      frameConversion,
      prefetchFrames,
      cleanupCache,
    ]
  );

  return {
    trajectories,
    selectedTrajectory,
    frameStarts,
    isLoading,
    error,
    listTrajectories,
    selectTrajectory,
    getFrameData,
  };
};
