import { parse } from "https://deno.land/std@0.133.0/flags/mod.ts";
import { configObj } from "./pterodactyl.js";

function getNameFromFunction(f) {
  const fname = /function (.*?)\(/;
  const matchResult = f.toString().match(fname);
  //TODO make this a hash of the function
  if (!matchResult || matchResult.length <= 0) {
    throw "Functions must be named";
  }
  //  return first match group
  return matchResult[1];
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

function generateContainer(pkg, image, taskName) {
  const inputDir = "/var/inputs";
  const outputDir = "/var/outputs";
  return {
    image: image,
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "pterodactyl_execute.js",
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
  f,
  project = "flytesnacks",
  domain = "staging",
  version = "v1",
) {
  const taskName = getNameFromFunction(f);
  const inputCount = f.length;

  return [taskName, {
    id: {
      resource_type: "TASK",
      project: project,
      domain: domain,
      name: taskName,
      version: "v1",
    },
    spec: {
      template: {
        type: "container",
        metadata: {},
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

function callToTaskNode(registeredTasks, nodeName, callNumber, call) {
  const taskId = registeredTasks[nodeName].id;
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
  registeredTasks,
  callsObj,
  f,
  project = "flytesnacks",
  domain = "staging",
  version = "v1",
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
        registeredTasks,
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

function handleTaskRegistration(registeredTasks, callsObj, pkg, image, func) {
  const [taskName, taskobj] = convertToTask(pkg, image, func);
  registeredTasks[taskName] = taskobj;
  return inputCaptureObj(callsObj, taskName);
}

function handleWorkflowRegistration(registeredTasks, callsObj, func) {
  const [workflowname, workflowobj] = convertToWorkflow(
    registeredTasks,
    callsObj,
    func,
  );
  const launchPlan = makeLaunchPlan(workflowobj);
  for (let [key, value] of Object.entries(registeredTasks)) {
    console.log(JSON.stringify(value));
  }
  console.log(JSON.stringify(workflowobj));
  console.log(JSON.stringify(launchPlan));
  return func;
}

if (import.meta.main) {
  const { pkgs, image } = parse(Deno.args);
  if (!pkgs) {
    console.warn("Must pass a file path to the workflow with `--pkgs`");
    Deno.exit(1);
  }
  if (!image) {
    console.warn("Must pass a container image with `--image`");
    Deno.exit(1);
  }
  // registered tasks are stored for use in workflow
  const registeredTasks = {};
  // calls made to each task are stored here
  const callsObj = {};
  configObj.taskTransformer = (f) =>
    handleTaskRegistration(registeredTasks, callsObj, pkgs, image, f);
  configObj.workflowTransformer = (f) =>
    handleWorkflowRegistration(registeredTasks, callsObj, f);
  const userWorkflow = await import(Deno.cwd() + "/./" + pkgs);
}
