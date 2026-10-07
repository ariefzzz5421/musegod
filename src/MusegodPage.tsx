import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy, ExternalLink, Flame, Globe2, LoaderCircle, RefreshCw, Sparkles, Users } from 'lucide-react'
import { formatUnits } from 'viem'
import { API, SITE } from './muse'

const TOKEN = '0x0379E228F6887c6F18bf394042ECAF81B308cb2e'
const NFT = '0x13Ea3072b7215d4C9c2Ec4f498A08c5825129836'

type Market = {
  token?: { priceUsd?: number | null; changePct?: number | null; volumeUsd?: number | null; marketCapUsd?: number | null; holders?: number | null }
  muses?: { floorEth?: number | null; volumeEth?: number | null; sales?: number | null; owners?: number | null; weekVolumeEth?: number | null; weekSales?: number | null }
}
type Drop = { minted?: number; supply?: number; soldOut?: boolean; revealed?: boolean }
type Collectors = { collectors?: number; both?: number; muses?: number }
type Offering = { streamed?: string; claimed?: string; owed?: string; calls?: number }
type Burns = { total?: string; count?: number }
type Pot = { week?: { tickets?: number; closes?: number; draw?: number }; pot?: { musegod?: string; usd?: number } }
type Sources = { market?: Market; drop?: Drop; collectors?: Collectors; offering?: Offering; burns?: Burns; pot?: Pot }
type SourceKey = keyof Sources
const endpoints: SourceKey[] = ['market', 'drop', 'collectors', 'offering', 'burns', 'pot']

const number = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value) ? 'N/D' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
const usd = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? 'N/D' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
function tokens(value?: string) {
  if (!value || !/^\d+$/.test(value)) return 'N/D'
  return number(Number(formatUnits(BigInt(value), 18)), 0)
}
function date(value?: number) { return value ? new Date(value * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/D' }

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="mg-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

export default function MusegodPage() {
  const [sources, setSources] = useState<Sources>({})
  const [failed, setFailed] = useState<SourceKey[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [copied, setCopied] = useState<'token' | 'nft' | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.allSettled(endpoints.map(async (endpoint) => {
      const response = await fetch(`${API}/${endpoint}`, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new Error(`${endpoint}: ${response.status}`)
      return [endpoint, await response.json()] as const
    })).then((results) => {
      if (controller.signal.aborted) return
      const next: Sources = {}
      const errors: SourceKey[] = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') Object.assign(next, { [result.value[0]]: result.value[1] })
        else errors.push(endpoints[index])
      })
      setSources(next)
      setFailed(errors)
      setUpdatedAt(new Date())
      setLoading(false)
    })
    return () => controller.abort()
  }, [refreshKey])

  async function copyAddress(kind: 'token' | 'nft') {
    try {
      await navigator.clipboard.writeText(kind === 'token' ? TOKEN : NFT)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 2200)
    } catch { setCopied(null) }
  }

  const market = sources.market
  const change = market?.token?.changePct
  return <section className="mg-page"><div className="container">
    <div className="mg-hero"><div><span className="section-kicker">OFFICIAL DATA · ROBINHOOD CHAIN</span><h1>The MUSEGOD<br /><em>ecosystem.</em></h1><p>One token, 999 muses, and a public record of what they do. Live figures below come directly from the official MUSEGOD API.</p><div className="mg-hero-links"><a className="button button-gold" href={`${SITE}/docs`} target="_blank" rel="noreferrer">Official docs <ArrowRight size={16} /></a><a className="button button-outline" href={SITE} target="_blank" rel="noreferrer">Official site <ExternalLink size={15} /></a></div></div><div className="mg-hero-art"><img src={`${SITE}/muse/art/480/275.jpg?v=2`} alt="MUSEGOD muse Lovebird" loading="lazy" /><span>999 MUSES · ONE WORLD</span></div></div>

    <div className="mg-source-bar"><span><Globe2 size={16} /> Official API {updatedAt ? `· checked ${updatedAt.toLocaleTimeString()}` : ''}</span><button onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> {loading ? 'Loading…' : 'Refresh data'}</button></div>
    {failed.length > 0 && <p className="mg-data-alert" role="status">Some official data is unavailable right now ({failed.join(', ')}). Missing values are shown as N/D. Try Refresh data.</p>}
    {loading && !updatedAt && <div className="state-panel"><LoaderCircle className="spin" size={21} /><div><strong>Loading official data</strong><p>Reading the MUSEGOD public API.</p></div></div>}

    <div className="mg-section-heading"><div><span className="section-kicker">01 / THE TOKEN</span><h2>$MUSEGOD</h2><p>The Robinhood Chain token. The official docs describe a 1% trade fee, with 90% of that fee streamed to holders after a payout is triggered; 10% goes to pools.fun.</p></div><Flame size={30} /></div>
    <div className="mg-metrics"><Metric label="PRICE · USD" value={usd(market?.token?.priceUsd, 8)} detail={change == null ? '24h change N/D' : `24h ${change > 0 ? '+' : ''}${number(change, 2)}%`} /><Metric label="MARKET CAP · USD" value={usd(market?.token?.marketCapUsd, 0)} /><Metric label="24H VOLUME · USD" value={usd(market?.token?.volumeUsd, 0)} /><Metric label="TOKEN HOLDERS" value={number(market?.token?.holders)} /></div>
    <div className="mg-detail-grid"><div className="mg-info-card"><div className="mg-card-top"><Flame size={21} /><span>THE FLOW</span></div><h3>Trades, rewards, burn.</h3><p>Token trade fees fund holder rewards. The separate NFT resale royalty buys $MUSEGOD: half is burned, and half funds the weekly muse pot, according to the official docs.</p><div className="mg-mini-grid"><Metric label="STREAMED TO HOLDERS" value={tokens(sources.offering?.streamed)} detail="$MUSEGOD since launch" /><Metric label="BURNED FOREVER" value={tokens(sources.burns?.total)} detail="$MUSEGOD since launch" /></div><a href={`${SITE}/docs#claim-your-rewards`} target="_blank" rel="noreferrer">How holder rewards work <ExternalLink size={14} /></a></div><div className="mg-info-card"><div className="mg-card-top"><Copy size={21} /><span>VERIFY THE CONTRACT</span></div><h3>The token address.</h3><p>Check the contract before using an exchange or block explorer. The official docs say this is the only $MUSEGOD token address.</p><button className="mg-address" onClick={() => void copyAddress('token')} title="Copy token contract"><code>{TOKEN}</code>{copied === 'token' ? <Check size={16} /> : <Copy size={16} />}</button><div className="mg-card-links"><a href={`${SITE}/trade`} target="_blank" rel="noreferrer">Official trade link <ExternalLink size={14} /></a><a href={`${SITE}/chart`} target="_blank" rel="noreferrer">Official chart <ExternalLink size={14} /></a></div></div></div>

    <div className="mg-section-heading"><div><span className="section-kicker">02 / THE COLLECTION</span><h2>The Muses.</h2><p>Each NFT has its own art, traits, onchain SOUL.md and linked ERC-8004 agent identity. The holder controls that agent through the NFT.</p></div><Sparkles size={30} /></div>
    <div className="mg-metrics"><Metric label="MINTED" value={sources.drop ? `${number(sources.drop.minted)} / ${number(sources.drop.supply)}` : 'N/D'} detail={sources.drop?.soldOut ? 'Sold out' : undefined} /><Metric label="COLLECTOR WALLETS" value={number(sources.collectors?.collectors ?? market?.muses?.owners)} /><Metric label="FLOOR · ETH" value={number(market?.muses?.floorEth, 4)} /><Metric label="24H SALES" value={number(market?.muses?.sales)} /></div>
    <div className="mg-detail-grid"><div className="mg-info-card"><div className="mg-card-top"><Users size={21} /><span>THE COLLECTION</span></div><h3>999 characters, 27 Ascended.</h3><p>The mint is sold out and the collection is revealed. Every muse is a character you can use in an AI chat or agent workflow through its official adoption prompt.</p><div className="mg-mini-grid"><Metric label="24H NFT VOLUME" value={number(market?.muses?.volumeEth, 2)} detail="ETH on OpenSea" /><Metric label="TOKEN + NFT HOLDERS" value={number(sources.collectors?.both)} detail="wallets holding both" /></div><a href={`${SITE}/muses`} target="_blank" rel="noreferrer">Browse official gallery <ExternalLink size={14} /></a></div><div className="mg-info-card"><div className="mg-card-top"><Sparkles size={21} /><span>VERIFY THE CONTRACT</span></div><h3>The NFT address.</h3><p>The Muses contract is separate from the $MUSEGOD token. Its art, ownership, soul and agent details can be checked on the official collection pages.</p><button className="mg-address" onClick={() => void copyAddress('nft')} title="Copy NFT contract"><code>{NFT}</code>{copied === 'nft' ? <Check size={16} /> : <Copy size={16} />}</button><div className="mg-card-links"><a href={`${SITE}/os`} target="_blank" rel="noreferrer">OpenSea collection <ExternalLink size={14} /></a><a href={`${SITE}/docs`} target="_blank" rel="noreferrer">NFT docs <ExternalLink size={14} /></a></div></div></div>

    <div className="mg-pot"><div><span className="section-kicker">03 / FOR COLLECTORS</span><h2>The weekly pot.</h2><p>Holders enter their muses in the official Discord each week. One muse is drawn; half the pot goes to its holder and the other half is shared across entered muses. Entry and collecting happen on the official Discord, with its own rules and deadlines.</p><a className="button button-outline" href={`${SITE}/docs`} target="_blank" rel="noreferrer">Read the official draw rules <ArrowRight size={16} /></a></div><div className="mg-pot-stats"><Metric label="CURRENT POT" value={tokens(sources.pot?.pot?.musegod)} detail={`$MUSEGOD · ${usd(sources.pot?.pot?.usd, 0)} estimated`} /><Metric label="MUSES ENTERED" value={number(sources.pot?.week?.tickets)} /><Metric label="ENTRY CLOSES" value={date(sources.pot?.week?.closes)} /></div></div>
    <p className="mg-footnote">Market figures can change quickly. The official API may cache NFT and pot data for about one minute. N/D means the API did not provide that value. Prices and rewards are information, not a return guarantee. Sources: <a href={`${API}/market`} target="_blank" rel="noreferrer">market</a>, <a href={`${API}/drop`} target="_blank" rel="noreferrer">drop</a>, <a href={`${API}/collectors`} target="_blank" rel="noreferrer">collectors</a>, <a href={`${API}/offering`} target="_blank" rel="noreferrer">offering</a>, <a href={`${API}/burns`} target="_blank" rel="noreferrer">burns</a>, <a href={`${API}/pot`} target="_blank" rel="noreferrer">pot</a>.</p>
  </div></section>
}
