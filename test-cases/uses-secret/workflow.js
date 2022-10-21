import { SecretMountType, task } from "../../pterodactyl.js";

const useSecretTask = task(function useSecretTask(p1) {
  return p1;
}, {
  secrets: [
    {
      group: "database-secret",
      key: "username",
      mount_requirement: SecretMountType.ENV_VAR,
    },
    {
      group: "database-secret",
      key: "password",
      mount_requirement: SecretMountType.ENV_VAR,
    },
  ],
});
