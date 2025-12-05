"use client";

import { useRef } from "react";
import { useMolstar } from "@/hooks/useMolstar"; // Your existing hook
import MolstarControls from "./molstarControls";
export default function StreamingViewerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Use your existing hook exactly as is
  const { state, handlers } = useMolstar(canvasRef, parentRef);

  return (
    <div className="flex flex-row h-screen w-screen bg-black overflow-hidden">
      {/* SIDEBAR: Fixed width (20rem / 320px) so buttons are always visible */}
      <div className="w-80 h-full shrink-0 bg-gray-900 border-r border-gray-800 z-10">
        <MolstarControls state={state} handlers={handlers} />
      </div>

      {/* VIEWER: Takes remaining space */}
      <div ref={parentRef} className="flex-1 relative h-full w-full">
        {/* The canvas needs to be absolute to fit the container perfectly */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />

        {/* Optional: Show loading state if plugin isn't ready */}
        {!state.isPluginReady && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Initializing Viewer...
          </div>
        )}
      </div>
    </div>
  );
}
