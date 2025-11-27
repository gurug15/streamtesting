"use client";
import { useMolstar } from "@/hooks/useMolstar";
import { useRef } from "react";
import MolstarControls from "./molstarControls";

const MolstarViewer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const { state, handlers } = useMolstar(canvasRef, parentRef);
  return (
    <div className="w-screen flex h-screen">
      <MolstarControls state={state} handlers={handlers} />
      <div ref={parentRef} className="w-5/6 h-screen">
        <canvas className="h-full w-full" ref={canvasRef}></canvas>
      </div>
    </div>
  );
};

export default MolstarViewer;
