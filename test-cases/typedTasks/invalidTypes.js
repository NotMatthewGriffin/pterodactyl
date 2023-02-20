import { task } from "../../pterodactyl.js";

const sumDoubles = task(function sumDoubles(a, b) {
  return a + b;
}, {
  paramTypes: ["Double", "Double"],
});
