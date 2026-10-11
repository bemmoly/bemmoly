import {
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Radio,
  SegmentedControl,
  Select,
} from '@bemmoly/ui';
import { useCreateApiToken, type TokenExpiry } from '../../hooks/use-api-tokens.ts';
import { useClipboard } from '../../hooks/use-clipboard.ts';
import { FormError } from '../form.tsx';
import { CopyField } from '../settings/copy-field.tsx';

const EXPIRY: { value: TokenExpiry; label: string }[] = [
  { value: '30', label: 'In 30 days' },
  { value: '90', label: 'In 90 days' },
  { value: 'never', label: 'Never' },
];

interface CreateTokenModalProps {
  open: boolean;
  onClose: () => void;
  modules: readonly { id: string; name: string }[];
}

/** The secret, once: after this dialog closes only its first characters are ever shown. */
function SecretStep({ token, onDone }: { token: string; onDone: () => void }) {
  const clipboard = useClipboard();
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-13 leading-body text-tx-2">
        Copy this token now and keep it somewhere safe. It won’t be shown again; if you lose it,
        revoke it and create a new one.
      </p>
      <CopyField
        label="Access token"
        value={token}
        copied={clipboard.copied === token}
        onCopy={() => void clipboard.copy(token, 'Token copied')}
      />
      <div className="flex justify-end">
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** "Create token": a name, what it may do, which modules it reaches and when it stops. */
export function CreateTokenModal({ open, onClose, modules }: CreateTokenModalProps) {
  const create = useCreateApiToken(onClose);
  const { form, errors, update } = create;
  if (create.created) {
    return (
      <Modal open={open} onClose={create.close} title="Token created" width="md">
        <SecretStep token={create.created.token} onDone={create.close} />
      </Modal>
    );
  }
  return (
    <Modal
      open={open}
      onClose={create.close}
      width="md"
      title="Create access token"
      description="MCP clients, IDEs and scripts use a token to act as you. It can never do more than you can."
      footer={
        <>
          <Button onClick={create.close}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form="create-token-form"
            loading={create.mutation.isPending}
          >
            Create token
          </Button>
        </>
      }
    >
      <form
        id="create-token-form"
        noValidate
        onSubmit={create.submit}
        className="flex flex-col gap-4"
      >
        <Field
          label="Name"
          hint="Where it is used, so you can tell tokens apart."
          error={errors.name}
        >
          <Input
            autoFocus
            placeholder="Laptop editor"
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </Field>
        <div role="group" aria-label="Access" className="flex flex-col gap-1.5">
          <span className="text-13 font-medium text-tx">Access</span>
          <SegmentedControl
            options={[
              { value: 'read', label: 'Read only' },
              { value: 'write', label: 'Read and write' },
            ]}
            value={form.access}
            onChange={(access) => update({ access })}
          />
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1.5 p-0 text-13 font-medium text-tx">Modules</legend>
          <Radio
            name="token-modules"
            label="All modules you can open"
            checked={form.allModules}
            onChange={() => update({ allModules: true })}
          />
          <Radio
            name="token-modules"
            label="Only these modules"
            checked={!form.allModules}
            onChange={() => update({ allModules: false })}
          />
          {form.allModules ? null : (
            <div className="flex flex-col gap-2 pl-6.5">
              {modules.map((module) => (
                <Checkbox
                  key={module.id}
                  label={module.name}
                  checked={form.modules.includes(module.id)}
                  onChange={() => create.toggleModule(module.id)}
                />
              ))}
              {errors.modules ? (
                <span role="alert" className="text-12 text-red-tx">
                  {errors.modules}
                </span>
              ) : null}
            </div>
          )}
        </fieldset>
        <Field label="Expires">
          <Select
            options={EXPIRY}
            value={form.expiry}
            onChange={(event) => update({ expiry: event.value as TokenExpiry })}
          />
        </Field>
        {create.mutation.error ? <FormError error={create.mutation.error} /> : null}
      </form>
    </Modal>
  );
}
