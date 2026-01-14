"use client";
// hooks/useStreamingAnimation.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import {
  alignStructures,
  applyFrameToMolstar,
  loadReferenceStructure,
} from "@/lib/molstarStreaming";
import { useFileData } from "@/context/GromacsContext";
import { useRMSD } from "./useRmsd";
import { ProcessedFrame } from "@/lib/types";
import { backendUrl } from "@/lib/axios";

type GetFrameFn = (index: number) => Promise<ProcessedFrame | null>;
type RefRef = { structureRef: any; structure: any } | null;

const BATCH_SIZE = 1;
const PREFETCH_AHEAD = 1;

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
  const [fps, setFps] = useState<number>(30);
  const [referenceStructureRef, setReferenceStructureRef] =
    useState<RefRef>(null);
  const [streamingref, setStreamingRef] = useState<any>();

  // Refs for non-state values
  const currentFrameRef = useRef(1);
  const animationRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const fpsRef = useRef(fps);
  const prefetchedRef = useRef<Set<number>>(new Set());

  const { superImposed, downloadPdbInputFile } = useFileData();
  const { pdbFromFrame } = useRMSD();

  // Sync fps to ref
  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

  // Animation loop
  const animationLoop = useCallback(async () => {
    if (!isPlayingRef.current || !plugin || !modelRef) return;

    try {
      setIsLoading(true);
      const frameData = await getFrameData(currentFrameRef.current);

      if (frameData) {
        const { structureRef } = await applyFrameToMolstar(
          plugin,
          modelRef,
          frameData
        );
        setStreamingRef(structureRef);
        // setStreamingStructureRef(streamingStructureRef!);
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
  }, [plugin, modelRef, getFrameData]);

  // Play/pause/stop effect
  useEffect(() => {
    isPlayingRef.current = isPlaying;

    if (isPlaying && totalFrames > 0 && plugin && modelRef) {
      animationLoop();
    } else {
      if (animationRef.current !== null) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current !== null) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, totalFrames, plugin, modelRef, animationLoop]);

  // Delete previous reference structure
  const deletePreviousReference = useCallback(async () => {
    if (!referenceStructureRef || !superImposed || !plugin) return;

    try {
      const structToDelete = referenceStructureRef.structure.ref;
      if (structToDelete) {
        await plugin.build().delete(structToDelete).commit();
      }
    } catch (err) {
      console.error("Error removing previous structure:", err);
    }
  }, [referenceStructureRef, superImposed, plugin]);

  // Load and set new reference structure
  const loadNewReferenceStructure = useCallback(async () => {
    if (!superImposed) return null;

    try {
      const outputFileName = await pdbFromFrame(downloadPdbInputFile);
      if (!outputFileName.length) return null;

      const pdbUrl = `${backendUrl}/analysis/download/pdb/${outputFileName}`;
      const response = await fetch(pdbUrl);
      const blob = await response.blob();
      const file = new File([blob], outputFileName, {
        type: "chemical/x-pdb",
      });

      const refRef = await loadReferenceStructure(plugin!, file);
      setReferenceStructureRef(refRef);
      return refRef;
    } catch (err) {
      console.error("Error loading reference structure:", err);
      return null;
    }
  }, [superImposed, downloadPdbInputFile, pdbFromFrame, plugin]);

  // Update current frame and streaming data
  const updateStreamingFrame = useCallback(
    async (frameIndex: number) => {
      if (frameIndex < 0 || frameIndex >= totalFrames || !plugin || !modelRef)
        return;

      try {
        const frameData = await getFrameData(frameIndex);
        if (frameData) {
          const streamRef = await applyFrameToMolstar(
            plugin,
            modelRef,
            frameData
          );
          setStreamingRef(streamRef.structureRef);
          // setStreamingStructureRef(streamRef.trajectoryCellRef!.transform.ref);
        }
      } catch (err) {
        console.error("Error updating streaming frame:", err);
        throw err;
      }
    },
    [totalFrames, plugin, modelRef, getFrameData]
  );

  // Align structures
  const performAlignment = useCallback(
    async (refRef: RefRef) => {
      if (!superImposed || !refRef || !streamingref || !plugin) return;

      try {
        const result = await alignStructures(
          plugin,
          streamingref,
          refRef.structureRef
        );
        // console.log("Aligned - TM-score:", result.tmScoreA, "RMSD:", result.rmsd);
        return result;
      } catch (err) {
        console.error("Error during alignment:", err);
        throw err;
      }
    },
    [superImposed, streamingref, plugin]
  );

  // Public methods
  const play = useCallback(() => {
    if (totalFrames > 0 && modelRef) {
      setIsPlaying(true);
      setError(null);
    }
  }, [totalFrames, modelRef]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    currentFrameRef.current = 0;
    setCurrentFrame(0);
  }, []);

  const goToFrame = useCallback(
    async (frameIndex: number) => {
      if (frameIndex < 0 || frameIndex >= totalFrames || !plugin || !modelRef)
        return;

      try {
        setIsLoading(true);
        currentFrameRef.current = frameIndex % totalFrames;
        setCurrentFrame(frameIndex % totalFrames);

        await updateStreamingFrame(frameIndex);
        prefetchedRef.current.clear();
        setError(null);
      } catch (err) {
        console.error("Error going to frame:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [totalFrames, plugin, modelRef, updateStreamingFrame]
  );

  const goToFrameFromGraph = useCallback(
    async (frameIndex: number) => {
      if (frameIndex < 0 || frameIndex >= totalFrames || !plugin || !modelRef)
        return;

      try {
        setIsLoading(true);

        // Delete previous reference if superimposed
        await deletePreviousReference();

        // Load new reference structure if superimposed
        const refRef = await loadNewReferenceStructure();

        // Update streaming frame
        if (!superImposed) {
          currentFrameRef.current = frameIndex % totalFrames;
          setCurrentFrame(frameIndex % totalFrames);
          await updateStreamingFrame(frameIndex);
        }

        // Perform alignment if superimposed
        if (refRef) {
          await performAlignment(refRef);
        }

        prefetchedRef.current.clear();
        setError(null);
      } catch (err) {
        console.error("Error going to frame from graph:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [
      totalFrames,
      plugin,
      modelRef,
      superImposed,
      deletePreviousReference,
      loadNewReferenceStructure,
      updateStreamingFrame,
      performAlignment,
    ]
  );

  const removeSuperimposedStructure = async () => {
    try {
      await deletePreviousReference();
    } catch (err) {
      console.error("Error removing structures:", err);
    }
  };

  return {
    isPlaying,
    currentFrame,
    isLoading,
    fps,
    error,
    play,
    pause,
    stop,
    goToFrame,
    goToFrameFromGraph,
    removeSuperimposedStructure,
    setFps,
  };
};
