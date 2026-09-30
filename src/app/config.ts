export const config = {
  chainId: import.meta.env.VITE_ALPHA_CHAIN_ID || 'alpha-1',
  rpcUrl: import.meta.env.VITE_ALPHA_RPC_URL || 'http://127.0.0.1:26657',
  restUrl: import.meta.env.VITE_ALPHA_REST_URL || 'http://127.0.0.1:1317',
  prefix: import.meta.env.VITE_ALPHA_PREFIX || 'alpha',
  denom: import.meta.env.VITE_ALPHA_DENOM || 'stake',
} as const
