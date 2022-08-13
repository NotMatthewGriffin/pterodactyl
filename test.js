/**
 * Tests that pterodactyl behaves correctly
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.151.0/testing/asserts.ts";

const basicRegistrationCmd = [
  "deno",
  "run",
  "--allow-net",
  "--allow-read",
  "pterodactyl_register.js",
  "--endpoint",
  "localhost:30081",
  "--project",
  "flytesnacks",
  "--domain",
  "development",
  "--version",
  "v1",
];

Deno.test("pterodactyl tests", async (t) => {
  // Start cluster for testing
  const clusterUpStatus = await startCluster();

  // install flyte
  const flyteUpStatus = await installFlyte();

  // run registration test
  await t.step("Can register and reregister workflow", async (t) => {
    await t.step("Can register workflow", async (t) => {
      await expectRegisterSuccess(
        "./test-cases/arrowFuncTask/workflow.js",
        "denoland/deno:distroless-1.24.1",
        [
          'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"f","version":"v1"}',
          'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"mul10","version":"v1"}',
          'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"arrowFuncWorkflow","version":"v1"}',
          'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"arrowFuncWorkflow","version":"v1"}',
          "",
        ].join("\n"),
        "Failed while registering workflow",
      );
    });
    await t.step("Can reregister workflow", async (t) => {
      await expectRegisterSuccess(
        "./test-cases/arrowFuncTask/workflow.js",
        "denoland/deno:distroless-1.24.1",
        [
          '{"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"f","version":"v1"} already registered',
          '{"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"mul10","version":"v1"} already registered',
          '{"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"arrowFuncWorkflow","version":"v1"} already registered',
          '{"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"arrowFuncWorkflow","version":"v1"} already registered',
          "",
        ].join("\n"),
        "Failed while reregistering workflow",
      );
    });
  });

  // Register file with multiple workflows
  await t.step("Register file with multiple workflows", async (t) => {
    await expectRegisterSuccess(
      "./test-cases/multiworkflowFile/workflows.js",
      "denoland/deno:distroless-1.24.1",
      [
        'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"exponential","version":"v1"}',
        'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"multiply","version":"v1"}',
        'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"w1","version":"v1"}',
        'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"w2","version":"v1"}',
        'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"w1","version":"v1"}',
        'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"w2","version":"v1"}',
        "",
      ].join("\n"),
      "Failed to register workflows",
    );
  });

  // Register workflows that use references (launchPlan or task)
  await t.step("Register workflows with reference tasks", async (t) => {
    await expectRegisterSuccess(
      "./test-cases/references/sumWorkflow.js",
      "denoland/deno:distroless-1.24.1",
      [
        'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"sum","version":"v1"}',
        'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"sum","version":"v1"}',
        'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"sum","version":"v1"}',
        "",
      ].join("\n"),
      "Failed to register referenced workflow",
    );

    await t.step("Register workflow using launch plan reference", async (t) => {
      await expectRegisterSuccess(
        "./test-cases/references/launchPlanWorkflow.js",
        "denoland/deno:distroless-1.24.1",
        [
          'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"usesLaunchPlan","version":"v1"}',
          'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"usesLaunchPlan","version":"v1"}',
          "",
        ].join("\n"),
        "Failed to register workflow with launch plan reference",
      );
    });

    await t.step("Register workflow using task reference", async (t) => {
      await expectRegisterSuccess(
        "./test-cases/references/taskReferenceWorkflow.js",
        "denoland/deno:distroless-1.24.1",
        [
          'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"usesTaskReference","version":"v1"}',
          'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"usesTaskReference","version":"v1"}',
          "",
        ].join("\n"),
        "Failed to register workflow with task reference",
      );
    });
  });

  // Fail to register with constant inputs
  await t.step("Fail to register workflow with constant input", async (t) => {
    await expectRegisterFailure(
      "./test-cases/constantInput/workflow.js",
      "denoland/deno:distroless-1.24.1",
      '"Argument for parameter input0 of task mul10 is not a task output or workflow input"',
      "Registered a failing workflow",
    );
  });

  // Fail to register workflow with constant outputs
  await t.step("Fail to register workflow with constant output", async (t) => {
    await expectRegisterFailure(
      "./test-cases/constantOutput/workflow.js",
      "denoland/deno:distroless-1.24.1",
      '"Workflow constantOutput output is not task output or workflow input"',
      "Registered a failing workflow",
    );
  });

  // Teardown cluster
  const clusterDownStatus = await stopCluster();
});

async function expectRegisterSuccess(
  pkg,
  image,
  expectedMessage,
  failureMessage,
) {
  const registerWorkflow = Deno.run({
    cmd: basicRegistrationCmd.concat([
      "--pkgs",
      pkg,
      "--image",
      image,
    ]),
    stdout: "piped",
    stderr: "piped",
  });
  const [{ success }, stdout, stderr] = await Promise.all([
    registerWorkflow.status(),
    registerWorkflow.output(),
    registerWorkflow.stderrOutput(),
  ]);
  registerWorkflow.close();
  const stringStdout = new TextDecoder().decode(stdout);
  assert(success, failureMessage);
  assertEquals(
    stringStdout,
    expectedMessage,
  );
}

async function expectRegisterFailure(
  pkg,
  image,
  expectedMessage,
  failureMessage,
) {
  const registerFailingWorkflow = Deno.run({
    cmd: basicRegistrationCmd.concat([
      "--pkgs",
      pkg,
      "--image",
      image,
    ]),
    stdout: "piped",
    stderr: "piped",
  });
  const [{ success }, stdout, stderr] = await Promise.all([
    registerFailingWorkflow.status(),
    registerFailingWorkflow.output(),
    registerFailingWorkflow.stderrOutput(),
  ]);
  registerFailingWorkflow.close();
  const stringStderr = new TextDecoder().decode(stderr);
  assert(!success, failureMessage);
  assert(
    stringStderr.includes(
      expectedMessage,
    ),
    "Missing error message",
  );
}

const clusterConfig = `
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30081
    hostPort: 30081
  - containerPort: 30500
    hostPort: 30500
  - containerPort: 30084
    hostPort: 30084
`;

async function startCluster() {
  const clusterUp = Deno.run({
    cmd: [
      "sh",
      "-c",
      `cat <<EOF | kind create cluster --config -
  ${clusterConfig}
EOF`,
    ],
  });
  const clusterUpStatus = await clusterUp.status();
  clusterUp.close();
  return clusterUpStatus;
}

async function installFlyte() {
  const helmUp = Deno.run({
    cmd: [
      "helm",
      "install",
      "flyte",
      "-n",
      "flyte",
      "--create-namespace",
      "--atomic",
      "flyteorg/flyte",
    ],
  });
  const helmUpStatus = await helmUp.status();
  helmUp.close();
  return helmUpStatus;
}

async function stopCluster() {
  const clusterDown = Deno.run({
    cmd: ["kind", "delete", "cluster"],
  });
  const clusterDownStatus = await clusterDown.status();
  clusterDown.close();
  return clusterDownStatus;
}
