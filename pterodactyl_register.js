import { parse } from "https://deno.land/std@0.133.0/flags/mod.ts";
import { registrationObject } from "./pterodactyl.js";

let selectedImage = null;

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
    image: selectedImage,
    args: [
      "ls",
      "/var/inputs",
      name,
    ],
    resources: {},
    env: [],
    data_config: {
      enabled: true,
      input_path: "/var/inputs",
      output_path: "/var/outputs",
    },
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
  const { pkgs, image } = parse(Deno.args);
  if (!pkgs) {
    console.warn("Must pass a file path to the workflow with `--pkgs`");
    Deno.exit(1);
  }
  if (!image) {
    console.warn("Must pass a container image with `--image`");
    Deno.exit(1);
  }
  selectedImage = image;
  registrationObject.convertToTask = convertToTask;
  const userWorkflow = await import("./" + pkgs);
}
