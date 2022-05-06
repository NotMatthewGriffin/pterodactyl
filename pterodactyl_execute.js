import { parse } from "https://deno.land/std@0.133.0/flags/mod.ts";
import { configObj } from "./pterodactyl.js";

function getNameFromFunction(f) {
  if (!f.name) {
    throw "Functions must be named";
  }
  return f.name;
}

function collectInputFile(filename) {
  // try to read and parse as json if not treat as string
  const fileContent = Deno.readTextFileSync(filename);
  try {
    return JSON.parse(fileContent);
  } catch {
    return fileContent;
  }
}

function collectInputs(inputdir, f) {
  const inputs = new Array(f.length);
  for (let i = 0; i < f.length; i++) {
    inputs[i] = collectInputFile(`${inputdir}/input${i}`);
  }
  return inputs;
}

function writeOutput(outputdir, output) {
  const jsonOutput = JSON.stringify(output);
  Deno.writeTextFileSync(`${outputdir}/output0`, jsonOutput);
}

function handleTaskExecution(inputdir, outputdir, taskName, f) {
  const functionName = getNameFromFunction(f);
  if (functionName != taskName) {
    return f;
  }
  const inputs = collectInputs(inputdir, f);
  const output = f(...inputs);
  writeOutput(outputdir, output);
  return f;
}

if (import.meta.main) {
  const { pkgs, task, inputdir, outputdir } = parse(Deno.args);
  if (!pkgs) {
    console.warn("Must pass a file path to the workflow with `--pkgs`");
    Deno.exit(1);
  }
  if (!task) {
    console.warn("Must pass a task name `--task`");
    Deno.exit(1);
  }
  if (!inputdir) {
    console.warn("Must pass an input directory `--inputdir`");
    Deno.exit(1);
  }
  if (!outputdir) {
    console.warn("Must pass an input directory `--outputdir`");
    Deno.exit(1);
  }
  configObj.taskTransformer = (f) => {
    return handleTaskExecution(inputdir, outputdir, task, f);
  };
  const userWorkflowPath = pkgs.startsWith('https://') || pkgs.startsWith('http://') ? pkgs : `file://${Deno.cwd()}/${pkgs}`;
  const userWorkflow = await import(userWorkflowPath);
}
