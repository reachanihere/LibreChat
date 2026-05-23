import { OGDialog, OGDialogContent } from '@librechat/client';
import { PluginAuthForm } from '~/components/Plugins/Store';
import type { TPlugin, TPluginAction } from 'librechat-data-provider';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plugin?: TPlugin;
  onSubmit: (action: TPluginAction) => void;
}

export default function PluginAuthPopout({ open, onOpenChange, plugin, onSubmit }: Props) {
  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="max-w-lg p-6">
        <PluginAuthForm plugin={plugin} onSubmit={onSubmit} isEntityTool />
      </OGDialogContent>
    </OGDialog>
  );
}
