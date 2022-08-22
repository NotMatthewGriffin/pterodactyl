import { taskReference, workflow } from "../../pterodactyl.js";

const taskRef = taskReference({
  project: "flytesnacks",
  domain: "development",
  version: "v1",
  name: "noArgs",
});

const testcase = workflow(function usesNoArgsTaskReference() {
  return taskRef();
});
