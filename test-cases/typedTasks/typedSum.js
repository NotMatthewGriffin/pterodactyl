import { task, workflow } from "../../pterodactyl.js";

const sumNumbers = task(function sumNumbers(a, b) {
	return a + b;
}, {
	paramTypes: [Number, Number]
});

const squareNumbers = task(function squareNumbers(a) {
	return a * a;
}, {
	paramTypes: [Number]
});

const sumOfSquaredNumbers = workflow(function sumOfSquaredNumbers(a, b) {
	return sumNumbers(squareNumbers(a), squareNumbers(b));
});

if (import.meta.main) {
	console.log(sumOfSquaredNumbers(5, 6));
}
