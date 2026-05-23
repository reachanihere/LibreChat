import { useState } from 'react';
import { X } from 'lucide-react';
import type { AgentItem } from './items/types';
import type { TranslationKeys } from '~/hooks/useLocalize';
import { getIconForItem } from './items/icons';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface Props {
  item: AgentItem;
  onClick: (item: AgentItem) => void;
  onRemove: (item: AgentItem) => void;
}

function getSuffix(item: AgentItem): string | null {
  if (item.kind === 'mcp' && item.toolCount > 0) return `· ${item.toolCount}`;
  if (item.kind === 'action' && item.endpointCount > 0) return `· ${item.endpointCount}`;
  return null;
}

function ChipIcon({ item }: { item: AgentItem }) {
  const { Icon, colorClass, iconUrl } = getIconForItem(item);
  const [imgError, setImgError] = useState(false);

  if (iconUrl && !imgError) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary"
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
      className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', colorClass)}
      aria-hidden="true"
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
    </span>
  );
}

export default function ToolChip({ item, onClick, onRemove }: Props) {
  const localize = useLocalize();
  const suffix = getSuffix(item);
  const displayName = item.kind === 'builtin' ? localize(item.name as TranslationKeys) : item.name;

  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        onClick={() => onClick(item)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-transparent py-1 pl-1 pr-2.5 text-xs text-text-primary transition-colors hover:border-border-medium hover:bg-surface-secondary"
      >
        <ChipIcon item={item} />
        <span className="max-w-[14ch] truncate">{displayName}</span>
        {suffix && <span className="text-text-tertiary">{suffix}</span>}
      </button>
      {item.status === 'needs_setup' && (
        <span
          aria-label={localize('com_ui_tools_needs_setup')}
          className="absolute right-1 top-1 size-1.5 rounded-full bg-red-500"
        />
      )}
      <button
        type="button"
        onClick={() => onRemove(item)}
        aria-label={localize('com_ui_tools_remove')}
        className="ml-1 hidden size-5 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-primary group-focus-within:flex group-hover:flex"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  );
}
