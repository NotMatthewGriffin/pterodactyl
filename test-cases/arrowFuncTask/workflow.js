import pterodactyl from "../../pterodactyl.js";

const f = () => 10;
const fTask = pterodactyl.task(f);

const mul10 = (val) => val * 10;
const mul10Task = pterodactyl.task(mul10);

const arrowFuncWorkflow = () => mul10Task(fTask());
const workflow = pterodactyl.workflow(arrowFuncWorkflow);

if (import.meta.main) {
  console.log(workflow());
}
