import pterodactyl from "../../pterodactyl.js";

const exponential = pterodactyl.task(function exponential(p1) {
  return p1 ** p1;
}, { paramNames: ["p1"] });

const multiply = pterodactyl.task(function multiply(p1, p2) {
  return p1 * p2;
}, { paramNames: ["p1", "p2"] });

const workflow1 = pterodactyl.workflow(function w1(input1, input2) {
  return exponential(multiply(input1, input2));
});

const workflow2 = pterodactyl.workflow(function w2(input1) {
  return exponential(input1);
});

if (import.meta.main) {
  console.log(workflow2(2));
}
