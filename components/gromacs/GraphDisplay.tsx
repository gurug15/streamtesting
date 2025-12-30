"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartComponent } from "./ChartComponet";

interface GraphDisplayProps {
  graphData: number[][][];
  xLabel: string;
  yLabel: string; // Replace 'any' with your specific graph data type if available
}

export function GraphDisplay({ graphData, xLabel, yLabel }: GraphDisplayProps) {
  return (
    <div className="w-full md:w-4/5 flex flex-col gap-2 h-full">
      {graphData.length > 0 ? (
        graphData.map((data, index) => {
          return (
            <Card
              key={index}
              className="bg-white dark:bg-white/10 p-1 shadow rounded-lg border flex-1 flex flex-col min-h-0 border-gray-700"
            >
              <CardHeader className="p-2 pb-0 gap-0 border-b bg-transparent shrink-0">
                <CardTitle className="text-sm font-semibold">
                  {yLabel} Graph Plot {index}
                </CardTitle>
              </CardHeader>
              <div className="flex-1 min-h-0">
                <ChartComponent
                  rawData={data}
                  xLabel={xLabel}
                  yLabel={yLabel}
                  lineColor={index == 0 ? "#0066ff" : "#00ff00"}
                />
              </div>
            </Card>
          );
        })
      ) : (
        <div className="w-full h-full flex justify-center items-center">
          No Graph Data
        </div>
      )}
    </div>
  );
}
