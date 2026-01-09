"use client";
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
  picoSecNumber: number;
  rmsdDeviation?: number;
}

import { CheckedState } from "@radix-ui/react-checkbox";
import { RmsdUserInput } from "@/lib/types";

interface FileContextType {
  rmsdinputfilenames: RmsdUserInput;
  downloadPdbInputFile: TrajectoryFrameInput;
  superImposed: CheckedState;
  pstoframe: number;
  setPsTOFrame: Dispatch<SetStateAction<number>>;
  setSuperImposed: Dispatch<SetStateAction<CheckedState>>;
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
      picoSecNumber: 0,
      topologyFileName: "",
      trajectoryFileName: "",
    });
  const [superImposed, setSuperImposed] = useState<CheckedState>(false);
  const [pstoframe, setPsTOFrame] = useState<number>(1);
  return (
    <Filecontext.Provider
      value={{
        rmsdinputfilenames,
        setRmsdInputFilenames,
        downloadPdbInputFile,
        setDownloadPdbInputFile,
        superImposed,
        setSuperImposed,
        pstoframe,
        setPsTOFrame,
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
