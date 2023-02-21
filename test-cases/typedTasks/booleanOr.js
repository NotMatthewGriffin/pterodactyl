import { task } from "../../pterodactyl.js";

const booleanOr = task(function booleanOr(left, right) {
  return left || right;
}, {
  paramTypes: [Boolean, Boolean],
  outputType: Boolean,
});
