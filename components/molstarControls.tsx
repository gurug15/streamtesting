"use client";

import { useEffect, useState } from "react";
import { useServerTrajectory } from "@/hooks/useServerTrajectory";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { useStreamingAnimation } from "@/hooks/useStreamingAnimation";
import { UseMolstarReturn } from "@/lib/types";

const MolstarControls = ({ state, handlers }: UseMolstarReturn) => {
  const serverTraj = useServerTrajectory();
  const [modelRef, setModelRef] = useState<string | null>(null);
  const [structureReady, setStructureReady] = useState(false);
  const plugin = state.plugin;
  const animation = useStreamingAnimation(
    plugin,
    serverTraj.getFrameData,
    serverTraj.frameStarts.length,
    modelRef
  );

  useEffect(() => {
    serverTraj.listTrajectories();
  }, []);

  const handleLoadStructure = async () => {
    try {
      console.log("clicked");
      const ref = await handlers.loadStructureRepresentation();
      if (ref) {
        setModelRef(ref);
        setStructureReady(true);
        animation.play();
      }
    } catch (err) {
      console.error("Failed to load structure:", err);
    }
  };

  const handleSelect = async (id: string) => {
    animation.stop();
    const t = serverTraj.trajectories.find((x) => x === id);
    if (t) {
      await serverTraj.selectTrajectory(t as unknown as string);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto space-y-6 text-white">
      {/* TOPOLOGY UPLOAD */}
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
        <h3 className="text-sm font-bold text-blue-400 mb-2 uppercase">
          1. Load Topology
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          Required: .pdb, .gro, or .cif
        </p>

        <input
          type="file"
          accept=".pdb,.gro,.cif,.mmcif"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handlers.onTopologyFileSelect(e.target.files[0]);
            }
          }}
          className="block w-full text-xs text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-xs file:font-semibold
            file:bg-blue-600 file:text-white
            hover:file:bg-blue-700
            cursor-pointer"
        />
      </div>

      {/* LOAD STRUCTURE */}
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
        <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase">
          2. Initialize Structure
        </h3>

        <button
          onClick={handleLoadStructure}
          disabled={!plugin || serverTraj.isLoading}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-white font-bold transition-colors"
        >
          Load Structure
        </button>
      </div>

      {/* SERVER TRAJECTORY */}
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
        <h3 className="text-sm font-bold text-green-400 mb-2 uppercase">
          3. Select Stream
        </h3>

        {serverTraj.isLoading && !serverTraj.selectedTrajectory ? (
          <div className="text-xs text-yellow-500 animate-pulse">
            Loading list...
          </div>
        ) : (
          <select
            onChange={(e) => handleSelect(e.target.value)}
            value={(serverTraj.selectedTrajectory as string) || ""}
            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm focus:border-green-500 outline-none"
          >
            <option value="">-- Choose Trajectory --</option>
            {(serverTraj.trajectories as unknown as string[]).map(
              (t, index) => (
                <option key={index} value={t}>
                  {t}
                </option>
              )
            )}
          </select>
        )}

        {serverTraj.error && (
          <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded">
            {serverTraj.error}
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-yellow-400 mb-2 uppercase">
            FPS Control
          </h3>
          <h3 className="mb-2">
            Current FPS: <span className="font-mono">{animation.fps}</span>
          </h3>
        </div>
        <input
          type="range"
          min="5"
          max="60"
          value={animation.fps}
          onChange={(e) => animation.setFps(Number(e.target.value))}
          className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm focus:border-yellow-500 outline-none"
        />
      </div>

      {/* ANIMATION CONTROLS */}
      {serverTraj.frameStarts.length > 0 && structureReady && modelRef && (
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
          <h3 className="text-sm font-bold text-cyan-400 mb-2 uppercase">
            4. Playback
          </h3>

          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Frame</span>
            <span className="font-mono text-white">
              {animation.currentFrame} / {serverTraj.frameStarts.length}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max={serverTraj.frameStarts.length - 1}
            value={animation.currentFrame}
            onChange={(e) => {
              if (animation.currentFrame >= serverTraj.frameStarts.length - 1) {
                animation.goToFrame(0);
                // animation.play();
              }
              animation.goToFrame(Number(e.target.value));
            }}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500 mb-4"
          />

          <div className="flex gap-2">
            <button
              onClick={animation.isPlaying ? animation.pause : animation.play}
              className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
                animation.isPlaying
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {animation.isPlaying ? "PAUSE" : "PLAY"}
            </button>

            <button
              onClick={animation.stop}
              className="px-4 bg-red-600 hover:bg-red-700 rounded text-white font-bold"
            >
              ⏹
            </button>
          </div>

          {/* {animation.isLoading && (
            <div className="mt-2 text-xs text-blue-400 animate-pulse">
              Loading frame...
            </div>
          )} */}

          {animation.error && (
            <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded">
              {animation.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MolstarControls;
