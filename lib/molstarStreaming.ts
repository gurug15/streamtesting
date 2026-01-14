"use client";
// lib/molstarStreaming.ts
import {
  Coordinates,
  Time,
  StructureSelection,
  QueryContext,
} from "molstar/lib/mol-model/structure";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { TrajectoryFromModelAndCoordinates } from "molstar/lib/mol-plugin-state/transforms/model";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { StateTransformer } from "molstar/lib/mol-state";
import { Task } from "molstar/lib/mol-task";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";
import { Asset } from "molstar/lib/mol-util/assets";
import { UUID } from "molstar/lib/mol-util";
import { v4 as uuidv4 } from "uuid";
import { BuiltInTrajectoryFormat } from "molstar/lib/mol-plugin-state/formats/trajectory";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { tmAlign } from "molstar/lib/mol-model/structure/structure/util/tm-align";
import { compile } from "molstar/lib/mol-script/runtime/query/compiler";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { ProcessedFrame } from "./types";

// --- Constants & Pre-compiled Queries ---

const COORDS_REF = "streaming-coords";
const TRAJ_REF = "streaming-traj";

// Compile this once statically to avoid recompilation on every alignment call
const CA_QUERY = compile<StructureSelection>(
  MS.struct.generator.atomGroups({
    "chain-test": MS.core.rel.eq([
      MS.struct.atomProperty.macromolecular.auth_asym_id(),
      "A",
    ]),
    "atom-test": MS.core.rel.eq([
      MS.struct.atomProperty.macromolecular.label_atom_id(),
      "CA",
    ]),
  })
);

// --- Custom Transformer ---

const CreateTransformer = StateTransformer.builderFactory("custom");

/**
 * Optimized Transformer: Accepts x, y, z arrays directly (Structure of Arrays)
 * to avoid expensive reshaping of data during high-frequency streaming.
 */
export const CreateMyCoordinates = CreateTransformer({
  name: "create-coords",
  from: PluginStateObject.Root,
  to: PluginStateObject.Molecule.Coordinates,
  params: {
    x: PD.Value<Float32Array | number[]>([], { isHidden: true }),
    y: PD.Value<Float32Array | number[]>([], { isHidden: true }),
    z: PD.Value<Float32Array | number[]>([], { isHidden: true }),
    count: PD.Numeric(0, undefined, { isHidden: true }),
  },
})({
  apply({ params }) {
    return Task.create("Create Trajectory", async () => {
      // Create coordinates directly from passed buffers without intermediate copies
      const coords = Coordinates.create(
        [
          {
            x: params.x as any, // Mol* handles array-likes efficiently
            y: params.y as any,
            z: params.z as any,
            elementCount: params.count,
            time: Time(0, "step"),
            xyzOrdering: { isIdentity: true },
          },
        ],
        Time(1, "step"),
        Time(0, "step")
      );

      return new PluginStateObject.Molecule.Coordinates(coords, {
        label: "StreamCoords",
      });
    });
  },
});

// --- Main Functions ---

export async function applyFrameToMolstar(
  plugin: PluginContext,
  modelRef: string,
  frameData: ProcessedFrame
) {
  try {
    // Step 1: Update coords using the optimized transformer
    // Directly passing frameData arrays avoids the O(n) loop of convertFrameToMolstarFormat
    await plugin
      .build()
      .toRoot()
      .applyOrUpdate(COORDS_REF, CreateMyCoordinates, {
        x: frameData.x,
        y: frameData.y,
        z: frameData.z,
        count: frameData.count,
      })
      .commit();

    // Step 2: Update trajectory
    const state = plugin.state.data;
    const trajectoryExisted = state.cells.has(TRAJ_REF);
    const trajectoryCellRef = state.cells.get(TRAJ_REF);

    // We bind the modelRef (topology) with the new COORDS_REF (geometry)
    const data = await plugin
      .build()
      .toRoot()
      .applyOrUpdate(
        TRAJ_REF,
        TrajectoryFromModelAndCoordinates,
        {
          modelRef: modelRef,
          coordinatesRef: COORDS_REF,
        },
        { dependsOn: [modelRef, COORDS_REF] }
      )
      .commit();
    console.log("updateded data of traj file", data);
    console.log("trajectory ref", trajectoryCellRef);
    // console.log("isthis required data", data.cell?.obj);
    let streamingStructureRef: string | null = null;
    // Step 3: Preset only initial
    if (!trajectoryExisted) {
      await plugin.builders.structure.hierarchy.applyPreset(
        TRAJ_REF,
        "default"
      );
    }
    console.log("TRAJREF", TRAJ_REF);
    // Note: Creating a new structure on every frame can be expensive.
    // If logic permits, consider updating an existing structure ref instead.
    const structureRef = await plugin.builders.structure.createStructure(
      modelRef,
      {
        name: "auto",
        params: {
          dynamicBonds: true,
        },
      }
    );

    // Force canvas redraw
    if (plugin.canvas3d) {
      plugin.canvas3d.requestDraw();
    }

    return { structureRef };
  } catch (err) {
    // console.error("Error applying frame to mol*:", err);
    throw err;
  }
}

export async function loadReferenceStructure(
  plugin: PluginContext,
  pdbFile: File,
  referenceLabel: string = "Reference Structure"
): Promise<any> {
  try {
    const assetFile: Asset.File = {
      kind: "file",
      id: uuidv4() as UUID,
      name: pdbFile.name,
      file: pdbFile,
    };

    // Read file
    const data = await plugin.builders.data.readFile({
      file: assetFile,
      label: pdbFile.name,
      isBinary: false,
    });

    // Determine format
    const format = getFormatByExtension(pdbFile.name);

    // Parse trajectory
    const structure = await plugin.builders.structure.parseTrajectory(
      data.data.ref,
      format!
    );

    // Create model
    const model = await plugin.builders.structure.createModel(structure);

    const structureRef = await plugin.builders.structure.createStructure(
      model,
      {
        name: "auto",
        params: {
          dynamicBonds: true,
        },
      }
    );

    // console.log("structure ref: ", structureRef);

    // Apply preset
    await plugin.builders.structure.hierarchy.applyPreset(structure, "default");

    if (plugin.canvas3d) {
      plugin.canvas3d.requestDraw();
    }

    // console.log("Reference structure loaded:", structureRef);
    return { structureRef, structure };
  } catch (err) {
    // console.error("Error loading reference structure:", err);
    throw err;
  }
}

export async function alignStructures(
  plugin: PluginContext,
  structure1: any,
  structure2: any
) {
  try {
    // Extract the actual structure data
    const data1 = structure1?.cell?.obj?.data;
    const data2 = structure2?.cell?.obj?.data;

    if (!data1 || !data2) {
      throw new Error("Invalid structure objects - missing data");
    }

    // Get the ref strings
    const struct2Ref = structure2?.ref;
    if (!struct2Ref) {
      throw new Error("Cannot find structure2 ref");
    }

    // Optimized: Query compilation moved to module scope (CA_QUERY)
    // Removed the atom name logging loop (1000 iterations saved)

    const sel1 = StructureSelection.toLociWithCurrentUnits(
      CA_QUERY(new QueryContext(data1))
    );
    const sel2 = StructureSelection.toLociWithCurrentUnits(
      CA_QUERY(new QueryContext(data2))
    );

    // console.log("Selection 1 aligned atoms:", sel1.elements?.length || 0);
    // console.log("Selection 2 aligned atoms:", sel2.elements?.length || 0);

    // Run TM-align
    const result = tmAlign(sel1, sel2);
    console.log("TM-Align result:", result);
    // console.log("Aligned length:", result.alignedLength);
    // console.log("TM-score:", result.tmScoreA, result.tmScoreB);
    // console.log("RMSD:", result.rmsd);

    if (result.alignedLength === 0) {
      // console.warn("⚠️ No atoms aligned");
      return result;
    }

    // Apply transformation
    const b = plugin.state.data
      .build()
      .to(struct2Ref)
      .insert(StateTransforms.Model.TransformStructureConformation, {
        transform: {
          name: "matrix",
          params: { data: result.bTransform, transpose: false },
        },
      });

    await plugin.runTask(plugin.state.data.updateTree(b));
    // console.log("✓ Structures superimposed");

    return result;
  } catch (err) {
    // console.error("Alignment error:", err);
    throw err;
  }
}

// --- Helpers ---

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
