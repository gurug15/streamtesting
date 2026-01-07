"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartComponent } from "./ChartComponet";
import { useRMSD } from "@/hooks/useRmsd";
import { Button } from "../ui/button";
import { useFileData } from "@/context/GromacsContext";
import { RmsdUserInput } from "@/lib/types";
import { Download } from "lucide-react";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";

interface GraphDisplayProps {
  graphData?: number[][][];
  gotoFrameFromGraph?: (frame: number) => void;
  removeSuperimposedStrucure?: () => void;
  xLabel: string;
  yLabel: string; // Replace 'any' with your specific graph data type if available
}

export const backendUrl =
  process.env.REACT_APP_API_URL || "http://localhost:5000";
export function GraphDisplay({
  // graphData,
  gotoFrameFromGraph,
  removeSuperimposedStrucure,
  xLabel,
  yLabel,
}: GraphDisplayProps) {
  const {
    rmsdinputfilenames,
    downloadPdbInputFile,
    setSuperImposed,
    superImposed,
  } = useFileData();
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
          <CardHeader className="p-2 pb-0 gap-0 flex justify-between border-b bg-transparent shrink-0">
            <CardTitle className="text-sm font-semibold w-1/2">
              {yLabel} Graph Plot
            </CardTitle>
            <div className="flex w-1/2 justify-end">
              <Button
                onClick={handleDownload}
                disabled={pdbLoading}
                variant="outline"
                size="sm"
                className="w-fit"
              >
                <Download className="w-4 h-4 mr-2" />
                {pdbLoading
                  ? "Generating..."
                  : `Download PDB for picoSecond: ${downloadPdbInputFile.picoSecNumber}`}
              </Button>
              <Card className="flex flex-row items-center gap-2 p-2 rounded-md mx-2 bg-transparent opacity-95 ">
                <Checkbox
                  id="terms"
                  checked={superImposed}
                  onCheckedChange={setSuperImposed}
                />
                <Label htmlFor="terms">
                  Superimpose{" "}
                  {superImposed && downloadPdbInputFile.picoSecNumber}
                </Label>
              </Card>
              {superImposed && (
                <Button
                  onClick={removeSuperimposedStrucure}
                  className="flex flex-row items-center gap-2 p-2 rounded-md mx-2 bg-transparent opacity-95 "
                >
                  remove superimposition
                </Button>
              )}
            </div>
          </CardHeader>
          <div className="flex-1 min-h-0">
            <ChartComponent
              gotoFramefromGraph={gotoFrameFromGraph}
              rawData={graphData}
              xLabel={xLabel}
              yLabel={yLabel}
              lineColor={"#00ff00"}
            />
          </div>
        </Card>
      ) : (
        <div className="w-full h-full flex justify-center items-center">
          <Button onClick={handleLoadRmsd}>Load RMSD Data</Button>
        </div>
      )}
    </div>
  );
}
