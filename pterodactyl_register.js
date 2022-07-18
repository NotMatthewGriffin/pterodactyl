import { parse } from "./src/deps.js";
import { registerScriptWithOptions } from "./src/register.js";

function addProtocolToEndpoint(endpoint) {
  return endpoint.startsWith("https://") || endpoint.startsWith("http://")
    ? endpoint
    : `http://${endpoint}`;
}

async function main() {
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
  const protocolEndpoint = addProtocolToEndpoint(endpoint);

  await registerScriptWithOptions(
    pkgs,
    image,
    protocolEndpoint,
    project,
    domain,
    version,
  );
}

if (import.meta.main) {
  await main();
}
