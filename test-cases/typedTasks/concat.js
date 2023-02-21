import { task } from "../../pterodactyl.js";

const concatStrings = task(function concat(first, second) {
  return first + second;
}, {
  paramTypes: [String, String],
  outputType: String,
});
