import pterodactyl from "../../pterodactyl.js";

const sumTask = pterodactyl.task(function sum(a, b) {
  return a+b;
});

const sumWorkflow = pterodactyl.workflow(function sum(a, b) {
  return sumTask(a, b);
});

if (import.meta.main) {
  console.log(sumWorkflow(10, 20));
}
