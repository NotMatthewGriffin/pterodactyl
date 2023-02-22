import { task } from "../../pterodactyl.js";

const sumReturningDouble = task(function sumReturningDouble(a, b) {
  return a + b;
}, {
  outputType: "Double",
});
