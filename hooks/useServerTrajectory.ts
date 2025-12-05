import { FrameResponse } from "@/lib/types";
import axios from "axios";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { useState, useCallback, useRef } from "react";

const MDSRV_SERVER_URL = process.env.NEXT_PUBLIC_MDSRV_URL;

export interface TrajectoryEntry {
  id: string;
  name: string;
  description: string;
  source: string;
  timestamp: number;
}

export interface ProcessedFrame {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  count: number;
}

export const useServerTrajectory = (serverUrl = MDSRV_SERVER_URL) => {
  // ============ STATE ============
  const [trajectories, setTrajectories] = useState<TrajectoryEntry[]>([]);
  const [selectedTrajectory, setSelectedTrajectory] =
    useState<TrajectoryEntry | null>(null);
  const [frameStarts, setFrameStarts] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ CACHE ============
  // We keep the cache HERE, in the data layer
  const frameCache = useRef<Map<number, ProcessedFrame>>(new Map());

  // ============ 1. List Trajectories ============
  const listTrajectories = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios(`${serverUrl}/list/trajectory`);
      setTrajectories(response.data || []);
    } catch (err) {
      setError(`Failed to list trajectories: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl]);

  // ============ 2. Select & Get Offsets ============
  const selectTrajectory = useCallback(
    async (entry: TrajectoryEntry) => {
      try {
        setSelectedTrajectory(entry);
        setIsLoading(true);
        frameCache.current.clear(); // Clear cache for new file

        const response = await axios(
          `${serverUrl}/get/trajectory/${entry.id}/starts`
        );

        const offsets = response.data
          .trim()
          .split(/[,\s]+/)
          .map(Number)
          .filter((n: any) => !isNaN(n));
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

  // ============ 3. Fetch Single Frame (The core helper) ============
  const getFrameData = useCallback(
    async (frameIndex: number): Promise<ProcessedFrame | null> => {
      // 1. Check Cache
      if (frameCache.current.has(frameIndex)) {
        return frameCache.current.get(frameIndex)!;
      }

      if (!selectedTrajectory || frameStarts.length === 0) return null;

      // 2. Prepare Request
      const start = frameStarts[frameIndex];
      const end =
        frameIndex + 1 < frameStarts.length
          ? frameStarts[frameIndex + 1]
          : Infinity;

      try {
        const response = await fetch(
          `${serverUrl}/get/trajectory/${selectedTrajectory.id}/frame/offset/${start}/${end}`
        );
        const data: FrameResponse = await response.json();

        if (!data.frames || data.frames.length === 0)
          throw new Error("Empty frame");

        // 3. Process Data (Convert to Float32Array here, once)
        const frame = data.frames[0];
        const count = frame.count || frame.x.length;

        const processed: ProcessedFrame = {
          x: new Float32Array(count),
          y: new Float32Array(count),
          z: new Float32Array(count),
          count: count,
        };

        for (let i = 0; i < count; i++) {
          processed.x[i] = frame.x[i] ?? 0;
          processed.y[i] = frame.y[i] ?? 0;
          processed.z[i] = frame.z[i] ?? 0;
        }
        console.log("noraml frames: ", frame);
        console.log("Processed Frame ", processed);
        // 4. Update Cache (Limit size to ~50 frames to save RAM)
        if (frameCache.current.size > 50) {
          const firstKey = frameCache.current.keys().next().value;
          if (firstKey !== undefined) frameCache.current.delete(firstKey);
        }

        frameCache.current.set(frameIndex, processed);
        return processed;
      } catch (err) {
        console.error(`Error fetching frame ${frameIndex}`, err);
        return null;
      }
    },
    [serverUrl, selectedTrajectory, frameStarts]
  );

  return {
    trajectories,
    selectedTrajectory,
    frameStarts,
    isLoading,
    error,
    listTrajectories,
    selectTrajectory,
    getFrameData, // Expose this function to the animation hook
  };
};
