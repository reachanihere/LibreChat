import { useState } from 'react';
import { X } from 'lucide-react';
import {
  Button,
  OGDialog,
  OGDialogClose,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  OGDialogDescription,
} from '@librechat/client';
import type { AgentItem } from '../items/types';
import type { TranslationKeys } from '~/hooks/useLocalize';
import BuiltinDetail from './BuiltinDetail';
import SkillDetail from './SkillDetail';
import ToolDetail from './ToolDetail';
import McpDetail from './McpDetail';
import ActionDetail from './ActionDetail';
import { getIconForItem } from '../items/icons';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

function HeaderIcon({ item }: { item: AgentItem }) {
  const { Icon, colorClass, iconUrl } = getIconForItem(item);
  const [imgError, setImgError] = useState(false);

  if (iconUrl && !imgError) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-secondary"
        aria-hidden="true"
      >
        <img
          src={iconUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', colorClass)}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}

interface Props {
  item: AgentItem | null;
  agentId: string;
  onClose: () => void;
  onRemove: (item: AgentItem) => void;
}

interface BodyProps {
  item: AgentItem;
  agentId: string;
  onRemove: () => void;
}

function DetailBody({ item, agentId, onRemove }: BodyProps) {
  if (item.kind === 'builtin') {
    return <BuiltinDetail builtinId={item.id} agentId={agentId} onRemove={onRemove} />;
  }
  if (item.kind === 'skill') {
    return <SkillDetail item={item} onRemove={onRemove} />;
  }
  if (item.kind === 'tool') {
    return <ToolDetail item={item} onRemove={onRemove} />;
  }
  if (item.kind === 'mcp') {
    return <McpDetail item={item} onRemove={onRemove} />;
  }
  return <ActionDetail item={item} agentId={agentId} onRemove={onRemove} />;
}

const KIND_LABEL_KEYS: Record<AgentItem['kind'], TranslationKeys> = {
  builtin: 'com_ui_tools_kind_official',
  tool: 'com_ui_tools_kind_tools',
  skill: 'com_ui_tools_kind_skills',
  mcp: 'com_ui_tools_kind_mcp',
  action: 'com_ui_tools_kind_actions',
};

export default function DetailPane({ item, agentId, onClose, onRemove }: Props) {
  const localize = useLocalize();
  const open = item !== null;
  const displayName = item
    ? item.kind === 'builtin'
      ? localize(item.name as TranslationKeys)
      : item.name
    : '';
  const kindLabel = item ? localize(KIND_LABEL_KEYS[item.kind]) : '';

  return (
    <OGDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <OGDialogContent
        className="w-11/12 max-w-[520px] gap-0 overflow-hidden rounded-2xl border-none bg-background p-0 text-foreground shadow-xl md:max-h-[85vh]"
        showCloseButton={false}
      >
        {item && (
          <div className="flex max-h-[80vh] flex-col">
            <OGDialogHeader className="flex flex-row items-start gap-3 space-y-0 border-b border-border-light px-6 py-4">
              <HeaderIcon item={item} />
              <div className="min-w-0 flex-1 text-left">
                <OGDialogTitle className="truncate text-base font-semibold text-text-primary">
                  {displayName}
                </OGDialogTitle>
                <OGDialogDescription className="m-0 text-xs uppercase tracking-wide text-text-tertiary">
                  {kindLabel}
                </OGDialogDescription>
              </div>
              <OGDialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-xl text-text-secondary hover:text-text-primary"
                  aria-label={localize('com_ui_tools_close')}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </OGDialogClose>
            </OGDialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5" aria-live="polite">
              <DetailBody item={item} agentId={agentId} onRemove={() => onRemove(item)} />
            </div>
          </div>
        )}
      </OGDialogContent>
    </OGDialog>
  );
}
