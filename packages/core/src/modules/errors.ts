/** A module set that cannot boot: unknown id, missing dependency, cycle or bad contribution. */
export class ModuleLoadError extends Error {
  override readonly name = 'ModuleLoadError';
  readonly moduleId: string | undefined;

  constructor(message: string, moduleId?: string) {
    super(message);
    this.moduleId = moduleId;
  }
}
