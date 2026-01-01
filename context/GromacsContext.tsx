"use client";
import { RmsdUserInput } from "@/lib/types";
import {
  Dispatch,
  SetStateAction,
  use,
  useContext,
  useEffect,
  useState,
} from "react";
import { createContext } from "react";

export interface TrajectoryFrameInput {
  topologyFileName: string;
  trajectoryFileName: string;
  frameNumber: number;
  rmsdDeviation?: number;
}

interface FileContextType {
  rmsdinputfilenames: RmsdUserInput;
  downloadPdbInputFile: TrajectoryFrameInput;
  setDownloadPdbInputFile: Dispatch<SetStateAction<TrajectoryFrameInput>>;
  setRmsdInputFilenames: Dispatch<SetStateAction<RmsdUserInput>>;
}

const Filecontext = createContext<FileContextType | undefined>(undefined);

export function GromacsFileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [rmsdinputfilenames, setRmsdInputFilenames] = useState<RmsdUserInput>({
    trajectoryFileName: "",
    topologyFileName: "",
    outputfileName: "",
    firstFrame: 1,
    lastFrame: 1,
    groupLsFit: 0,
    groupRMSD: 0,
  });
  const [downloadPdbInputFile, setDownloadPdbInputFile] =
    useState<TrajectoryFrameInput>({
      frameNumber: 1,
      topologyFileName: "",
      trajectoryFileName: "",
    });
  return (
    <Filecontext.Provider
      value={{
        rmsdinputfilenames,
        setRmsdInputFilenames,
        downloadPdbInputFile,
        setDownloadPdbInputFile,
      }}
    >
      {children}
    </Filecontext.Provider>
  );
}

export const useFileData = () => {
  const context = useContext(Filecontext);
  if (context === undefined) {
    throw new Error("useFileData must be used within a FileProvider");
  }
  return context;
};
