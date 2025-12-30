"use client";
import api from "@/lib/axios";
import { RmsdUserInput } from "@/lib/types";
import { useState } from "react";

type GraphData = number[][][];

export const useRMSD = () => {
  const [graphData, setGraphData] = useState<GraphData>([]);

  const loadRMSDData = async (analysisData: RmsdUserInput[]) => {
    console.log("in useRmsd: ", analysisData);
    const response = await api.post("/analysis/rmsdGromacs", analysisData);
    setGraphData(response.data);

    return response.status;
  };

  return {
    loadRMSDData,
    graphData,
  };
};
