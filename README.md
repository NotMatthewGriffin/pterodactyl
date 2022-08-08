# Pterodactyl

Pterodactyl is a javascript sdk for Flyte

## Quick Start

Pterodactyl allows you to author and register flyte workflows in javascript.

Assuming that you have a flyte installation already setup you can follow these
steps to get a workflow registered in flyte.

If you don't already have a flyte installation you can use kind + helm to set up
a local kubernetes cluster running flyte.

#### Create a workflow

Create a workflow using the pterodactyl library in javascript. An example is
provided below. Be sure to name it `workflow.js` so the remaining steps work
correctly or replace `workflow.js` with your chosen file name in the remaining
steps.

```javascript
import {
  task,
  workflow,
} from "https://raw.githubusercontent.com/NotMatthewGriffin/pterodactyl/main/pterodactyl.js";

const sum = task(function sum(x, y) {
  return x + y;
});

const square = task(function square(z) {
  return z * z;
});

const myWorkflow = workflow(function myWorkflow(x, y) {
  return sum(square(x), square(y));
});
```

#### Create a Dockerfile

Create a dockerfile based on a deno image that copies your script into the
container. Be sure to name this file `Dockerfile`.

```
FROM denoland/deno:distroless-1.21.0
COPY workflow.js workflow.js
```

#### Build the container image

Using the dockerfile above build the image. Its fine to change the tag provided
to docker with `-t` to your prefered tag but you'll need to replace
`jsworkflow:v1` in future steps with your chosen tag (you may wish to do this if
you have a private container registry to host containers changing the tag to
something like: `<private-registry-url>/jsworkflow:v1`). From the directory
containing both your javascript workflow and Dockerfile run:

```sh
docker build -t jsworkflow:v1 .
```

#### Push your container to a registry/load into cluster

This step is very dependent upon how your flyte installation is setup. If you
have a private container registry configured pushing the image you created in
the last step will provide the best user experience. Assuming that in the last
step you tagged your image with your `<private-registry-url>/jsworkflow:v1`,
this can be done like:

```sh
docker push <private-registry>/jsworkflow:v1
```

If you're running a local installation using kind you can use the following to
load the image into your cluster without deploying a private container registry:

```sh
kind load docker-image jsworkflow:v1
```

#### Register to flyte using pterodactyl_register.js

If the steps above worked correctly then you're ready to register your workflow
with flyte. Be sure to replace `localhost:30081` with the endpoint for your
flyte installation if it is not also hosted there. Run the following to register
with the same version of `pterodactyl` as was used in the example workflow:

```sh
deno run --allow-read --allow-net https://raw.githubusercontent.com/NotMatthewGriffin/pterodactyl/main/pterodactyl_register.js --pkgs workflow.js --image jsworkflow:v1 --endpoint localhost:30081 --project flytesnacks --domain development --version v1
```

#### Run the workflow in flyte console

After all above steps run successfully you can look in your flyte console under
the flytesnacks project and development domain to find the workflow
`myWorkflow`. At this point it can be run like any other flyte workflow. The
flyte console interface will say that the inputs are all of type string but they
will be fed to `JSON.parse` and the result of that sent as the argument to your
workflow task functions. For this example try 2 for `input0` and 2 for `input1`.

## Testing pterodactyl

### Prerequisites
In order to test pterodactyl's implementation you will need the following software: `kind`, `helm`, `deno`.

With these software installed you will also need to add the flyte helm repo: `helm repo add flyteorg https://flyteorg.github.io/flyte`.
After adding the helm repo you'll need to run `helm repo update`.

### Test command

With the prerequisites out of the way you can test pterodactyl by running the following in this project's root directory: `deno test --allow-run`.
