import { parse } from "./src/deps.js";
import { needsFilePrefix } from "./src/utils.js";
import * as _ from "./pterodactyl.js";

const AsyncFunction = (async () => {}).constructor;

function getNameFromFunction(f) {
  if (!f.name) {
    throw "Functions must be named";
  }
  return f.name;
}

function collectInputFile(filename, typeFunction) {
  // try to read and parse as json if not treat as string
  const fileContent = Deno.readTextFileSync(filename);
  if (typeFunction) {
    return typeFunction(fileContent);
  }
  try {
    return JSON.parse(fileContent);
  } catch {
    return fileContent;
  }
}

function collectInputs(inputdir, f, options) {
  if (options?.paramNames && f.length != options.paramNames.length) {
    throw "Provided paramNames and function parameter count do not match";
  }
  const inputs = new Array(f.length);
  for (let i = 0; i < f.length; i++) {
    inputs[i] = collectInputFile(
      options?.paramNames
        ? `${inputdir}/${options.paramNames[i]}`
        : `${inputdir}/input${i}`,
      options?.paramTypes?.[i],
    );
  }

  return inputs;
}

function writeOutput(outputdir, output, options) {
  let serializationFunction = options?.outputType === String
    ? (v) => v
    : JSON.stringify;
  const fileOutput = serializationFunction(output);
  const outputName = options?.outputName ?? "output0";
  Deno.writeTextFileSync(`${outputdir}/${outputName}`, fileOutput);
}

function handleTaskSeenInImport(
  taskSeen,
  taskName,
  f,
  options,
) {
  const functionName = getNameFromFunction(f);
  if (functionName == taskName && taskSeen.length == 0) {
    taskSeen.push([f, options]);
  }
  return f;
}

async function handleTaskExecution(inputdir, outputdir, f, options) {
  const inputs = collectInputs(inputdir, f, options);
  const consistentFunc = f instanceof AsyncFunction
    ? f
    : async (...inputs) => f(...inputs);
  const output = await consistentFunc(...inputs);
  writeOutput(outputdir, output, options);
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
  const taskSeen = [];
  globalThis.pterodactylConfig.taskTransformer = (f, options) => {
    return handleTaskSeenInImport(taskSeen, task, f, options);
  };
  const userWorkflowPath = needsFilePrefix(pkgs)
    ? `file://${Deno.cwd()}/${pkgs}`
    : pkgs;
  const userWorkflow = await import(userWorkflowPath);
  const [[taskFunction, options]] = taskSeen;
  await handleTaskExecution(inputdir, outputdir, taskFunction, options);
}
