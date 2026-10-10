import { Notice } from '../../components/form.tsx';
import { EnableModuleModal } from '../../components/modules/enable-module-modal.tsx';
import { DisableModuleModal, RemoveDataModal } from '../../components/modules/module-dialogs.tsx';
import { ModulesTable } from '../../components/modules/modules-table.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { moduleName, useAdminModules } from '../../hooks/use-admin-modules.ts';
import { useModules } from '../../hooks/use-modules.ts';

export function ModulesPage() {
  const {
    modules,
    pinned,
    restartPending,
    setEnabled,
    removeData,
    access,
    dialog,
    isPending,
    error,
  } = useAdminModules();
  const manifests = useModules().data;
  const target = dialog.target;
  const busyId = setEnabled.isPending ? (setEnabled.variables?.id ?? null) : null;
  return (
    <SettingsPage
      title="Modules"
      description="Every module in this image. Disabling one hides it and keeps its data; removing the data is a separate, confirmed step."
      loading={isPending}
      error={error}
    >
      {pinned ? (
        <Notice tone="caution">
          BEMMOLY_MODULES is set on the server, so the module set is fixed and this page is read
          only. Change the variable and restart Bemmoly to enable or disable a module.
        </Notice>
      ) : null}
      {restartPending.length ? (
        <Notice tone="caution">
          Restart Bemmoly to finish the change to{' '}
          {restartPending.map((module) => moduleName(module.id)).join(', ')}.
        </Notice>
      ) : null}
      <ModulesTable
        modules={modules}
        pinned={pinned}
        busyId={busyId}
        {...(manifests ? { manifests } : {})}
        onEnable={(id) => dialog.open('enable', id)}
        onDisable={(id) => dialog.open('disable', id)}
        onRemoveData={(id) => dialog.open('remove', id)}
      />
      <EnableModuleModal
        module={dialog.kind === 'enable' ? target : null}
        access={access}
        busy={setEnabled.isPending}
        onClose={dialog.close}
        onConfirm={() =>
          target && setEnabled.mutate({ id: target.id, enabled: true, access: access.choice })
        }
      />
      <DisableModuleModal
        module={dialog.kind === 'disable' ? target : null}
        busy={setEnabled.isPending}
        onClose={dialog.close}
        onConfirm={() => target && setEnabled.mutate({ id: target.id, enabled: false })}
      />
      <RemoveDataModal
        module={dialog.kind === 'remove' ? target : null}
        typed={dialog.typed}
        canRemove={dialog.canRemove}
        busy={removeData.isPending}
        error={removeData.error}
        onTyped={dialog.setTyped}
        onClose={dialog.close}
        onConfirm={() =>
          target && removeData.mutate({ id: target.id, confirm: dialog.typed.trim() })
        }
      />
    </SettingsPage>
  );
}
