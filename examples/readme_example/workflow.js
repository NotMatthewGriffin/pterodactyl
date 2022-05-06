import {
  task,
  workflow,
} from "https://raw.githubusercontent.com/NotMatthewGriffin/pterodactyl/main/pterodactyl.js";

const sum = task(function sum(x, y) {
  return x + y;
});

const square = task(function square(z) {
  return z * z;
});

const myWorkflow = workflow(function myWorkflow(x, y) {
  return sum(square(x), square(y));
});
