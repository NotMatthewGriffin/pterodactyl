import { taskReference, workflow } from "../../pterodactyl.js";

const taskRef = taskReference({
  project: "flytesnacks",
  domain: "development",
  version: "v1",
  name: "sum",
});

const testcase = workflow(function usesTaskReference(a, b) {
  return taskRef(a, b);
});
