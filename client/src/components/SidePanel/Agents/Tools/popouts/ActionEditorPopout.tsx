import { X } from 'lucide-react';
import { OGDialog, OGDialogContent } from '@librechat/client';
import { useLocalize } from '~/hooks';
import ActionEditor from '../ActionEditor';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export default function ActionEditorPopout({ open, onOpenChange, agentId }: Props) {
  const localize = useLocalize();
  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        className="w-11/12 max-w-[720px] overflow-hidden rounded-2xl border-border-medium p-0 shadow-xl md:max-h-[85vh]"
        showCloseButton={false}
      >
        <div className="flex max-h-[80vh] flex-col">
          <header className="flex items-center justify-between border-b border-border-light px-6 py-4">
            <h2 className="text-base font-semibold text-text-primary">
              {localize('com_assistants_add_actions')}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-9 items-center justify-center rounded-xl border border-border-light text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
              aria-label={localize('com_ui_tools_close')}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div className="overflow-y-auto p-6">
            <ActionEditor agentId={agentId} onClose={() => onOpenChange(false)} />
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
