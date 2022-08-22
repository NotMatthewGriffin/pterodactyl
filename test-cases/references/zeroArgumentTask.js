import pterodactyl from "../../pterodactyl.js";

const zeroArgumentTask = pterodactyl.task(function noArgs() {
  return 0;
});

const zeroArgumentWorkflow = pterodactyl.workflow(function noArgs() {
  return zeroArgumentTask();
});
