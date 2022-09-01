import pterodactyl from "../../pterodactyl.js";

const f = () => 10;
const fTask = pterodactyl.task(f);

const mul10 = (val) => val * 10;
const mul10Task = pterodactyl.task(mul10);

const workflow = pterodactyl.workflow(function constantInput() {
  return mul10Task(f());
});

if (import.meta.main) {
  console.log(workflow());
}
