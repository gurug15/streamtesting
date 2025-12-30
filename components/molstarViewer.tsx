"use client";
import { useMolstar } from "@/hooks/useMolstar";
import { useRef } from "react";
import MolstarControls from "./molstarControls";
import { GraphDisplay } from "./gromacs/GraphDisplay";

const MolstarViewer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const { state, handlers } = useMolstar(canvasRef, parentRef);
  return (
    <div className="w-screen flex h-screen">
      <MolstarControls state={state} handlers={handlers} />
      <div className="w-5/6 h-screen flex-col justify-center items-center bg-gray-900">
        <div ref={parentRef} className="w-full h-1/2">
          <canvas className="h-full w-full" ref={canvasRef}></canvas>
        </div>
        <div className="w-full h-1/2">
          <GraphDisplay graphData={[]} xLabel="Time (ps)" yLabel="RMSD (nm)" />
        </div>
      </div>
    </div>
  );
};

export default MolstarViewer;
