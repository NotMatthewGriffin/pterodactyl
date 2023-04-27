import { Integer, task } from "../../pterodactyl.js";

const integerSumNumbers = task(function integerSumNumbers(a, b) {
  return a + b;
}, {
  paramTypes: [Integer, Integer],
  outputType: Integer,
});
