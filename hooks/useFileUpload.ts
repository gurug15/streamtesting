import { Coordinates, Time } from "molstar/lib/mol-model/structure";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { TrajectoryFromModelAndCoordinates } from "molstar/lib/mol-plugin-state/transforms/model";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { StateTransformer } from "molstar/lib/mol-state";
import { Task } from "molstar/lib/mol-task";

import { ParamDefinition } from "molstar/lib/mol-util/param-definition";

const CreateTransformer = StateTransformer.builderFactory("custom");

const CreateMyCoordinates = CreateTransformer({
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

async function createMyObjects(
  plugin: PluginContext,
  pdbData: string,
  coordinates: number[][]
) {
  const _pdbData = await plugin.builders.data.rawData({
    data: pdbData,
    label: "...",
  });
  const pdbTrajectory = await plugin.builders.structure.parseTrajectory(
    _pdbData,
    "pdb"
  );
  const pdbModel = await plugin.builders.structure.createModel(pdbTrajectory);

  const coords = await plugin
    .build()
    .toRoot()
    .apply(CreateMyCoordinates, { data: coordinates })
    .commit();

  const trajectory = await plugin
    .build()
    .toRoot()
    .apply(
      TrajectoryFromModelAndCoordinates,
      {
        modelRef: pdbModel.ref,
        coordinatesRef: coords.ref,
      },
      { dependsOn: [pdbModel.ref, coords.ref] }
    )
    .commit();

  await plugin.builders.structure.hierarchy.applyPreset(
    trajectory,
    "all-models"
  );
}
