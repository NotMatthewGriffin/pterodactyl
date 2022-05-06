import { parse } from "https://deno.land/std@0.133.0/flags/mod.ts";
import { configObj } from "./pterodactyl.js";

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

function getExecutionScript() {
  if (import.meta.url.startsWith("file://")) {
    return "pterodactyl_execute.js";
  }
  return import.meta.url.split("/").slice(0, -1).join("/") +
    "/pterodactyl_execute.js";
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

function convertToTask(
  pkg,
  image,
  project,
  domain,
  version,
  f,
) {
  const taskName = getNameFromFunction(f);
  const inputCount = f.length;

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
        type: "container",
        metadata: {
          runtime: {
            type: "OTHER",
            version: "0.0.1",
            flavor: "pterodactyl",
          },
          retries: {},
        },
        interface: {
          inputs: {
            variables: generateAllVariables("input", inputCount),
          },
          outputs: {
            variables: generateAllVariables("output", 1),
          },
        },
        container: generateContainer(pkg, image, taskName),
      },
    },
  }];
}

function inputCaptureObj(callsObj, name) {
  return (...args) => {
    let passedArguments = [];
    for (let arg of args) {
      passedArguments.push(arg);
    }
    if (!callsObj[name]) {
      callsObj[name] = [];
    }
    callsObj[name].push(passedArguments);
    return [name, callsObj[name].length - 1];
  };
}

function callToTaskNode(registeredObjs, nodeName, callNumber, call) {
  const taskId = registeredObjs.tasks[nodeName].id;
  const inputs = [];
  for (
    let [i, [argNodeName, argNodeNumber, argOutputNumber]] of call.entries()
  ) {
    let varName = `input${i}`;
    let [promiseNodeId, promiseVar] = argNodeName == "start-node"
      ? [argNodeName, `input${argOutputNumber}`]
      : [`${argNodeName}-${argNodeNumber}`, "output0"];
    inputs.push({
      var: varName,
      binding: {
        promise: {
          node_id: promiseNodeId,
          var: promiseVar,
        },
      },
    });
  }

  return {
    id: `${nodeName}-${callNumber}`,
    metadata: {
      name: nodeName,
      retries: {},
    },
    task_node: {
      reference_id: taskId,
    },
    inputs: inputs,
  };
}

function convertToWorkflow(
  registeredObjs,
  callsObj,
  project,
  domain,
  version,
  f,
) {
  const workflowName = getNameFromFunction(f);
  const inputCount = f.length;
  const inputs = [];
  for (let i = 0; i < inputCount; i++) {
    inputs.push(["start-node", 0, i]);
  }

  const [outputNode, outputNodeNumber, outputNumber] = f(...inputs);
  let [promiseNodeId, promiseVar] = outputNode == "start-node"
    ? [outputNode, `input${outputNumber}`]
    : [`${outputNode}-${outputNodeNumber}`, "output0"];

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

  return [workflowName, {
    id: workflowId,
    spec: {
      template: {
        id: workflowId,
        interface: {
          inputs: {
            variables: generateAllVariables("input", inputCount),
          },
          outputs: {
            variables: generateAllVariables("output", 1),
          },
        },
        nodes: [
          { id: "start-node" },
          {
            id: "end-node",
            inputs: [
              {
                var: "output0",
                binding: {
                  promise: {
                    node_id: `${outputNode}-${outputNodeNumber}`,
                    var: "output0",
                  },
                },
              },
            ],
          },
        ].concat(taskNodes),
        outputs: [
          {
            var: "output0",
            binding: {
              promise: {
                node_id: promiseNodeId,
                var: promiseVar,
              },
            },
          },
        ],
      },
    },
  }];
}

function makeLaunchPlan(workflowobj) {
  let parameters = {};
  for (
    let i = 0;
    i <
      Object.keys(workflowobj.spec.template.interface.inputs.variables).length;
    i++
  ) {
    const parameterName = `input${i}`;
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
) {
  const [taskName, taskobj] = convertToTask(
    pkg,
    image,
    project,
    domain,
    version,
    func,
  );
  registeredObjs.tasks[taskName] = taskobj;
  return inputCaptureObj(callsObj, taskName);
}

function handleWorkflowRegistration(
  registeredObjs,
  callsObj,
  project,
  domain,
  version,
  func,
) {
  const [workflowname, workflowobj] = convertToWorkflow(
    registeredObjs,
    callsObj,
    project,
    domain,
    version,
    func,
  );
  const launchPlan = makeLaunchPlan(workflowobj);
  registeredObjs.workflows[workflowname] = workflowobj;
  registeredObjs.launchplans[workflowname] = launchPlan;
  return func;
}

async function uploadToFlyte(endpoint, type, objs) {
  let registrationResults = await Promise.all(objs.map((obj) => {
    return fetch(`http://${endpoint}/api/v1/${type}`, {
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
  console.log(`Registered ${type}`);
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

if (import.meta.main) {
  const { pkgs, image, endpoint, project, domain, version } = parse(Deno.args);
  if (!pkgs) {
    console.warn("Must pass a file path to the workflow with `--pkgs`");
    Deno.exit(1);
  }
  if (!image) {
    console.warn("Must pass a container image with `--image`");
    Deno.exit(1);
  }
  if (!endpoint) {
    console.warn("Must pass an endpoint in with `--endpoint`");
    Deno.exit(1);
  }
  if (!project) {
    console.warn(
      "Must pass a project with `--project`",
    );
    Deno.exit(1);
  }
  if (!domain) {
    console.warn(
      "Must pass a project with `--domain`",
    );
    Deno.exit(1);
  }
  if (!version) {
    console.warn(
      "Must pass a version with `--version`",
    );
    Deno.exit(1);
  }

  // registered Objs are stored for use in workflow
  const registeredObjs = { tasks: {}, workflows: {}, launchplans: {} };
  // calls made to each task are stored here
  const callsObj = {};
  configObj.taskTransformer = (f) =>
    handleTaskRegistration(
      registeredObjs,
      callsObj,
      pkgs,
      image,
      project,
      domain,
      version,
      f,
    );
  configObj.workflowTransformer = (f) =>
    handleWorkflowRegistration(
      registeredObjs,
      callsObj,
      project,
      domain,
      version,
      f,
    );
  const userWorkflowPath =
    pkgs.startsWith("https://") || pkgs.startsWith("http://")
      ? pkgs
      : `file://${Deno.cwd()}/${pkgs}`;
  const userWorkflow = await import(userWorkflowPath);
  // User workflow has been imported; upload
  await uploadTasks(endpoint, Object.values(registeredObjs.tasks));
  await uploadWorkflows(endpoint, Object.values(registeredObjs.workflows));
  await uploadLaunchPlans(endpoint, Object.values(registeredObjs.launchplans));
}
