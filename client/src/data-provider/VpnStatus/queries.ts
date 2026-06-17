import { QueryKeys, dataService } from 'librechat-data-provider';
import { useQuery } from '@tanstack/react-query';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type t from 'librechat-data-provider';

export const useGetVpnStatusQuery = (
  config?: UseQueryOptions<t.TVpnStatusResponse>,
): QueryObserverResult<t.TVpnStatusResponse> => {
  return useQuery<t.TVpnStatusResponse>([QueryKeys.vpnStatus], () => dataService.getVpnStatus(), {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: 60_000,
    ...config,
  });
};
