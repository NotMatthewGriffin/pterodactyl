export const registrationObject = {};
const registrationModule = "pterodactyl_register.js";

export function task(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "task must recieve a function";
  }
  if (Deno.mainModule.endsWith(registrationModule)) {
    // should be able to retrieve registration location from cmdline arg
    console.log("Registering task");
    console.log(JSON.stringify(registrationObject.convertToTask(func)));
  }

  return (...args) => {
    if (args.length !== func.length) {
      throw `task function requires ${func.length} arguments but ${args.length} were provided`;
    }
    return func(...args);
  };
}

export function workflow(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "workflow must recieve a function";
  }
  if (Deno.mainModule.endsWith(registrationModule)) {
    console.log("Registering workflow");
  }

  return (...args) => {
    if (args.length !== func.length) {
      throw `workflow function requires ${func.length} arguments but ${args.length} were provided`;
    }
    return func(...args);
  };
}

const pterodactyl = { task: task, workflow: workflow };

export default pterodactyl;
