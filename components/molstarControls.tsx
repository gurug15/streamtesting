"use client";

import { useCallback, useEffect, useState } from "react";
import { useFileData } from "@/context/GromacsContext";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Label } from "./ui/label";
import { useRMSD } from "@/hooks/useRmsd";
import { loadReferenceStructure } from "@/lib/molstarStreaming";
import { UseMolstarReturn } from "@/lib/types";

const MolstarControls = ({
  state,
  handlers,
  serverTraj,
  animation,
}: UseMolstarReturn) => {
  // const serverTraj = useServerTrajectory();
  const [modelRef, setModelRef] = useState<string | null>(null);
  const [structureReady, setStructureReady] = useState(false);
  const {
    setRmsdInputFilenames,
    setDownloadPdbInputFile,
    downloadPdbInputFile,
  } = useFileData();
  const { pdbFromFrame } = useRMSD();
  const [zeroFrameSuperImposed, setzeroFrameSuperImposed] =
    useState<CheckedState>();
  const [zerothStructureRef, setZerothStructureRef] = useState<any>();
  // const animation = useStreamingAnimation(
  //   plugin,
  //   serverTraj.getFrameData,
  //   serverTraj.frameStarts.length,
  //   modelRef
  // );
  if (!serverTraj || !animation || !handlers || !state) {
    return <div>Loading controls...</div>;
  }
  const plugin = state!.plugin;
  useEffect(() => {
    serverTraj.listTrajectories();
    serverTraj.listTopology();
  }, []);

  const loadZerothReferenceStructure = useCallback(async () => {
    if (!zeroFrameSuperImposed) return null;

    try {
      const file: File | undefined = await serverTraj.selectTopology(
        downloadPdbInputFile.topologyFileName
      );
      if (!file) {
        alert("no topology file");
        return;
      }

      const refRef = await loadReferenceStructure(plugin!, file);
      setZerothStructureRef(refRef);
      return refRef;
    } catch (err) {
      console.error("Error loading reference structure:", err);
      return null;
    }
  }, [downloadPdbInputFile, pdbFromFrame, plugin]);

  // 1. Create a handler function
  const handleCheckboxChange = (checked: boolean) => {
    // Update your state first
    setzeroFrameSuperImposed(checked);

    // Check if the box is being unchecked (checked is false)
    if (checked === false) {
      console.log("Checkbox unchecked! Calling function...");
      // Call your custom function here
      deletePreviousReference();
    }
  };

  const deletePreviousReference = useCallback(async () => {
    if (!zerothStructureRef || !zeroFrameSuperImposed || !plugin) return;

    try {
      const structToDelete = zerothStructureRef.structure.ref;
      if (structToDelete) {
        await plugin.build().delete(structToDelete).commit();
      }
    } catch (err) {
      console.error("Error removing previous structure:", err);
    }
  }, [zerothStructureRef, zeroFrameSuperImposed, plugin]);

  const handleLoadStructure = async () => {
    try {
      console.log("clicked");
      const ref = await handlers.loadStructureRepresentation();
      if (ref) {
        setModelRef(ref);
        setStructureReady(true);
        setRmsdInputFilenames((prev) => ({
          ...prev,
          lastFrame: serverTraj.frameStarts.length,
        }));

        if (zeroFrameSuperImposed) {
          loadZerothReferenceStructure();
        }

        animation.play();
      }
    } catch (err) {
      console.error("Failed to load structure:", err);
    }
  };
  const handleSelectTraj = async (id: string) => {
    animation.stop();
    const t = serverTraj.trajectories.find((x) => x === id);
    if (t) {
      await serverTraj.selectTrajectory(t as unknown as string);
    }
  };
  const handleSelectTopo = async (id: string) => {
    animation.stop();
    const t = serverTraj.topologys.find((x) => x === id);
    if (t) {
      const file: File | undefined = await serverTraj.selectTopology(
        t as unknown as string
      );
      if (!file) {
        alert("no topology file");
        return;
      }

      handlers.onTopologyFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto space-y-6 text-white">
      {/* TOPOLOGY UPLOAD */}
      {/* <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
        <h3 className="text-sm font-bold text-blue-400 mb-2 uppercase">
          1. Load Topology
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          Required: .pdb, .gro, or .cif
        </p>

        <input
          type="file"
          accept=".pdb,.gro,.cif,.mmcif"
          required
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handlers.onTopologyFileSelect(e.target.files[0]);
              setRmsdInputFilenames((prev) => ({
                ...prev,
                topologyFileName: e.target.files![0].name,
              }));
              setDownloadPdbInputFile((prev) => ({
                ...prev,
                topologyFileName: e.target.files![0].name,
              }));
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
      </div> */}

      {/* SERVER Topology */}
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
        <h3 className="text-sm font-bold text-green-400 mb-2 uppercase">
          3. Select Topology
        </h3>

        {serverTraj.isLoading && !serverTraj.selectedTopology ? (
          <div className="text-xs text-yellow-500 animate-pulse">
            Loading list...
          </div>
        ) : (
          <select
            onChange={(e) => {
              handleSelectTopo(e.target.value);
              setRmsdInputFilenames((prev) => ({
                ...prev,
                topologyFileName: e.target.value,
              }));
              setDownloadPdbInputFile((prev) => ({
                ...prev,
                topologyFileName: e.target.value,
              }));
            }}
            value={(serverTraj.selectedTopology as string) || ""}
            required
            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm focus:border-green-500 outline-none"
          >
            <option value="">-- Choose Topology --</option>
            {(serverTraj.topologys as unknown as string[]).map((t, index) => (
              <option key={index} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        {serverTraj.error && (
          <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded">
            {serverTraj.error}
          </div>
        )}
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
            onChange={(e) => {
              handleSelectTraj(e.target.value);
              setRmsdInputFilenames((prev) => ({
                ...prev,
                trajectoryFileName: e.target.value,
              }));
              setDownloadPdbInputFile((prev) => ({
                ...prev,
                trajectoryFileName: e.target.value,
              }));
            }}
            value={(serverTraj.selectedTrajectory as string) || ""}
            required
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
      <Card className="flex flex-row items-center gap-2 p-2 rounded-md mx-2 bg-transparent opacity-95 ">
        <Checkbox
          id="terms"
          checked={zeroFrameSuperImposed}
          onCheckedChange={handleCheckboxChange}
        />
        <Label className="dark:text-white w-fit">Superimpose 0th Frame</Label>
      </Card>
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
      <input
        type="text"
        onChange={(e) => {
          setRmsdInputFilenames((prev) => ({
            ...prev,
            outputfileName: e.target.value,
          }));
        }}
        required
        className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-sm focus:border-green-500 outline-none"
        placeholder="output file name for rmsd"
      />

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
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Colors</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="bgColor" className="text-xs">
              Background
            </Label>
            <input
              type="color"
              id="bgColor"
              value={state.bgColor}
              onChange={handlers.onChangeBackgroundColor}
              className="w-full h-10 rounded-md border cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="structureColor" className="text-xs">
              Structure
            </Label>
            <input
              type="color"
              id="structureColor"
              value={state.structureColor}
              onChange={handlers.onChangeStructureColor}
              className="w-full h-10 rounded-md border cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MolstarControls;
