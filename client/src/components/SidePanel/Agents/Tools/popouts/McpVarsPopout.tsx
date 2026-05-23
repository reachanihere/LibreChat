import { OGDialog, OGDialogContent } from '@librechat/client';
import CustomUserVarsSection from '~/components/MCP/CustomUserVarsSection';
import type { CustomUserVarConfig } from '~/components/MCP/CustomUserVarsSection';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  fields: Record<string, CustomUserVarConfig>;
  onSave: (authData: Record<string, string>) => void;
  onRevoke: () => void;
  isSubmitting?: boolean;
  onSaved?: () => void;
}

export default function McpVarsPopout({
  open,
  onOpenChange,
  serverName,
  fields,
  onSave,
  onRevoke,
  isSubmitting,
  onSaved,
}: Props) {
  const handleSave = (authData: Record<string, string>) => {
    onSave(authData);
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="max-w-lg p-6">
        <CustomUserVarsSection
          serverName={serverName}
          fields={fields}
          onSave={handleSave}
          onRevoke={onRevoke}
          isSubmitting={isSubmitting}
        />
      </OGDialogContent>
    </OGDialog>
  );
}
