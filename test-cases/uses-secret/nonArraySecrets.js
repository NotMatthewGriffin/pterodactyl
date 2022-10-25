import { task } from "../../pterodactyl.js";

const useSecretTask = task(function useSecretTask(p1) {
  return p1;
}, {
  secrets: { group: "secret-group" },
});
