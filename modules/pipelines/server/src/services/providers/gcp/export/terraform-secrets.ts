import { SECRET_ACCESSOR } from '../zone-kind.ts';
import { attr, block, interpolate, str, type Expr } from './hcl.ts';
import type { Terraform } from './terraform-context.ts';
import { managedLabels } from './terraform-zone.ts';

/*
 * Secret Manager secrets Pipelines made, never their versions: a value is written once into
 * the store and Pipelines keeps no copy, so the export has none to give. Each grant that lets
 * a running service read a secret is exported beside it.
 */

export type Parts = Array<string | { ref: string }>;

/** Who reads a secret: the member as an attribute, and as text for its import ID. */
export interface Reader {
  key: string;
  expr: Expr;
  parts: Parts;
}

export function secrets(tf: Terraform): void {
  for (const secret of tf.records.secrets) {
    const name = tf.unique('google_secret_manager_secret', secret.name);
    tf.secrets.set(`${secret.account}/${secret.name}`, name);
    tf.add('secrets.tf', {
      type: 'google_secret_manager_secret',
      name,
      body: [
        attr('project', tf.projectRef(secret.account)),
        attr('secret_id', str(secret.name)),
        attr('labels', managedLabels()),
        block('replication', [], [block('auto', [], [])]),
      ],
      importId: tf.inProject(secret.account, 'projects/', `/secrets/${secret.name}`),
    });
  }
}

/** Secret Accessor on one secret for one reader, once however many services share it. */
export function grantReader(
  tf: Terraform,
  secret: { account: string; secret: string },
  reader: Reader,
): void {
  const key = `${secret.account}/${secret.secret} ${reader.key}`;
  if (tf.granted.has(key)) return;
  tf.granted.add(key);
  const declared = tf.secrets.get(`${secret.account}/${secret.secret}`);
  tf.add('secrets.tf', {
    type: 'google_secret_manager_secret_iam_member',
    name: tf.unique('google_secret_manager_secret_iam_member', `${secret.secret}_${reader.key}`),
    body: [
      attr('project', tf.projectRef(secret.account)),
      attr(
        'secret_id',
        declared ? `google_secret_manager_secret.${declared}.secret_id` : str(secret.secret),
      ),
      attr('role', str(SECRET_ACCESSOR)),
      attr('member', reader.expr),
    ],
    importId: interpolate([
      'projects/',
      { ref: tf.projectVar(secret.account) },
      `/secrets/${secret.secret} ${SECRET_ACCESSOR} `,
      ...reader.parts,
    ]),
  });
}
