import { taskReference, workflow } from "../../pterodactyl.js";

const taskRef = taskReference({
  project: "flytesnacks",
  domain: "development",
  version: "v1",
  name: "sum",
});

const testcase = workflow(function usesTaskReferenceNamedArgument(a, b) {
  return taskRef({ input0: a, input1: b });
});
