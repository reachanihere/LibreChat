import { memo } from 'react';
import { useGetVpnStatusQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

function VpnStatusBadge() {
  const localize = useLocalize();
  const { data, isLoading } = useGetVpnStatusQuery();

  if (isLoading || !data) {
    return null;
  }

  const label = data.connected
    ? localize('com_ui_vpn_connected')
    : localize('com_ui_vpn_direct');
  const location = [data.ip, data.country].filter(Boolean).join(' · ');

  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs',
        data.connected
          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('h-1.5 w-1.5 rounded-full', data.connected ? 'bg-green-500' : 'bg-amber-500')}
      />
      <span>{label}</span>
      {location && <span className="text-text-secondary">{location}</span>}
    </div>
  );
}

export default memo(VpnStatusBadge);
