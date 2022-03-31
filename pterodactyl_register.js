import { registrationObject } from "./pterodactyl.js";

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

// TODO include file and image
function generateContainer(name) {
  return {
    image: "flyte:blahblah",
    args: [
      "pterodactyl-execute",
      "--inputs",
      "{{.input}}",
      "--output-prefix",
      "{{.outputPrefix}}",
      "--raw-output-data-prefix",
      "{{.rawOutputDataPrefix}}",
      "--checkpoint-path",
      "{{.checkpointOutputPrefix}}",
      "--prev-checkpoint",
      "{{.prevCheckpointPrefix}}",
      "--",
      name,
    ],
    resources: {},
    env: [],
  };
}

function convertToTask(f, project = "flytesnacks", domain = "development") {
  const taskName = getNameFromFunction(f);
  const inputCount = f.length;

  return {
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
        container: generateContainer(taskName),
      },
    },
  };
}

if (import.meta.main) {
  registrationObject.convertToTask = convertToTask;
  const userWorkflow = await import("./" + Deno.args[0]);
}
