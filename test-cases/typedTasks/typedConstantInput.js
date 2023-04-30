import { Integer, task, workflow } from "../../pterodactyl.js";

const addNumbers = task(function addNumbers(a, b) {
  return a + b;
}, {
  paramTypes: [Number, Number],
  outputType: Number,
});

workflow(function addNumbersWorkflow() {
  addNumbers(1, 2);
  return 3;
}, {
  outputType: Number,
});

const not = task(function not(a) {
  return !a;
}, {
  paramTypes: [Boolean],
  outputType: Boolean,
});

workflow(function notWorkflow() {
  not(true);
  return false;
}, {
  outputType: Boolean,
});

const joinStrings = task(function joinStrings(a, b) {
  return a + b;
}, {
  paramTypes: [String, String],
  outputType: String,
});

workflow(function joinStringsWorkflow() {
  joinStrings("hello", "world");
  return "hello world";
}, {
  outputType: String,
});

const addIntegers = task(function addIntegers(a, b) {
  return a + b;
}, {
  paramTypes: [Integer, Integer],
  outputType: Integer,
});

workflow(function addIntegersWorkflow() {
  addIntegers(1, 2);
  return 1;
}, {
  outputType: Integer,
});
