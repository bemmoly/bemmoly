export interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  /** Deactivated users keep their rows but receive nothing. */
  active: boolean;
}

/** Read-only lookup of people for services that address them, such as notifications. */
export interface UserDirectory {
  /** Unknown ids are left out of the result. */
  findByIds(ids: readonly string[]): Promise<DirectoryUser[]>;
}
