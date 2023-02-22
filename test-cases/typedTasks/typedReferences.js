import {
  launchPlanReference,
  taskReference,
  workflow,
} from "../../pterodactyl.js";

const taskRef = taskReference({
  project: "flytesnacks",
  domain: "development",
  version: "v1",
  name: "sumNumbers",
});

const workflowRef = launchPlanReference({
  project: "flytesnacks",
  domain: "development",
  version: "v1",
  name: "sumOfSquaredNumbers",
});

workflow(function usesTypedReferences() {
  let sumResult = taskRef({ input0: 1, input1: 1 });
  return workflowRef({ input0: sumResult, input1: 3 });
}, {
  outputType: Number,
});
