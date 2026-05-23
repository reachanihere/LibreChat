import { useState } from 'react';
import { Check } from 'lucide-react';
import type { AgentItem } from './items/types';
import type { TranslationKeys } from '~/hooks/useLocalize';
import { getIconForItem } from './items/icons';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface ToolCardProps {
  item: AgentItem;
  selected: boolean;
  onToggle: (item: AgentItem) => void;
}

function useDisplayStrings(item: AgentItem): { name: string; description: string } {
  const localize = useLocalize();
  if (item.kind === 'builtin') {
    return {
      name: localize(item.name as TranslationKeys),
      description: item.description ? localize(item.description as TranslationKeys) : '',
    };
  }
  return { name: item.name, description: item.description ?? '' };
}

const KIND_LABEL_KEYS: Record<AgentItem['kind'], TranslationKeys> = {
  builtin: 'com_ui_tools_kind_official',
  tool: 'com_ui_tools_kind_tools',
  skill: 'com_ui_tools_kind_skills',
  mcp: 'com_ui_tools_kind_mcp',
  action: 'com_ui_tools_kind_actions',
};

interface ItemIconProps {
  item: AgentItem;
  size: 'sm' | 'md';
}

function ItemIconView({ item, size }: ItemIconProps) {
  const { Icon, colorClass, iconUrl } = getIconForItem(item);
  const [imgError, setImgError] = useState(false);

  const tileClasses =
    size === 'md' ? 'h-10 w-10 rounded-xl text-base' : 'h-9 w-9 rounded-lg text-sm';
  const iconClasses = size === 'md' ? 'h-[18px] w-[18px]' : 'h-[18px] w-[18px]';

  if (iconUrl && !imgError) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden bg-surface-secondary',
          tileClasses,
        )}
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
      className={cn('flex shrink-0 items-center justify-center', tileClasses, colorClass)}
      aria-hidden="true"
    >
      <Icon className={iconClasses} strokeWidth={1.75} />
    </span>
  );
}

export default function ToolCard({ item, selected, onToggle }: ToolCardProps) {
  const localize = useLocalize();
  const { name, description } = useDisplayStrings(item);
  const isNative = item.kind === 'builtin';
  const kindLabel = localize(KIND_LABEL_KEYS[item.kind]);

  return (
    <button
      type="button"
      onClick={() => onToggle(item)}
      onMouseDown={(e) => e.preventDefault()}
      aria-pressed={selected}
      className={cn(
        'group relative flex h-32 cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-left transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
        selected
          ? 'border-emerald-500/60 bg-emerald-500/[0.06] shadow-sm'
          : 'border-border-light bg-surface-primary hover:border-border-medium hover:bg-surface-tertiary hover:shadow-sm',
      )}
    >
      <div className="flex w-full items-start gap-3">
        <ItemIconView item={item} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
              {name}
            </p>
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                selected ? 'scale-100 bg-emerald-500 text-white opacity-100' : 'scale-75 opacity-0',
              )}
              aria-hidden="true"
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
          </div>
          <p className="truncate text-[11px] uppercase tracking-wide text-text-tertiary">
            {kindLabel}
          </p>
        </div>
      </div>
      {description ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">{description}</p>
      ) : (
        <p className="line-clamp-2 text-xs italic text-text-tertiary">
          {isNative ? localize('com_ui_tools_native_short') : kindLabel}
        </p>
      )}
      <div className="mt-auto flex w-full items-center gap-1.5">
        {isNative && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {localize('com_ui_tools_native')}
          </span>
        )}
        {item.kind === 'mcp' && item.toolCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] text-text-tertiary">
            {localize(item.toolCount === 1 ? 'com_ui_tools_count_one' : 'com_ui_tools_count', {
              count: item.toolCount,
            })}
          </span>
        )}
        {item.kind === 'action' && item.endpointCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] text-text-tertiary">
            {localize(
              item.endpointCount === 1
                ? 'com_ui_tools_endpoint_count_one'
                : 'com_ui_tools_endpoint_count',
              { count: item.endpointCount },
            )}
          </span>
        )}
      </div>
    </button>
  );
}
