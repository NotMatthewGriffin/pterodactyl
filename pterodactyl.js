export const configObj = {
  taskTransformer: (f) => f,
  workflowTransformer: (f) => f,
};

export function task(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "task must recieve a function";
  }
  return configObj.taskTransformer(func);
}

export function workflow(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "workflow must recieve a function";
  }
  return configObj.workflowTransformer(func);
}

const pterodactyl = { task: task, workflow: workflow };

export default pterodactyl;
