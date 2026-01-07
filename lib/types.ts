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

import { Topology } from "molstar/lib/mol-model/structure";
import { PluginContext } from "molstar/lib/mol-plugin/context";

export type UseMolstarReturn = {
  state?: {
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
  handlers?: {
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
  serverTraj?: {
    trajectories: string[];
    topologys: string[];
    selectedTopology: string | null;
    selectedTrajectory: string | null;
    frameStarts: number[];
    isLoading: boolean;
    error: string | null;
    listTrajectories: () => Promise<void>;
    listTopology: () => Promise<void>;
    selectTrajectory: (trajectory: string) => Promise<void>;
    selectTopology: (topology: string) => Promise<File | undefined>;
    getFrameData: (frameIndex: number) => Promise<any>;
  };
  animation?: {
    isPlaying: boolean;
    currentFrame: number;
    isLoading: boolean;
    fps: number;
    error: string | null;
    play: () => void;
    pause: () => void;
    stop: () => void;
    goToFrame: (frameIndex: number) => void;
    setFps: (fps: number) => void;
  };
};

export interface RmsdUserInput {
  trajectoryFileName: string;
  topologyFileName: string;
  outputfileName: string;
  firstFrame: number;
  lastFrame: number;
  groupLsFit: number;
  groupRMSD: number;
}
