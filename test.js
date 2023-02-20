/**
 * Tests that pterodactyl behaves correctly
 */
import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.177.0/testing/asserts.ts";

import { isSerializable, registerScriptWithOptions } from "./src/register.js";
import { getSecret, Secret, SecretMountType } from "./pterodactyl.js";

const endpoint = "localhost:30081";
const project = "flytesnacks";
const domain = "development";
const version = "v1";

const basicRegistrationCmd = [
  "deno",
  "run",
  "--allow-net",
  "--allow-read",
  "pterodactyl_register.js",
  "--endpoint",
  endpoint,
  "--project",
  project,
  "--domain",
  domain,
  "--version",
  version,
];

Deno.test("isSerializable test", async (t) => {
  class TestClass {
    constructor(x) {
      this.x = x;
    }
  }

  await t.step("String is serializable", async (t) => {
    assert(isSerializable("hello world"), "String is not serializable");
  });

  await t.step("Boolean is serializable", async (t) => {
    assert(isSerializable(true), "Boolean is not serializable");
    assert(isSerializable(false), "Boolean is not serializable");
  });

  await t.step("Number is serializable", async (t) => {
    assert(isSerializable(false), "Number is not serializable");
  });

  await t.step("Array is serializable", async (t) => {
    assert(isSerializable([1, "hi", false]), "Array is not serializable");
  });

  await t.step("Plain object is serializable", async (t) => {
    assert(isSerializable({ x: 10 }), "Plain object not serializable");
  });

  await t.step("Class is not serializable", async (t) => {
    assert(!isSerializable(new TestClass(10)), "class is serializable");
  });

  await t.step("Class nested in array is not serializable", async (t) => {
    assert(!isSerializable([new TestClass(10)]), "class is serializable");
  });

  await t.step("Class nested in object is not serializable", async (t) => {
    assert(!isSerializable({ x: new TestClass(10) }), "class is serializable");
  });
});

Deno.test("secret validation test", async (t) => {
  await t.step("Secret with group only is invalid", async (t) => {
    assertThrows(() => new Secret({ group: "secret-group" }));
  });

  await t.step("Secret with non string group is invalid", async (t) => {
    assertThrows(() => new Secret({ group: 1 }));
  });

  await t.step("Secret without group is invalid", async (t) => {
    assertThrows(() => new Secret({}));
  });

  await t.step("Secret with group and key only is valid", async (t) => {
    const secret = new Secret({ group: "secret-group", key: "secret-key" });
  });

  await t.step("Secret with non string key is invalid", async (t) => {
    assertThrows(() => new Secret({ group: "secret-group", key: 1 }));
  });

  await t.step(
    "Secret with group, key, and mount_requirement is valid",
    async (t) => {
      const secret = new Secret({
        group: "secret-group",
        key: "secret-key",
        mount_requirement: SecretMountType.ANY,
      });
    },
  );

  await t.step(
    "Secret with group and mount_requirement is invalid",
    async (t) => {
      assertThrows(() =>
        new Secret({
          group: "secret-group",
          mount_requirement: SecretMountType.FILE,
        })
      );
    },
  );

  await t.step(
    "Secret with non SecretMountType mount_requirement is invalid",
    async (t) => {
      assertThrows(() =>
        new Secret({
          group: "secret-group",
          key: "secret-key",
          mount_requirement: "hi",
        })
      );
    },
  );

  await t.step("Secret serializes as expected", async (t) => {
    assertEquals(
      JSON.stringify(
        new Secret({
          group: "group",
          key: "key",
          mount_requirement: SecretMountType.ENV_VAR,
        }),
      ),
      '{"group":"group","key":"key","mount_requirement":1}',
    );
  });
});

Deno.test("getSecret tests", async (t) => {
  const value = "yes";
  const group = "secretgroup";
  const key = "secretkey";
  Deno.env.set("FLYTE_SECRETS_ENV_PREFIX", "_FSEC_");
  Deno.env.set("_FSEC_SECRETGROUP_SECRETKEY", value);

  await t.step("Can getSecret from env var", async (t) => {
    const secretValue = getSecret({
      group: group,
      key: key,
    });
    assertEquals(value, secretValue);
  });

  Deno.env.set("FLYTE_SECRETS_DEFAULT_DIR", Deno.cwd());
  await Deno.mkdir(group);
  await Deno.writeTextFile(`${group}/${key}`, value);
  await t.step("Can getSecret from file", async (t) => {
    const secretValue = getSecret({
      group: group,
      key: key,
    });
    assertEquals(value, secretValue);
  });
  await Deno.remove(group, { recursive: true });
});

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

    await expectRegisterSuccess(
      "./test-cases/references/zeroArgumentTask.js",
      "denoland/deno:distroless-1.24.1",
      [
        'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"noArgs","version":"v1"}',
        'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"noArgs","version":"v1"}',
        'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"noArgs","version":"v1"}',
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

    await t.step(
      "Register workflow using zero argument task reference",
      async (t) => {
        await expectRegisterSuccess(
          "./test-cases/references/referencesZeroArgumentTask.js",
          "denoland/deno:distroless-1.24.1",
          [
            'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"usesNoArgsTaskReference","version":"v1"}',
            'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"usesNoArgsTaskReference","version":"v1"}',
            "",
          ].join("\n"),
          "Failed to register workflow with task reference",
        );
      },
    );

    await t.step(
      "Register workflow using task reference with named arguments",
      async (t) => {
        await expectRegisterSuccess(
          "./test-cases/references/namedArgumentTaskReferenceWorkflow.js",
          "denoland/deno:distroless-1.24.1",
          [
            'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"usesTaskReferenceNamedArgument","version":"v1"}',
            'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"usesTaskReferenceNamedArgument","version":"v1"}',
            "",
          ].join("\n"),
          "Failed to register workflow with task reference",
        );
      },
    );
  });

  await t.step(
    "Register workflow using constant inputs to tasks",
    async (t) => {
      await expectRegisterSuccess(
        "./test-cases/constantInput/workflow.js",
        "denoland/deno:distroless-1.24.1",
        [
          'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"CIf","version":"v1"}',
          'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"CImul10","version":"v1"}',
          'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"constantInput","version":"v1"}',
          'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"constantInput","version":"v1"}',
          "",
        ].join("\n"),
        "Failed to register workflow with constant inputs",
      );
    },
  );

  await t.step(
    "Register workflow with constant output",
    async (t) => {
      await expectRegisterSuccess(
        "./test-cases/constantOutput/workflow.js",
        "denoland/deno:distroless-1.24.1",
        [
          'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"waitForThis","version":"v1"}',
          'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"constantOutput","version":"v1"}',
          'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"constantOutput","version":"v1"}',
          "",
        ].join("\n"),
        "Failed to register workflow with constant output",
      );
    },
  );

  await t.step("Register workflow in blob url", async (t) => {
    const workflowString = `
	  import { taskReference, workflow } from 'https://deno.land/x/pterodactyl@v0.2.1/pterodactyl.js';

	  const ref = taskReference({project: "flytesnacks", domain: "development", version: "v1", name: "waitForThis" });

	  const testcase = workflow(function blobWorkflow() {
	  	return ref();
	  });
	  `;

    const encoder = new TextEncoder();
    const encodedWorkflow = encoder.encode(workflowString);
    const workflowBlob = new Blob([encodedWorkflow], {
      type: "text/javascript",
    });
    const url = URL.createObjectURL(workflowBlob);

    try {
      await expectWebRegistrationSuccess(
        url,
        "denoland/deno:distroless-1.24.1",
        [
          'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"blobWorkflow","version":"v1"}',
          'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"blobWorkflow","version":"v1"}',
        ].join("\n"),
        "Failed to register workflow in blob url",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  await t.step("Register workflow in data url", async (t) => {
    const workflowString = `
	import { task, workflow } from 'https://deno.land/x/pterodactyl@v0.2.1/pterodactyl.js';

	const dataUrlTask = task(function dataUrlTask() { return "success"; });

	const dataUrlWorkflow = workflow(function dataUrlWorkflow() { return dataUrlTask(); });
	`;

    const encodedWorkflow = encodeURIComponent(workflowString);
    const url = `data:text/javascript,${encodedWorkflow}`;

    await expectRegisterSuccess(
      url,
      "denoland/deno:distroless-1.24.1",
      [
        'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"dataUrlTask","version":"v1"}',
        'Registered {"resource_type":"WORKFLOW","project":"flytesnacks","domain":"development","name":"dataUrlWorkflow","version":"v1"}',
        'Registered {"resource_type":"LAUNCH_PLAN","project":"flytesnacks","domain":"development","name":"dataUrlWorkflow","version":"v1"}',
        "",
      ].join("\n"),
      "Failed to register workflow in data url",
    );
  });

  // Fail to register workflow that has no nodes
  await t.step("Fail to register workflow with constant output", async (t) => {
    await expectRegisterFailure(
      "./test-cases/constantOutput/noNodes.js",
      "denoland/deno:distroless-1.24.1",
      '"Workflow constantOutput contains no tasks or references"',
      "Registered a failing workflow",
    );
  });

  await t.step("Register task that uses secrets", async (t) => {
    await expectRegisterSuccess(
      "./test-cases/uses-secret/workflow.js",
      "denoland/deno:distroless-1.24.1",
      [
        'Registered {"resource_type":"TASK","project":"flytesnacks","domain":"development","name":"useSecretTask","version":"v1"}',
        "",
      ].join("\n"),
      "Failed to register task that uses secrets",
    );
  });

  await t.step(
    "Fail to register task that uses poorly formed secret",
    async (t) => {
      await expectRegisterFailure(
        "./test-cases/uses-secret/noGroupSecret.js",
        "denoland/deno:distroless-1.24.1",
        '"undefined is not a valid secret group, must be a string; undefined is not a valid secret key, must be a string"',
        "Registered a task using secret without group",
      );
    },
  );

  await t.step(
    "Fail to register task that uses non array secrets option",
    async (t) => {
      await expectRegisterFailure(
        "./test-cases/uses-secret/nonArraySecrets.js",
        "denoland/deno:distroless-1.24.1",
        '"secrets option must be an array"',
        "Registered a task using non array secrets option",
      );
    },
  );

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

async function expectWebRegistrationSuccess(
  pkg,
  image,
  expectedMessage,
  failureMessage,
) {
  const statusMessages = await registerScriptWithOptions(
    pkg,
    image,
    `http://${endpoint}`,
    project,
    domain,
    version,
  );
  const result = statusMessages.join("\n");
  assertEquals(result, expectedMessage, failureMessage);
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
      "--timeout",
      "10m0s",
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
