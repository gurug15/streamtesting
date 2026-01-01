// lib/molstarStreaming.ts
import {
  Coordinates,
  QueryContext,
  StructureSelection,
  Time,
} from "molstar/lib/mol-model/structure";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { TrajectoryFromModelAndCoordinates } from "molstar/lib/mol-plugin-state/transforms/model";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { StateTransformer } from "molstar/lib/mol-state";
import { Task } from "molstar/lib/mol-task";
import { ParamDefinition } from "molstar/lib/mol-util/param-definition";
import { ProcessedFrame } from "@/hooks/useServerTrajectory";
import { compile } from "molstar/lib/mol-script/runtime/query/base";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { tmAlign } from "molstar/lib/mol-model/structure/structure/util/tm-align";
// import { TMAlign } from "molstar/lib/mol-math/linear-algebra/3d/tm-align";
const CreateTransformer = StateTransformer.builderFactory("custom");

export const CreateMyCoordinates = CreateTransformer({
  name: "create-coords",
  from: PluginStateObject.Root,
  to: PluginStateObject.Molecule.Coordinates,
  params: {
    data: ParamDefinition.Value<number[][]>([], { isHidden: true }),
  },
})({
  apply({ params }) {
    return Task.create("Create Trajectory", async (ctx) => {
      const coords = Coordinates.create(
        params.data.map((cs, i) => ({
          ...getCoords(cs),
          elementCount: cs.length / 3,
          time: Time(i, "step"),
          xyzOrdering: { isIdentity: true },
        })),
        Time(1, "step"),
        Time(0, "step")
      );

      return new PluginStateObject.Molecule.Coordinates(coords, {
        label: "label",
      });
    });
  },
});

function getCoords(data: number[]) {
  const len = data.length / 3;
  const x = new Float32Array(len);
  const y = new Float32Array(len);
  const z = new Float32Array(len);
  for (let i = 0, _i = data.length, o = 0; i < _i; i += 3) {
    x[o] = data[i];
    y[o] = data[i + 1];
    z[o] = data[i + 2];
    o++;
  }
  return { x, y, z };
}

export function convertFrameToMolstarFormat(
  frameData: ProcessedFrame
): number[] {
  const result: number[] = [];

  for (let i = 0; i < frameData.count; i++) {
    result.push(frameData.x[i]);
    result.push(frameData.y[i]);
    result.push(frameData.z[i]);
  }

  return result;
}

const COORDS_REF = "streaming-coords";
const TRAJ_REF = "streaming-traj";

export async function applyFrameToMolstar(
  plugin: PluginContext,
  modelRef: string,
  frameData: ProcessedFrame
) {
  try {
    const molstarCoords = convertFrameToMolstarFormat(frameData);
    const coordinatesArray = [molstarCoords];

    // Step 1: Update coords
    await plugin
      .build()
      .toRoot()
      .applyOrUpdate(COORDS_REF, CreateMyCoordinates, {
        data: coordinatesArray,
      })
      .commit();

    // Step 2: Update trajectory
    const state = plugin.state.data;
    const trajectoryExisted = state.cells.has(TRAJ_REF);
    await plugin
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

    // Step 3: Preset only initial
    if (!trajectoryExisted) {
      await plugin.builders.structure.hierarchy.applyPreset(
        TRAJ_REF,
        "default"
      );
    }

    // ← FIX: Force canvas redraw after update (key for animation visibility)
    if (plugin.canvas3d) {
      plugin.canvas3d.requestDraw(); // Async full redraw
    }
    return TRAJ_REF;
  } catch (err) {
    console.error("Error applying frame to mol*:", err);
    throw err;
  }
}

export async function superimposeStructures(
  plugin: PluginContext,
  streamingStructureRef: string
  // referenceStructureRef: string
): Promise<any> {
  // ): Promise<{ tmScore: number; rmsd: number }> {
  try {
    const streamingStructure = plugin.state.data.selectQ(
      (q: any) => q.byRef(streamingStructureRef) //.ofType(PluginStateObject.Molecule.Structure)
    );

    // const referenceStructure = plugin.state.data.selectQ(
    //   (q: any) => q.byRef(referenceStructureRef) //.ofType(PluginStateObject.Molecule.Structure)
    // );
    console.log("streamingStructure type:", typeof streamingStructure);
    console.log(
      "streamingStructure keys:",
      Object.keys(streamingStructure || {})
    );
    console.log("streamingStructure:", streamingStructure);
    // if (!streamingStructure?.obj?.data || !referenceStructure?.obj?.data) {
    //   throw new Error("Structures not found in state");
    // }

    // Query for C-alpha atoms
    const caQuery = compile<StructureSelection>(
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

    // const sel1 = StructureSelection.toLociWithCurrentUnits(
    //   caQuery(new QueryContext(referenceStructure.obj.data))
    // );
    // const sel2 = StructureSelection.toLociWithCurrentUnits(
    //   caQuery(new QueryContext(streamingStructure.obj.data))
    // );

    // Extract positions
    // // const posA = extractPositions(sel1);
    // const posB = extractPositions(sel2);

    // Run TM-align
    // const result = TMAlign.compute({
    //   a: posA,
    //   b: posB,
    // });

    // Apply transformation
    // const b = plugin.state.data
    //   .build()
    //   .to(streamingStructureRef)
    //   .insert(StateTransforms.Model.TransformStructureConformation, {
    //     transform: {
    //       name: "matrix",
    //       params: {
    //         data: result.bTransform,
    //         transpose: false,
    //       },
    //     },
    //   });

    // await plugin.runTask(plugin.state.data.updateTree(b));

    // if (plugin.canvas3d) {
    //   plugin.canvas3d.requestDraw();
    // }

    // return {
    //   tmScore: result.tmScoreA,
    //   rmsd: result.rmsd,
    // };
  } catch (err) {
    console.error("Error superimposing structures:", err);
    throw err;
  }
}

// function extractPositions(loci: any): TMAlign.Positions {
//   // Extract x, y, z arrays from loci
//   // Adjust based on your actual data structure
//   const x: number[] = [];
//   const y: number[] = [];
//   const z: number[] = [];

//   // Your extraction logic here

//   return { x, y, z };
// }
