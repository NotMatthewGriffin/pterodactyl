import pterodactyl from "../../pterodactyl.js";

const CIf = () => 10;
const fTask = pterodactyl.task(CIf);

const CImul10 = (val) => val * 10;
const mul10Task = pterodactyl.task(CImul10);

const workflow = pterodactyl.workflow(function constantInput() {
  return mul10Task(CIf());
});

if (import.meta.main) {
  console.log(workflow());
}
