import { getSecret, SecretMountType, task } from "../../pterodactyl.js";

const secret1 = {
  group: "databasesecret",
  key: "username",
  mount_requirement: SecretMountType.FILE,
};

const secret2 = {
  group: "databasesecret",
  key: "password",
  mount_requirement: SecretMountType.ENV_VAR,
};

const useSecretTask = task(function useSecretTask(p1) {
  console.log(getSecret(secret1)); // logging secrets is a bad idea
  console.log(getSecret(secret2));
  return p1;
}, {
  secrets: [
    secret1,
    secret2,
  ],
});
