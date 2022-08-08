import { workflow } from "../../pterodactyl.js";

const myWorkflow = workflow(function constantOutput() {
  return 1;
});
