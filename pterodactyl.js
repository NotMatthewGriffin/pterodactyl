globalThis.pterodactylConfig = globalThis.pterodactylConfig ?? {
  taskTransformer: (f) => f,
  workflowTransformer: (f) => f,
  taskReferenceTransformer: ({ project, domain, name, version }) => () => { throw "taskReference can't be used locally"},
};

export function task(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "task must recieve a function";
  }
  return window.pterodactylConfig.taskTransformer(func, options);
}

export function taskReference({ project, domain, name, version }) {
  if (!(project && domain && name && version)) {
    throw "taskReference must recieve project, domain, name, and version";
  }
  return window.pterodactylConfig.taskReferenceTransformer({
    project,
    domain,
    name,
    version,
  });
}

export function workflow(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "workflow must recieve a function";
  }
  return window.pterodactylConfig.workflowTransformer(func, options);
}

const pterodactyl = {
  task: task,
  taskReference: taskReference,
  workflow: workflow,
};

export default pterodactyl;
