"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
  Brush,
  ComposedChart,
  ResponsiveContainer,
  ReferenceArea,
  Label,
  Tooltip, // Imported raw Tooltip from Recharts
} from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { CategoricalChartState } from "recharts/types/chart/types";

interface ChartComponentProps {
  rawData: number[][];
  xLabel?: string;
  yLabel?: string;
  lineColor?: string;
}

type ChartPoint = {
  x: number;
  y: number;
};
export function ChartComponent({
  rawData = [],
  xLabel = "Time (ps)",
  yLabel = "RMSD (nm)",
  lineColor = "#0066ff",
}: ChartComponentProps) {
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [range, setRange] = useState({ left: 0, right: 0 });
  const [selection, setSelection] = useState<{
    left: number | null;
    right: number | null;
  }>({ left: null, right: null });
  const [selecting, setSelecting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  console.log("rawData in ChartComponent: ", rawData);
  useEffect(() => {
    if (rawData && rawData.length > 0) {
      const formattedData = rawData.map((point) => ({
        x: point[0],
        y: point[1],
      }));
      setChartData(formattedData);
      setRange({ left: 0, right: formattedData.length - 1 });
    }
  }, [rawData]);

  const chartConfig: ChartConfig = {
    y: {
      label: yLabel,
      color: lineColor,
    },
  };

  const handleMouseDown = useCallback(
    (e: CategoricalChartState) => {
      if (e.activeLabel) {
        const index = chartData.findIndex((d) => d.x === Number(e.activeLabel));
        if (index !== -1) {
          setSelection({ left: index, right: null });
          setSelecting(true);
        }
      }
    },
    [chartData]
  );

  const handleMouseMove = useCallback(
    (e: CategoricalChartState) => {
      if (selecting && e.activeLabel) {
        const index = chartData.findIndex((d) => d.x === Number(e.activeLabel));
        if (index !== -1) {
          setSelection((prev) => ({ ...prev, right: index }));
        }
      }
    },
    [selecting, chartData]
  );

  const handleMouseUp = useCallback(() => {
    if (selection.left !== null && selection.right !== null) {
      const [tempLeft, tempRight] = [selection.left, selection.right].sort(
        (a, b) => a - b
      );
      setRange({ left: tempLeft, right: tempRight });
    }
    setSelection({ left: null, right: null });
    setSelecting(false);
  }, [selection]);

  const reset = useCallback(() => {
    setRange({ left: 0, right: chartData.length - 1 });
  }, [chartData]);

  const handleZoom = useCallback(
    (
      e: React.WheelEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ) => {
      if (!chartData.length || !chartRef.current) return;
      const zoomFactor = 0.1;
      let direction = 0;
      let clientX = 0;

      if ("deltaY" in e) {
        direction = e.deltaY < 0 ? 1 : -1;
        clientX = e.clientX;
      } else if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch1.clientX - touch2.clientX,
          touch1.clientY - touch2.clientY
        );
        if ((e as any).lastTouchDistance) {
          direction = currentDistance > (e as any).lastTouchDistance ? 1 : -1;
        }
        (e as any).lastTouchDistance = currentDistance;
        clientX = (touch1.clientX + touch2.clientX) / 2;
      } else {
        return;
      }

      const { left, right } = range;
      const currentRange = right - left;
      const zoomAmount = currentRange * zoomFactor * direction;

      const chartRect = chartRef.current.getBoundingClientRect();
      const mouseX = clientX - chartRect.left;
      const chartWidth = chartRect.width;
      const mousePercentage = mouseX / chartWidth;

      const newLeft = Math.max(
        0,
        left + Math.floor(zoomAmount * mousePercentage)
      );
      const newRight = Math.min(
        chartData.length - 1,
        right - Math.ceil(zoomAmount * (1 - mousePercentage))
      );

      if (newLeft >= newRight) return;
      setRange({ left: newLeft, right: newRight });
    },
    [chartData, range]
  );

  const CustomTooltip = ({ active, payload, coordinate }: any) => {
    if (active && payload && payload.length) {
      const xValue = payload[0].payload.x;
      const yValue = payload[0].value;

      return (
        <div
          className="rounded-lg border border-slate-200 w-[150px] bg-white text-slate-950 shadow-md dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 text-xs p-2"
          style={{
            position: "absolute",
            left:
              coordinate?.x > window.innerWidth * 0.7
                ? `${coordinate?.x - 200}px`
                : `${coordinate?.x}px`,
            right: coordinate?.x > window.innerWidth * 0.7 ? "20px" : "auto",
            top: `${coordinate?.y}px`,
            pointerEvents: "none",
          }}
        >
          <div className="font-semibold mb-1 border-b border-slate-100 dark:border-slate-800 pb-1">
            {xLabel}: {Number(xValue).toFixed(2)}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="block h-2 w-2 rounded-full"
              style={{ backgroundColor: lineColor }}
            />
            <span className="text-slate-500 dark:text-slate-400">
              {yLabel}:
            </span>
            <span className="font-mono font-medium">
              {Number(yValue).toFixed(4)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };
  const minX = chartData[range.left]?.x;
  const maxX = chartData[range.right]?.x;

  const memoizedChart = useMemo(
    () => (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />

          <XAxis
            dataKey="x"
            type="number"
            domain={[minX ?? "dataMin", maxX ?? "dataMax"]}
            allowDataOverflow={true}
            tickLine={false}
            axisLine={true}
            tickCount={chartData.length}
            tickMargin={0}
            tickSize={10}
            style={{ userSelect: "none", fontSize: "10px" }}
          >
            <Label
              value={xLabel}
              offset={0}
              position="bottom"
              style={{ fontSize: "12px", fill: "#666" }}
            />
          </XAxis>

          <YAxis
            tickLine={false}
            axisLine={true}
            tickMargin={0}
            width={40}
            style={{ userSelect: "none", fontSize: "9px" }}
            domain={["auto", "auto"]}
          >
            <Label
              value={yLabel}
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: "middle", fontSize: "12px", fill: "#666" }}
            />
          </YAxis>

          {/* Swapped Shadcn ChartTooltip for raw Recharts Tooltip with Custom Component */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "#888", strokeWidth: 1, opacity: 0.5 }}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ pointerEvents: "none" }}
          />

          <Line
            dataKey="y"
            type="monotone"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          {selection.left !== null && selection.right !== null && (
            <ReferenceArea
              x1={chartData[selection.left]?.x}
              x2={chartData[selection.right]?.x}
              strokeOpacity={0.3}
              fill="#8884d8"
              fillOpacity={0.1}
            />
          )}

          <Brush
            dataKey="x"
            height={25}
            startIndex={range.left}
            endIndex={range.right}
            onChange={(e) =>
              setRange({
                left: e.startIndex ?? 0,
                right: e.endIndex ?? chartData.length - 1,
              })
            }
            stroke="#888888"
            fill="rgba(0,0,0,0.05)"
            tickFormatter={(value) =>
              typeof value === "number" ? value.toFixed(0) : ""
            }
          />
        </ComposedChart>
      </ResponsiveContainer>
    ),
    [
      chartData,
      range,
      selection,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      xLabel,
      yLabel,
      lineColor,
      minX,
      maxX,
    ]
  );

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0 p-2">
      <div className="flex justify-between items-center mb-2 px-2">
        <div className="text-xs text-muted-foreground">
          Range: {chartData[range.left]?.x.toFixed(2)} -{" "}
          {chartData[range.right]?.x.toFixed(2)} {xLabel}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={reset}
        >
          Reset Zoom
        </Button>
      </div>

      <ChartContainer config={chartConfig} className="flex-1 w-full min-h-0">
        <div
          className="w-full h-full"
          onWheel={handleZoom}
          onTouchMove={handleZoom}
          ref={chartRef}
          style={{ touchAction: "none" }}
        >
          {memoizedChart}
        </div>
      </ChartContainer>
    </div>
  );
}
