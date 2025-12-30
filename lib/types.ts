export interface FrameResponse {
  frames: Frame[];
  boxes: { [key: string]: number }[];
  times: number[];
  timeOffset: number;
  deltaTime: number;
}

export interface Frame {
  count: number;
  x: { [key: string]: number };
  y: { [key: string]: number };
  z: { [key: string]: number };
}

import { PluginContext } from "molstar/lib/mol-plugin/context";

export type UseMolstarReturn = {
  state: {
    isPluginReady: boolean;
    isSpinning: boolean;
    bgColor: string;
    structureColor: string;
    selectedRepresentation: string;
    isStructureLoaded: boolean;
    isStereoEnabled: boolean;
    frameCount: number;
    atomcount: number;
    plugin: PluginContext | null;
    modelRef: string | null;
  };
  handlers: {
    onTopologyFileSelect: (file: File | null) => Promise<any>;
    onTrajectoryFileSelect: (file: File | null) => Promise<void>;
    onToggleSpin: () => void;
    onChangeStructureColor: (
      event: React.ChangeEvent<HTMLInputElement>
    ) => void;
    onSetRepresentation: (
      event: React.ChangeEvent<HTMLSelectElement>
    ) => Promise<void>;
    toggleTragractoryAnimation: () => Promise<void>;
    loadStructureRepresentation: () => Promise<string | null>;
    getModelRef: () => string | null;
  };
};

export interface RmsdUserInput {
  trajectoryFileName: string;
  topologyFileName: string;
  outputfileName: string;
}
