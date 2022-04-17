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
  domain = "development",
) {
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
        container: generateContainer(pkg, image, taskName),
      },
    },
  };
}

function handleTaskRegistration(pkg, image, func) {
  const taskobj = convertToTask(pkg, image, func);
  console.log(JSON.stringify(taskobj));
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
  configObj.taskTransformer = (f) => handleTaskRegistration(pkgs, image, f);
  const userWorkflow = await import("./" + pkgs);
}
