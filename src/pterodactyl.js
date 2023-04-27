globalThis.pterodactylConfig = globalThis.pterodactylConfig ?? {
  taskTransformer: (f) => f,
  workflowTransformer: (f) => f,
  taskReferenceTransformer: ({ project, domain, name, version }) => () => {
    throw "taskReference can't be used locally";
  },
  launchPlanReferenceTransformer:
    ({ project, domain, name, version }) => () => {
      throw "launchPlanReference can't be used locally";
    },
};

/**
 * Annotates a function as a task to be registered when provided to the
 * pterodactyl_register script. If a script is executed normally this will
 * return the provided function back to the caller.
 * @param {function} func - Function to annotate as a task.
 * @param {Object} options - Options to change the behavior of the registerd task.
 * @returns {function} A task annotated function
 */
export function task(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "task must recieve a function";
  }
  return window.pterodactylConfig.taskTransformer(func, options);
}

/**
 * Creates a task reference that can be used in a workflow annotated function
 * to utilize an existing flyte task in a workflow. Only works when script
 * is used as input to pterodactyl_register script. When called during
 * local execution it throws.
 * @param {Object} taskId - Id for the task to reference.
 * @param {string} taskId.project - Project containing the task.
 * @param {string} taskId.domain - Domain containing the task.
 * @param {string} taskId.name - Name of the task.
 * @param {string} taskId.version - Version of the task.
 * @returns {function} A task reference
 */
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

/**
 * Creates a launch plan reference that can be used in a workkflow annotated
 * function to utilize an existing flyte launch plan in a workflow. Only
 * works when script is used as input to pterodactyl_register script. When
 * called during local execution it throws.
 * @param {Object} launchPlanId - Id for the launch plan to reference.
 * @param {string} launchPlanId.project - Project containing the launch plan.
 * @param {string} launchPlanId.domain - Domain containing the launch plan.
 * @param {string} launchPlanId.name - Name of the launch plan.
 * @param {string} launchPlanId.version - Version of the launch plan.
 * @returns {function} A launch plan reference
 */
export function launchPlanReference({ project, domain, name, version }) {
  if (!(project && domain && name && version)) {
    throw "launchPlanReference must recieve project, domain, name, and version";
  }
  return window.pterodactylConfig.launchPlanReferenceTransformer({
    project,
    domain,
    name,
    version,
  });
}

/**
 * Annotates a function a a workflow to be registered when provided to the
 * pterodactyl_register script. If a script is executed normally this will
 * return the provided function back to the caller.
 * @param {function} func - Function to annotate as a workflow.
 * @param {Object} options - Options to change the behavior of the registered workflow
 * @returns {function} A workflow annotated function
 */
export function workflow(func, options = {}) {
  if (typeof (func) !== "function") {
    throw "workflow must recieve a function";
  }
  return window.pterodactylConfig.workflowTransformer(func, options);
}

/**
 * Flyte supports integer as a datatype but there is not a javascript type
 * available like Number, Boolean, or String. This constant's purpose is to be
 * used as a type when specifying input and output types.
 */
export const Integer = Number.parseInt;

const pterodactyl = {
  task,
  taskReference,
  launchPlanReference,
  workflow,
  Integer,
};

export default pterodactyl;
