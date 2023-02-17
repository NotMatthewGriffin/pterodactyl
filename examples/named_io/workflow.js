import {
  task,
  workflow,
} from "https://raw.githubusercontent.com/NotMatthewGriffin/pterodactyl/main/pterodactyl.js";

const sum = task(function sum(x, y) {
  return x + y;
}, {
	paramNames: ["x", "y"],
	outputName: "result"
});

const square = task(function square(z) {
  return z * z;
}, {
	paramNames: ["z"],
	outputName: "squared"
});

const sumOfSquares = workflow(function sumOfSquares(x, y) {
  return sum(square(x), square(y));
}, {
	paramNames: ["left", "right"], // these names will be used in flyte console
	outputName: "sumOfSquares"
});

if (import.meta.main) {
	console.log(sumOfSquares(5, 6));
}
