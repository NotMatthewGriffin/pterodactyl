import * as _ from "./pterodactyl.js";

const AsyncFunction = (async () => {}).constructor;

export function isSerializable(value) {
  const isPlainObj = Object.getPrototypeOf(value) == Object.getPrototypeOf({});
  if (isPlainObj) {
    return Object.values(value).every(isSerializable);
  }

  const isArray = Array.isArray(value);
  if (isArray) {
    return value.every(isSerializable);
  }

  return typeof value === "string" ||
    typeof value === "boolean" || typeof value === "number";
}

class PromiseBinding {
  constructor({ promiseNodeId, outputName }) {
    this.promiseNodeId = promiseNodeId;
    this.outputName = outputName;
  }

  bindingObj() {
    return {
      binding: {
        promise: {
          node_id: this.promiseNodeId,
          var: this.outputName,
        },
      },
    };
  }
}

class PrimitiveBinding {
  constructor(value) {
    this.value = value;
  }

  bindingObj() {
    return {
      binding: {
        scalar: {
          primitive: {
            string_value: JSON.stringify(this.value),
          },
        },
      },
    };
  }
}

function getNameFromFunction(f) {
  if (!f.name) {
    throw "Functions must be named";
  }
  return f.name;
}

function generateVariable(variableName) {
  return {
    [variableName]: {
      type: {
        simple: "STRING",
      },
      description: variableName,
    },
  };
}

function generateAllVariables(name, count) {
  let variables = {};
  for (let i = 0; i < count; i++) {
    variables = { ...variables, ...generateVariable(name + i) };
  }
  return variables;
}

function generateAllNamedVariables(names) {
  let variables = {};
  for (let name of names) {
    variables = { ...variables, ...generateVariable(name) };
  }
  return variables;
}

function getExecutionScript() {
  if (import.meta.url.startsWith("file://")) {
    return "pterodactyl_execute.js";
  }
  return import.meta.url.split("/").slice(0, -1).join("/") +
    "/../pterodactyl_execute.js";
}

function generateContainer(pkg, image, taskName) {
  const inputDir = "/var/inputs";
  const outputDir = "/var/outputs";

  return {
    image: image,
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-net",
      getExecutionScript(),
      "--pkgs",
      pkg,
      "--task",
      taskName,
      "--inputdir",
      inputDir,
      "--outputdir",
      outputDir,
    ],
    resources: {},
    env: [],
    data_config: {
      enabled: true,
      input_path: inputDir,
      output_path: outputDir,
    },
  };
}

function checkParamNames(options, inputCount) {
  checkParamNamesCardinality(options, inputCount);
  checkParamNamesContent(options);
}

function checkParamNamesCardinality(options, inputCount) {
  if (options?.paramNames && options.paramNames.length != inputCount) {
    throw `Provided paramNames array does not match function parameter count; function has ${inputCount} parameters, provided ${options.paramNames.length} paramNames`;
  }
}

function checkParamNamesContent(options) {
  if (
    options?.paramNames &&
    options.paramNames.filter((name) => name.includes(",")).length > 0
  ) {
    throw "Provided paramNames array contain entries with commas; paramNames entries cannot include commas";
  }
  if (
    options?.paramNames &&
    options.paramNames.filter((name) => name == "").length > 0
  ) {
    throw "Provided paramNames array contain empty entries; paramNames entries cannot be empty";
  }
  if (
    options?.paramNames &&
    options.paramNames.length != (new Set(options.paramNames)).size
  ) {
    throw "Provided paramNames array contain duplicate entries; paramNames entries cannot be duplicates";
  }
}

function checkOutputName(options) {
  if (options?.outputName && typeof options.outputName != "string") {
    throw "outputName option must be a string";
  }
}

function convertToTask(
  pkg,
  image,
  project,
  domain,
  version,
  f,
  options,
) {
  const taskName = getNameFromFunction(f);
  const inputCount = f.length;
  checkParamNames(options, inputCount);
  checkOutputName(options);

  const inputs = options?.paramNames
    ? generateAllNamedVariables(options.paramNames)
    : generateAllVariables("input", inputCount);
  const output = options?.outputName
    ? generateAllNamedVariables([options.outputName])
    : generateAllVariables("output", 1);

  return [taskName, {
    id: {
      resource_type: "TASK",
      project: project,
      domain: domain,
      name: taskName,
      version: version,
    },
    spec: {
      template: {
        type: "javascript-task",
        metadata: {
          runtime: {
            type: "OTHER",
            version: "0.0.7",
            flavor: "pterodactyl",
          },
          retries: {},
          ...("cache_version" in options
            ? {
              discoverable: true,
              discovery_version: options.cache_version.toString(),
            }
            : {}),
        },
        interface: {
          inputs: {
            variables: inputs,
          },
          outputs: {
            variables: output,
          },
        },
        container: generateContainer(pkg, image, taskName),
        config: {
          inputOrder: Object.keys(inputs).join(","),
          ...Object.fromEntries(
            Object.keys(inputs).map((name) => [`input-${name}`, "untyped"]),
          ),
          ...Object.fromEntries(
            Object.keys(output).map((name) => [`output-${name}`, "untyped"]),
          ),
        },
      },
    },
  }];
}

function getOutputNameFromTask(task) {
  const outputNames = Object.keys(
    task.spec.template.interface.outputs.variables,
  );
  if (outputNames.length != 1) {
    throw "Unexpected number of ouputs";
  }
  return outputNames[0];
}

function getOutputNameFromLaunchPlan(launchPlan) {
  const outputNames = Object.keys(
    launchPlan.closure.expected_outputs.variables,
  );
  if (outputNames.length != 1) {
    throw "Unexpected number of outputs";
  }
  return outputNames[0];
}

function inputCaptureObj(registeredObjs, callsObj, name, isAsync) {
  let captureObj = (...args) => {
    const reference = registeredObjs.tasks[name];
    let passedArguments = passedArgumentsWithInputOrder(reference, args, "task", name);
    if (!callsObj[name]) {
      callsObj[name] = [];
    }
    callsObj[name].push(passedArguments);
    return new PromiseBinding({
      promiseNodeId: `${name}-${callsObj[name].length - 1}`,
      outputName: getOutputNameFromTask(reference),
    });
  };
  if (isAsync) {
    return async (...args) => captureObj(...args);
  }
  return captureObj;
}

function sameValues(arr1, arr2) {
  if (arr1.length != arr2.length) {
    return false;
  }
  arr1.sort();
  arr2.sort();
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] != arr2[i]) {
      return false;
    }
  }
  return true;
}

function passedArgumentsWithInputOrder(reference, args, recieverTypeName, name) {
  let passedArguments = [];
  const inputOrder = reference.spec.template.config?.inputOrder.split(",");
  if (inputOrder.length == 1 && inputOrder[0] == "") {
    inputOrder.pop();
  }
  if (
    inputOrder.length !=
      Object.keys(reference.spec.template.interface.inputs.variables).length
  ) {
    throw `Length of inputs in input order does not match ${recieverTypeName} interface`;
  }
  if (inputOrder.length != args.length) {
    throw `Wrong number of inputs recieved by ${recieverTypeName}; takes ${inputOrder.length}, recieved ${args.length}`;
  }
  for (let i = 0; i < inputOrder.length; i++) {
    let [paramName, arg] = [inputOrder[i], args[i]];
    if (arg instanceof Promise) {
      throw `${recieverTypeName[0].toUpperCase() + recieverTypeName.slice(1)} cannot take Promises as input`;
    }
    if (!(arg instanceof PromiseBinding)) {
      if (isSerializable(arg)) {
	arg = new PrimitiveBinding(arg);
      } else {
	throw `Argument for parameter ${paramName} of ${recieverTypeName} ${name} is not a task output or workflow input`;
      }
    }
    passedArguments.push([paramName, arg]);
  }
  return passedArguments;
}

function passedArgumentsWithoutInputOrder(reference, args) {
  let passedArguments = [];
  const expected_inputs = reference.spec.template.interface.inputs.variables
    ? Object.keys(
      reference.spec.template.interface.inputs.variables,
    )
    : [];
  if (
    (expected_inputs.length == 0 &&
      !(args.length == 0 ||
        args.length == 1 && Object.keys(args[0]).length == 0)) ||
    (expected_inputs.length > 0 &&
      (args.length != 1 ||
        !sameValues(Object.keys(args[0]), expected_inputs)))
  ) {
    const expectedError = expected_inputs.length
      ? `only properties: ${expected_inputs}`
      : "no properties";
    throw `Incorrect number of inputs to task reference without an inputOrder config; expected object with ${expectedError}`;
  }
  for (let paramName of expected_inputs) {
    let arg = args[0][paramName];
    if (arg instanceof Promise) {
      throw "Tasks cannot take Promises as input";
    }
    if (!(arg instanceof PromiseBinding)) {
      if (isSerializable(arg)) {
	arg = new PrimitiveBinding(arg);
      } else {
	throw `Argument for parameter ${paramName} of task reference ${name} is not a task output or workflow input`;
      }
    }

    passedArguments.push([paramName, arg]);
  }
  return passedArguments;
}

function taskReferenceInputCaptureObj(registeredObjs, callsObj, name) {
  return (...args) => {
    let passedArguments = [];
    const reference = registeredObjs.taskReferences[name];
    try {
      passedArguments = passedArgumentsWithoutInputOrder(reference, args);
    } catch (e) {
      if (reference.spec.template.config?.inputOrder) {
        passedArguments = passedArgumentsWithInputOrder(reference, args, "task reference", name);
      } else {
        throw e;
      }
    }
    if (!callsObj[name]) {
      callsObj[name] = [];
    }
    callsObj[name].push(passedArguments);
    return new PromiseBinding({
      promiseNodeId: `${name}-${callsObj[name].length - 1}`,
      outputName: getOutputNameFromTask(reference),
    });
  };
}

function launchPlanReferenceInputCaptureObj(registeredObjs, callsObj, name) {
  return (...args) => {
    let passedArguments = [];
    const reference = registeredObjs.launchPlanReferences[name];
    const expected_inputs = reference.closure.expected_inputs.parameters
      ? Object.keys(reference.closure.expected_inputs.parameters)
      : [];
    if (
      (expected_inputs.length == 0 &&
        !(args.length == 0 ||
          args.length == 1 && Object.keys(args[0]).length == 0)) ||
      (expected_inputs.length > 0 &&
        (args.length != 1 ||
          !sameValues(Object.keys(args[0]), expected_inputs)))
    ) {
      const expectedError = expected_inputs.length
        ? `only properties: ${expected_inputs}`
        : "no properties";
      throw `Incorrect number of inputs to launch plan reference; expected object with ${expectedError}`;
    }
    for (let paramName of expected_inputs) {
      let arg = args[0][paramName];
      if (arg instanceof Promise) {
        throw "Launch Plans cannot take Promises as input";
      }
      if (!(arg instanceof PromiseBinding)) {
	if (isSerializable(arg)) {
	  arg = new PrimitiveBinding(arg);
	} else {
	  throw `Argument for parameter ${paramName} of launch plan reference ${name} is not a task output or workflow input`;
	}
      }
      passedArguments.push([paramName, arg]);
    }
    if (!callsObj[name]) {
      callsObj[name] = [];
    }
    callsObj[name].push(passedArguments);
    return new PromiseBinding({
      promiseNodeId: `${name}-${callsObj[name].length - 1}`,
      outputName: getOutputNameFromLaunchPlan(reference),
    });
  };
}

function callToTaskNode(registeredObjs, nodeName, callNumber, call) {
  const isLaunchPlan = nodeName in registeredObjs.launchPlanReferences;
  const inputs = [];
  for (
    let [varName, binding] of call
  ) {
    inputs.push({
      var: varName,
      ...binding.bindingObj(),
    });
  }

  const target = isLaunchPlan
    ? {
      workflow_node: {
        launchplan_ref: registeredObjs.launchPlanReferences[nodeName].id,
      },
    }
    : {
      task_node: {
        reference_id:
          (nodeName in registeredObjs.tasks
            ? registeredObjs.tasks[nodeName]
            : registeredObjs.taskReferences[nodeName]).id,
      },
    };

  return {
    id: `${nodeName}-${callNumber}`,
    metadata: {
      name: nodeName,
      retries: {},
    },
    inputs: inputs,
    ...target,
  };
}

async function convertToWorkflow(
  registeredObjs,
  callsObj,
  project,
  domain,
  version,
  f,
  options,
) {
  const workflowName = getNameFromFunction(f);
  const inputCount = f.length;
  checkParamNames(options, inputCount);
  checkOutputName(options);

  const inputs = [];
  for (let i = 0; i < inputCount; i++) {
    inputs.push(
      new PromiseBinding({
        promiseNodeId: "start-node",
        outputName: options?.paramNames ? options?.paramNames[i] : `input${i}`,
      }),
    );
  }

  // ensure no properties are set on the callsObj
  for (let prop of Object.keys(callsObj)) {
    delete callsObj[prop];
  }

  // make workflow function consistently async
  const consistentFunc = f instanceof AsyncFunction
    ? f
    : async (...inputs) => f(...inputs);
  let result = await consistentFunc(
    ...inputs,
  );
  if (!(result instanceof PromiseBinding)) {
    if (isSerializable(result)) {
      result = new PrimitiveBinding(result);
    } else {
      throw `Workflow ${workflowName} output is not task output or workflow input`;
    }
  }

  const taskNodes = [];
  for (let [nodeName, calls] of Object.entries(callsObj)) {
    for (let [callNumber, call] of calls.entries()) {
      const taskNode = callToTaskNode(
        registeredObjs,
        nodeName,
        callNumber,
        call,
      );
      taskNodes.push(taskNode);
    }
  }

  const workflowId = {
    resource_type: "WORKFLOW",
    project: project,
    domain: domain,
    name: workflowName,
    version: version,
  };
  const workflowOutputName = options?.outputName ?? "output0";

  return [workflowName, {
    id: workflowId,
    spec: {
      template: {
        id: workflowId,
        interface: {
          inputs: {
            variables: options?.paramNames
              ? generateAllNamedVariables(options.paramNames)
              : generateAllVariables("input", inputCount),
          },
          outputs: {
            variables: generateAllNamedVariables([workflowOutputName]),
          },
        },
        nodes: [
          { id: "start-node" },
          {
            id: "end-node",
            inputs: [
              {
                var: workflowOutputName,
                ...result.bindingObj(),
              },
            ],
          },
        ].concat(taskNodes),
        outputs: [
          {
            var: workflowOutputName,
            ...result.bindingObj(),
          },
        ],
      },
    },
  }];
}

function makeLaunchPlan(workflowobj, options) {
  let parameters = {};
  const inputCount =
    Object.keys(workflowobj.spec.template.interface.inputs.variables).length;
  checkParamNames(options, inputCount);

  for (
    let i = 0;
    i < inputCount;
    i++
  ) {
    const parameterName = options?.paramNames
      ? options?.paramNames[i]
      : `input${i}`;
    parameters = {
      ...parameters,
      ...{
        [parameterName]: {
          var: {
            type: {
              simple: "STRING",
            },
            description: parameterName,
          },
          required: true,
        },
      },
    };
  }

  return {
    id: {
      resource_type: "LAUNCH_PLAN",
      project: workflowobj.id.project,
      domain: workflowobj.id.domain,
      name: workflowobj.id.name,
      version: workflowobj.id.version,
    },
    spec: {
      workflow_id: workflowobj.id,
      default_inputs: {
        parameters: parameters,
      },
    },
  };
}

function handleTaskRegistration(
  registeredObjs,
  callsObj,
  pkg,
  image,
  project,
  domain,
  version,
  func,
  options,
) {
  const isAsync = func instanceof AsyncFunction;
  const [taskName, taskobj] = convertToTask(
    pkg,
    image,
    project,
    domain,
    version,
    func,
    options,
  );
  registeredObjs.tasks[taskName] = taskobj;
  return inputCaptureObj(registeredObjs, callsObj, taskName, isAsync);
}

function handleTaskReferenceSeen(
  registeredObjs,
  callsObj,
  { project, domain, name, version },
) {
  const refName = [project, domain, name, version].join("-");
  registeredObjs.taskReferences[refName] = {
    id: { resource_type: "TASK", project, domain, name, version },
  };
  return taskReferenceInputCaptureObj(registeredObjs, callsObj, refName);
}

function handleLaunchPlanReferenceSeen(
  registeredObjs,
  callsObj,
  { project, domain, name, version },
) {
  const refName = [project, domain, name, version].join("-");
  registeredObjs.launchPlanReferences[refName] = {
    id: { resource_type: "LAUNCH_PLAN", project, domain, name, version },
  };
  return launchPlanReferenceInputCaptureObj(registeredObjs, callsObj, refName);
}

function handleWorkflowSeenInImport(
  workflowsSeen,
  func,
  options,
) {
  workflowsSeen.push([func, options]);
  return func;
}

async function populateTaskReferenceInformation(endpoint, taskReference) {
  const { project, domain, name, version } = taskReference.id;
  const info = await fetch(
    `${endpoint}/api/v1/tasks/${project}/${domain}/${name}/${version}`,
    {},
  ).then((r) => r.json());
  if (info.error) {
    console.error("Error occured while retrieving task reference information");
    console.error(JSON.stringify(info, null, 2));
    throw "Missing Task Reference";
  }
  taskReference.spec = { template: info?.closure?.compiled_task?.template };
}

async function populateLaunchPlanReferenceInformation(
  endpoint,
  launchPlanReference,
) {
  const { project, domain, name, version } = launchPlanReference.id;
  const info = await fetch(
    `${endpoint}/api/v1/launch_plans/${project}/${domain}/${name}/${version}`,
    {},
  ).then((r) => r.json());
  if (info.error) {
    console.error(
      "Error occured while retrieving launch plan reference information",
    );
    console.error(JSON.stringify(info, null, 2));
    throw "Missing Launch Plan Reference";
  }
  launchPlanReference.spec = info?.spec;
  launchPlanReference.closure = info?.closure;
}

async function populateAllTaskReferenceInformation(endpoint, taskReferences) {
  await Promise.all(
    Object.values(taskReferences).map((reference) =>
      populateTaskReferenceInformation(endpoint, reference)
    ),
  );
}

async function populateAllLaunchPlanReferenceInformation(
  endpoint,
  launchPlanReferences,
) {
  await Promise.all(
    Object.values(launchPlanReferences).map((reference) =>
      populateLaunchPlanReferenceInformation(endpoint, reference)
    ),
  );
}

async function handleWorkflowRegistration(
  registeredObjs,
  callsObj,
  project,
  domain,
  version,
  func,
  options,
) {
  const [workflowname, workflowobj] = await convertToWorkflow(
    registeredObjs,
    callsObj,
    project,
    domain,
    version,
    func,
    options,
  );
  const launchPlan = makeLaunchPlan(workflowobj, options);
  registeredObjs.workflows[workflowname] = workflowobj;
  registeredObjs.launchplans[workflowname] = launchPlan;
}

async function uploadToFlyte(endpoint, type, objs) {
  let registrationResults = await Promise.all(objs.map((obj) => {
    return fetch(`${endpoint}/api/v1/${type}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(obj),
    });
  }));
  let jsonResults = await Promise.all(registrationResults.map((result) => {
    return result.json();
  }));
  let error = false;
  for (let i = 0; i < jsonResults.length; i++) {
    let objId = JSON.stringify(objs[i].id);
    if (Object.keys(jsonResults[i]).length == 0) {
      console.log(`Registered ${objId}`);
    } else if (
      jsonResults[i].code == 6 && jsonResults[i].error &&
      jsonResults[i].error.includes("already exists")
    ) {
      console.log(`${objId} already registered`);
    } else {
      console.error(
        `Error Registering ${objId}\n\tError: ${jsonResults[i].error}`,
      );
      error |= true;
    }
  }
  if (error) {
    throw `Error while registering ${type}`;
  }
}

async function uploadTasks(endpoint, objs) {
  return await uploadToFlyte(endpoint, "tasks", objs);
}

async function uploadWorkflows(endpoint, objs) {
  return await uploadToFlyte(endpoint, "workflows", objs);
}

async function uploadLaunchPlans(endpoint, objs) {
  return await uploadToFlyte(endpoint, "launch_plans", objs);
}

/**
 * Register a javascript file with functions annotated as tasks or workflows
 * to a running flyte cluster so that it can be executed.
 * @param {string} pkgs - File system path or url to script to register.
 * @param {string} image - Container image to run registered tasks with.
 * @param {string} endpoint - URL or ip where the flyte api is hosted.
 * @param {string} project - Project in which to register.
 * @param {string} domain - Domain in which to register.
 * @param {string} version - Version to register as.
 */
export async function registerScriptWithOptions(
  pkgs,
  image,
  endpoint,
  project,
  domain,
  version,
) {
  // registered Objs are stored for use in workflow
  const registeredObjs = {
    tasks: {},
    workflows: {},
    launchplans: {},
    taskReferences: {},
    launchPlanReferences: {},
  };
  // calls made to each task are stored here
  const callsObj = {};
  const workflowsSeen = [];
  globalThis.pterodactylConfig.taskTransformer = (f, options) =>
    handleTaskRegistration(
      registeredObjs,
      callsObj,
      pkgs,
      image,
      project,
      domain,
      version,
      f,
      options,
    );
  globalThis.pterodactylConfig.taskReferenceTransformer = (id) =>
    handleTaskReferenceSeen(registeredObjs, callsObj, id);
  globalThis.pterodactylConfig.launchPlanReferenceTransformer = (id) =>
    handleLaunchPlanReferenceSeen(registeredObjs, callsObj, id);
  globalThis.pterodactylConfig.workflowTransformer = (f, options) =>
    handleWorkflowSeenInImport(
      workflowsSeen,
      f,
      options,
    );
  const userWorkflowPath =
    pkgs.startsWith("https://") || pkgs.startsWith("http://")
      ? pkgs
      : `file://${Deno.cwd()}/${pkgs}`;
  const userWorkflow = await import(userWorkflowPath);
  await populateAllTaskReferenceInformation(
    endpoint,
    registeredObjs.taskReferences,
  );
  await populateAllLaunchPlanReferenceInformation(
    endpoint,
    registeredObjs.launchPlanReferences,
  );
  for (let [workflow, options] of workflowsSeen) {
    await handleWorkflowRegistration(
      registeredObjs,
      callsObj,
      project,
      domain,
      version,
      workflow,
      options,
    );
  }
  // User workflow has been imported; upload
  await uploadTasks(endpoint, Object.values(registeredObjs.tasks));
  await uploadWorkflows(
    endpoint,
    Object.values(registeredObjs.workflows),
  );
  await uploadLaunchPlans(
    endpoint,
    Object.values(registeredObjs.launchplans),
  );
}
