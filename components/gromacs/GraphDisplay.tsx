"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartComponent } from "./ChartComponet";
import { useRMSD } from "@/hooks/useRmsd";
import { Button } from "../ui/button";
import { useFileData } from "@/context/GromacsContext";
import { RmsdUserInput } from "@/lib/types";
import { rm } from "fs";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface GraphDisplayProps {
  graphData: number[][][];
  gotoFrame?: (frame: number) => void;
  xLabel: string;
  yLabel: string; // Replace 'any' with your specific graph data type if available
}

const backendUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
export function GraphDisplay({
  // graphData,
  gotoFrame,
  xLabel,
  yLabel,
}: GraphDisplayProps) {
  const { rmsdinputfilenames, downloadPdbInputFile } = useFileData();
  const { loadRMSDData, graphData, pdbFromFrame, pdbLoading } = useRMSD();
  const handleLoadRmsd = async () => {
    if (
      rmsdinputfilenames.outputfileName.length == 0 ||
      rmsdinputfilenames.topologyFileName.length == 0 ||
      rmsdinputfilenames.trajectoryFileName.length == 0
    ) {
      alert("Please provide all RMSD input files.");
      return;
    }
    const rmsdArrayInput: RmsdUserInput[] = [];
    rmsdArrayInput.push(rmsdinputfilenames);

    await loadRMSDData(rmsdArrayInput);
  };

  const handleDownload = async () => {
    const outputFileName = await pdbFromFrame(downloadPdbInputFile);
    if (outputFileName.length > 0) {
      window.location.href = `${backendUrl}/analysis/download/pdb/${outputFileName}`;
    } else {
      alert("no download url");
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 h-full">
      {graphData.length > 0 ? (
        <Card className="bg-white dark:bg-white/10 p-1 shadow rounded-lg border flex-1 flex flex-col min-h-0 border-gray-700">
          <CardHeader className="p-2 pb-0 gap-0 flex border-b bg-transparent shrink-0">
            <CardTitle className="text-sm font-semibold w-1/2">
              {yLabel} Graph Plot
            </CardTitle>
            <Button
              onClick={handleDownload}
              disabled={pdbLoading}
              variant="outline"
              size="sm"
              className="w-1/2"
            >
              <Download className="w-4 h-4 mr-2" />
              {pdbLoading
                ? "Generating..."
                : `Download PDB for frame: ${downloadPdbInputFile.frameNumber}`}
            </Button>
          </CardHeader>
          <div className="flex-1 min-h-0">
            <ChartComponent
              gotoFrame={gotoFrame}
              rawData={graphData}
              xLabel={xLabel}
              yLabel={yLabel}
              lineColor={"#00ff00"}
            />
          </div>
        </Card>
      ) : (
        <div className="w-full h-full flex justify-center items-center">
          No Graph Data..
          <Button onClick={handleLoadRmsd}>Load RMSD Data</Button>
        </div>
      )}
    </div>
  );
}
