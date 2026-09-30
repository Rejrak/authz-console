import { useQuery } from '@tanstack/react-query'
import { config } from '../../app/config'
import { fetchPreflight } from './preflight'

export function usePreflight(address: string | null) {
  return useQuery({
    queryKey: ['alpha-preflight', config.chainId, address, config.transferDenom],
    queryFn: () => fetchPreflight(address!),
    enabled: !!address,
    retry: false,
    refetchInterval: 10_000,
  })
}
