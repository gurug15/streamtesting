"use client";

import { useState } from "react";
import useFileUpload from "@/hooks/useFileUpload";

const MolstarControls = ({ state, handlers }: UseMolType) => {
  const [trajrectoryFile, setTrajectoryFile] = useState<File | null>(null);
  const { handleUpload, publicUrl, uploadToMDSrv } = useFileUpload();

  return (
    <div className="w-1/6 h-screen p-3 ">
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">
          Upload Topology file
        </label>
        <input
          className="block w-full text-sm text-gray-500 
           file:mr-4 file:py-2 file:px-4 
           file:rounded-md file:border-0 
           file:text-sm file:font-semibold 
           file:bg-blue-50 file:text-blue-700 
           hover:file:bg-blue-100"
          id="file_input_topology"
          placeholder="topology"
          type="file"
          accept=".pdb, .gro, .cif"
          onChange={(e) => handlers.onTopologyFileSelect(e.target!.files![0])}
        ></input>
      </div>
      <div>
        {" "}
        <label className="block text-sm font-medium text-gray-200 mb-2">
          Upload traj file
        </label>
        <input
          className="block w-full text-sm text-gray-500 
           file:mr-4 file:py-2 file:px-4 
           file:rounded-md file:border-0 
           file:text-sm file:font-semibold 
           file:bg-blue-50 file:text-blue-700 
           hover:file:bg-blue-100"
          placeholder="trajectory"
          type="file"
          accept=".xtc, .dcd"
          onChange={(e) => {
            if (!e.target || !e.target.files) return;
            setTrajectoryFile(e.target.files[0]);
            return handlers.onTrajectoryFileSelect(e.target!.files![0]);
          }}
        ></input>
      </div>
      <button
        onClick={handlers.loadStructureRepresentation}
        // disabled={state.isStructureLoaded}
        className="px-4  mt-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Load
      </button>
      <button
        onClick={handlers.toggleTragractoryAnimation}
        className="px-4 ml-2 mt-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Toggle animation
      </button>
      <button
        onClick={(e) => {
          trajrectoryFile && handleUpload(trajrectoryFile);
          uploadToMDSrv();
        }}
        className="px-4 ml-2 mt-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        upload traj file
      </button>
      <a href={publicUrl}>download File</a>
    </div>
  );
};

export default MolstarControls;
