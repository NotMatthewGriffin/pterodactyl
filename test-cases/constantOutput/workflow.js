import { task, workflow } from "../../pterodactyl.js";

const myTask = task(function waitForThis() {
  return "done";
});

const myWorkflow = workflow(function constantOutput() {
  myTask();
  return 1;
});
