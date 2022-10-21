export class Secret {
  constructor({ group, key, mount_requirement }) {
    this.group = group;
    this.key = key;
    this.mount_requirement = mount_requirement;
    this.validate();
  }

  validate() {
    let errorMessages = [];
    if (typeof this.group != "string") {
      errorMessages.push(`${this.group} is not a valid secret group, must be a string`);
    }
    if (typeof this.key != "undefined" && typeof this.key != "string") {
      errorMessages.push(`${this.key} is not a valid secret key`);
    }
    if (typeof this.mount_requirement != "undefined" && !Object.values(SecretMountType).includes(this.mount_requirement)){
      errorMessages.push(`${this.mount_requirement} is not a valid mount_requirement, must be a SecretMountType`);
    }
    if (errorMessages.length > 0) {
      throw errorMessages.join("; ");
    }
  }
}

export const SecretMountType = {
  ANY: 0,
  ENV_VAR: 1,
  FILE: 2,
};
