globalThis.pterodactylConfig = globalThis.pterodactylConfig ?? {
  taskTransformer: (f) => f,
  workflowTransformer: (f) => f,
};

export function task(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "task must recieve a function";
  }
  return window.pterodactylConfig.taskTransformer(func, options);
}

export function workflow(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "workflow must recieve a function";
  }
  return window.pterodactylConfig.workflowTransformer(func, options);
}

const pterodactyl = { task: task, workflow: workflow };

export default pterodactyl;
