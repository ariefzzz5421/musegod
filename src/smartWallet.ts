import { createPublicClient, http } from 'viem'

const robinhoodClient = createPublicClient({ transport: http('https://rpc.mainnet.chain.robinhood.com') })

export function verifySmartWallet(proof: { address: `0x${string}`; message: string; signature: `0x${string}` }) {
  return robinhoodClient.verifyMessage(proof)
}
