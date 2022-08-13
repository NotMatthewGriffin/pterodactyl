import { launchPlanReference, workflow } from "../../pterodactyl.js";

const workflowRef = launchPlanReference({
  project: "flytesnacks",
  domain: "development",
  version: "v1",
  name: "sum",
});

const testcase = workflow(function usesLaunchPlan(a, b) {
  const r1 = workflowRef({ input0: a, input1: b });
  return workflowRef({ input0: r1, input1: b });
});
