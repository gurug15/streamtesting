"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { UUID } from "molstar/lib/mol-util";
import { Asset } from "molstar/lib/mol-util/assets";
import { v4 as uuidv4 } from "uuid";
import { Color } from "molstar/lib/mol-util/color";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { BuiltInCoordinatesFormat } from "molstar/lib/mol-plugin-state/formats/coordinates";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { BuiltInTrajectoryFormat } from "molstar/lib/mol-plugin-state/formats/trajectory";

export const useMolstar = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  parentRef: RefObject<HTMLDivElement | null>
) => {
  const [plugin, setPlugin] = useState<PluginContext | null>(null);
  const [isPluginReady, setIsPluginReady] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [bgColor, setBgColor] = useState("#000000");
  const [structureColor, setStructureColor] = useState<string>("#ffffff");
  const [representationTypes, setRepresentationTypes] = useState<
    [string, string][]
  >([]);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [atomcount, setAtomcount] = useState<number>(0);
  const [selectedRepresentation, setSelectedRepresentation] =
    useState<string>("default");
  const [isStructureLoaded, setIsStructureLoaded] = useState(false);
  const [isStereoEnabled, setIsStereoEnabled] = useState(false);
  const [topologyModel, setTopologyModel] = useState<any>(null);
  const [cordinateRef, setCordinateRef] = useState<any>(null);
  const [modelRef, setModelRef] = useState<string | null>(null);

  // Effect for plugin initialization and disposal
  useEffect(() => {
    const initPlugin = async () => {
      try {
        const canvas = canvasRef.current;
        const parent = parentRef.current;
        if (!canvas || !parent) return;

        const newPlugin = new PluginContext(DefaultPluginSpec());
        setPlugin(newPlugin);

        const success = await newPlugin.initViewerAsync(canvas, parent);

        if (success) {
          setIsPluginReady(true);
          newPlugin.canvas3d?.setProps({
            renderer: {
              backgroundColor: Color(parseInt(bgColor.replace("#", "0x"))),
            },
            interaction: {
              maxFps: 120,
            },
          });
        } else {
          console.error("Failed to initialize Mol*Star");
        }
      } catch (err) {
        console.error("Error initializing Mol*Star:", err);
      }
    };

    initPlugin();

    return () => {
      plugin?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, parentRef]);

  function getFormatByExtension(
    filename: string
  ): BuiltInTrajectoryFormat | undefined {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "mmcif":
      case "cif":
        return "mmcif";
      case "pdb":
        return "pdb";
      case "pdbqt":
        return "pdbqt";
      case "gro":
        return "gro";
      case "xyz":
        return "xyz";
      case "mol":
        return "mol";
      case "sdf":
        return "sdf";
      case "mol2":
        return "mol2";
      case "data":
        return "lammps_data";
      case "traj":
        return "lammps_traj_data";
      default:
        return undefined;
    }
  }

  function getMolstarCoordinatesFormat(
    filename: string
  ): BuiltInCoordinatesFormat | undefined {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "dcd":
        return "dcd";
      case "xtc":
        return "xtc";
      case "trr":
        return "trr";
      case "nc":
      case "nctraj":
        return "nctraj";
      case "lammpstrj":
      case "lammpstrjtxt":
        return "lammpstrj";
      default:
        return undefined;
    }
  }

  const handleTopologyFileSelect = async (file: File | null) => {
    if (!plugin) {
      console.warn("Plugin not ready yet!");
      return;
    }
    if (!file) return;

    const assetFile: Asset.File = {
      kind: "file",
      id: uuidv4() as UUID,
      name: file.name,
      file: file,
    };

    try {
      await plugin.init();
      const data = await plugin.builders.data.readFile({
        file: assetFile,
        label: file.name,
        isBinary: false,
      });

      const format: BuiltInTrajectoryFormat | undefined = getFormatByExtension(
        file.name
      );

      if (!format) {
        console.error("Unsupported topology file format");
        return;
      }

      const topology = await plugin.builders.structure.parseTrajectory(
        data.data.ref,
        format
      );

      const model = await plugin.builders.structure.createModel(topology);
      setTopologyModel(model);
      setIsStructureLoaded(true);

      const excludedTypes = [
        "gaussian-volume",
        "gaussian-surface",
        "ellipsoid",
        "carbohydrate",
      ];

      const filteredTypes =
        plugin.representation.structure.registry.types.filter(
          (name) => !excludedTypes.includes(name[0])
        );
      const models = await plugin.state.data.selectQ((q: any) =>
        q.ofType(PluginStateObject.Molecule.Model)
      );

      if (models.length > 0) {
        const ref = models[0].transform.ref;
        console.log("Structure loaded. Model ref:", ref);
        setModelRef(ref);
        return ref; // ← RETURN THE REF
      }

      setRepresentationTypes(filteredTypes);
      setSelectedRepresentation("default");

      console.log("Topology loaded successfully");
    } catch (error) {
      console.error("Error loading topology file:", error);
    }
  };

  const handleTrajectoryFileSelect = async (file: File | null) => {
    if (!plugin) {
      console.warn("Plugin not ready yet!");
      return;
    }
    if (!file || !isStructureLoaded) return;

    const assetFile: Asset.File = {
      kind: "file",
      id: uuidv4() as UUID,
      name: file.name,
      file: file,
    };

    try {
      const trajectoryData = await plugin.builders.data.readFile({
        file: assetFile,
        label: file.name,
        isBinary: true,
      });

      const format: BuiltInCoordinatesFormat | undefined =
        getMolstarCoordinatesFormat(file.name);

      if (!format) {
        console.error("Unsupported trajectory file format");
        return;
      }

      const result = await plugin.dataFormats
        .get(format)
        ?.parse(plugin, trajectoryData.data.ref);

      if (result?.ref) {
        setCordinateRef(result.ref);
        console.log("Trajectory loaded successfully");
      }
    } catch (error: any) {
      console.error("Error loading trajectory file:", error);
    }
  };

  const loadStructureRepresentation = async () => {
    if (!plugin || !topologyModel) {
      console.error("Plugin or topology model not ready");
      return null;
    }
    return modelRef;
  };

  const toggleTragractoryAnimation = async () => {
    if (!plugin) return;

    try {
      if (plugin.managers.animation.isAnimating) {
        await plugin.managers.animation.stop();
      } else {
        await plugin.managers.animation.start();
      }
    } catch (error) {
      console.error("Error toggling animation:", error);
    }
  };

  const handleToggleSpin = () => {
    if (!plugin?.canvas3d) {
      console.warn("Canvas not ready");
      return;
    }

    const newSpinState = !isSpinning;
    setIsSpinning(newSpinState);

    plugin.canvas3d.setProps({
      trackball: {
        animate: {
          name: "spin",
          params: {
            speed: newSpinState ? 0.27 : 0,
          },
        },
      },
    });
  };

  const handleChangeStructureColor = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newColorHex = event.target.value;
    setStructureColor(newColorHex);

    const intColor = parseInt(newColorHex.replace("#", "0x"));
    const newColor = Color(intColor);

    if (!plugin) return;

    const state = plugin.state.data;
    const structures = state.selectQ((q: any) =>
      q.ofType(PluginStateObject.Molecule.Structure)
    );

    if (structures.length === 0) return;

    await state
      .build()
      .to(structures[0])
      .applyOrUpdateTagged(
        "main-repr",
        StateTransforms.Representation.StructureRepresentation3D,
        {
          type: {
            name: selectedRepresentation || "cartoon",
            params: {},
          },
          colorTheme: {
            name: "uniform",
            params: { value: newColor },
          },
        }
      )
      .commit();
  };

  const handleSetRepresentation = async (type: string, color?: Color) => {
    if (!isStructureLoaded || !type || !plugin) {
      console.warn("No structure loaded or representation type provided");
      return;
    }

    setSelectedRepresentation(type);
    const colorToUse =
      color || Color(parseInt(structureColor.replace("#", "0x")));

    try {
      const state = plugin.state.data;
      const structures = state.selectQ((q: any) =>
        q.ofType(PluginStateObject.Molecule.Structure)
      );

      if (structures.length === 0) return;

      await state
        .build()
        .to(structures[0])
        .applyOrUpdateTagged(
          "main-repr",
          StateTransforms.Representation.StructureRepresentation3D,
          {
            type: {
              name: type,
              params: {},
            },
          }
        )
        .commit();
    } catch (error) {
      console.error(`Failed to set representation:`, error);
    }
  };

  const getModelRef = () => {
    return modelRef;
  };

  return {
    state: {
      isPluginReady,
      isSpinning,
      bgColor,
      structureColor,
      selectedRepresentation,
      isStructureLoaded,
      isStereoEnabled,
      frameCount,
      atomcount,
      plugin,
      modelRef,
    },
    handlers: {
      onTopologyFileSelect: handleTopologyFileSelect,
      onTrajectoryFileSelect: handleTrajectoryFileSelect,
      onToggleSpin: handleToggleSpin,
      onChangeStructureColor: handleChangeStructureColor,
      onSetRepresentation: (e: React.ChangeEvent<HTMLSelectElement>) =>
        handleSetRepresentation(e.target.value),
      toggleTragractoryAnimation: toggleTragractoryAnimation,
      loadStructureRepresentation: loadStructureRepresentation,
      getModelRef: getModelRef,
    },
  };
};
