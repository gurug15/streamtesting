"use client";
import { TrajectoryFrameInput, useFileData } from "@/context/GromacsContext";
import api from "@/lib/axios";
import { RmsdUserInput } from "@/lib/types";
import { useState } from "react";

export type GraphData = number[][];

export const useRMSD = () => {
  const [graphData, setGraphData] = useState<GraphData>([]);
  const [pdbLoading, setPdbLoading] = useState<boolean>(false);
  const loadRMSDData = async (analysisData: RmsdUserInput[]) => {
    console.log("in useRmsd: ", analysisData);
    const response = await api.post("/analysis/rmsdGromacs", analysisData);
    setGraphData(response.data);

    return response.status;
  };

  const pdbFromFrame = async (downloadPdbInputFile: TrajectoryFrameInput) => {
    console.log("api to get output file name");
    try {
      setPdbLoading(true);
      const response = await api.post(
        "/analysis/structurefromframe",
        downloadPdbInputFile
      );
      console.log("response: ", response.data.outputFileName);
      setPdbLoading(false);
      return response.data.outputFileName;
    } catch (error) {
      console.log(error);
    } finally {
      setPdbLoading(false);
    }
  };

  return {
    loadRMSDData,
    pdbFromFrame,
    pdbLoading,
    graphData,
  };
};
