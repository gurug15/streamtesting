// lib/molstarStreaming.ts
import { Coordinates, Time } from "molstar/lib/mol-model/structure";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { TrajectoryFromModelAndCoordinates } from "molstar/lib/mol-plugin-state/transforms/model";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { StateTransformer } from "molstar/lib/mol-state";
import { Task } from "molstar/lib/mol-task";
import { ParamDefinition } from "molstar/lib/mol-util/param-definition";
import { ProcessedFrame } from "@/hooks/useServerTrajectory";

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
