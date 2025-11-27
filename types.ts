type UseMolType = {
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
  };
  handlers: {
    onTopologyFileSelect: (file: File) => void;
    onTrajectoryFileSelect: (file: File) => void;
    onToggleSpin: () => void;
    onSetRepresentation: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    toggleTragractoryAnimation: () => void;
    loadStructureRepresentation: () => void;
  };
};
