import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy, ExternalLink, Flame, Globe2, LoaderCircle, RefreshCw, Sparkles, Users } from 'lucide-react'
import { formatUnits } from 'viem'
import { API, shortAddress, SITE } from './muse'

const TOKEN = '0x0379E228F6887c6F18bf394042ECAF81B308cb2e'
const NFT = '0x13Ea3072b7215d4C9c2Ec4f498A08c5825129836'

type Market = {
  stale?: boolean; readAt?: number
  token?: { priceUsd?: number | null; changePct?: number | null; volumeUsd?: number | null; marketCapUsd?: number | null; holders?: number | null }
  muses?: { floorEth?: number | null; volumeEth?: number | null; sales?: number | null; owners?: number | null; weekVolumeEth?: number | null; weekSales?: number | null }
}
type Drop = { minted?: number; supply?: number; soldOut?: boolean; revealed?: boolean }
type Collectors = { collectors?: number; both?: number; muses?: number }
type Offering = { streamed?: string; claimed?: string; owed?: string; calls?: number }
type BurnItem = { wallet: string; amount: string; tx: string; time: number }
type Burns = { total?: string; count?: number; recent?: BurnItem[]; stale?: boolean; readAt?: number; fire?: { sales?: number; royaltyWei?: string; royaltyToFireWei?: string; burned?: string; recent?: BurnItem[]; waitingWei?: string | null } }
type SaleItem = { token: number; eth: number; currency: string; at: number; seller: string; buyer: string; tx: string }
type Sales = { sales?: SaleItem[]; stale?: boolean; readAt?: number }
type Pot = { week?: { tickets?: number; closes?: number; draw?: number }; pot?: { musegod?: string; usd?: number } }
type Sources = { market?: Market; drop?: Drop; collectors?: Collectors; offering?: Offering; burns?: Burns; pot?: Pot; sales?: Sales }
type SourceKey = keyof Sources
const endpoints: SourceKey[] = ['market', 'drop', 'collectors', 'offering', 'burns', 'pot', 'sales']
const activityEndpoints: SourceKey[] = ['burns', 'sales']
const ACTIVITY_REFRESH_MS = 60_000

const number = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value) ? 'N/D' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
const usd = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? 'N/D' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
function tokens(value?: string, digits = 0) {
  if (!value || !/^\d+$/.test(value)) return 'N/D'
  return number(Number(formatUnits(BigInt(value), 18)), digits)
}
function date(value?: number) { return value ? new Date(value * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/D' }
function eth(value?: string) { return value && /^\d+$/.test(value) ? `${number(Number(formatUnits(BigInt(value), 18)), 4)} ETH` : 'N/D' }
function txUrl(tx: string) { return /^0x[a-fA-F0-9]{64}$/.test(tx) ? `https://robin.etherscan.io/tx/${tx}` : undefined }
async function fetchSource(endpoint: SourceKey, signal: AbortSignal) {
  const suffix = endpoint === 'sales' ? 'sales?limit=8' : endpoint
  const response = await fetch(`${API}/${suffix}`, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`${endpoint}: ${response.status}`)
  return [endpoint, await response.json()] as const
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="mg-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

export default function MusegodPage() {
  const [sources, setSources] = useState<Sources>({})
  const [failed, setFailed] = useState<SourceKey[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [activityAt, setActivityAt] = useState<Date | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [copied, setCopied] = useState<'token' | 'nft' | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.allSettled(endpoints.map((endpoint) => fetchSource(endpoint, controller.signal))).then((results) => {
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
      if (next.burns || next.sales) setActivityAt(new Date())
      setLoading(false)
    })
    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    let busy = false
    let controller: AbortController | null = null
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || busy) return
      busy = true
      controller = new AbortController()
      const signal = controller.signal
      Promise.allSettled(activityEndpoints.map((endpoint) => fetchSource(endpoint, signal))).then((results) => {
        if (signal.aborted) return
        const updates: Sources = {}
        const errors: SourceKey[] = []
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') Object.assign(updates, { [result.value[0]]: result.value[1] })
          else errors.push(activityEndpoints[index])
        })
        setSources((current) => ({ ...current, ...updates }))
        setFailed((current) => [...current.filter((item) => !activityEndpoints.includes(item)), ...errors])
        if (updates.burns || updates.sales) setActivityAt(new Date())
      }).finally(() => { busy = false })
    }, ACTIVITY_REFRESH_MS)
    return () => { window.clearInterval(timer); controller?.abort() }
  }, [])

  async function copyAddress(kind: 'token' | 'nft') {
    try {
      await navigator.clipboard.writeText(kind === 'token' ? TOKEN : NFT)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 2200)
    } catch { setCopied(null) }
  }

  const market = sources.market
  const change = market?.token?.changePct
  const burnedUsd = sources.burns?.total && /^\d+$/.test(sources.burns.total) && !market?.stale && market?.token?.priceUsd != null && Number.isFinite(market.token.priceUsd)
    ? usd(Number(formatUnits(BigInt(sources.burns.total), 18)) * market.token.priceUsd, 0) : 'N/D'
  const engineBurns = new Set((sources.burns?.fire?.recent ?? []).map((item) => item.tx))
  const feedDelayed = Boolean(sources.market?.stale || sources.burns?.stale || sources.sales?.stale)
  return <section className="mg-page"><div className="container">
    <div className="mg-hero"><div><span className="section-kicker">OFFICIAL DATA · ROBINHOOD CHAIN</span><h1>The MUSEGOD<br /><em>ecosystem.</em></h1><p>One token, 999 muses, and a public record of what they do. Live figures below come directly from the official MUSEGOD API.</p><div className="mg-hero-links"><a className="button button-gold" href={`${SITE}/docs`} target="_blank" rel="noreferrer">Official docs <ArrowRight size={16} /></a><a className="button button-outline" href={SITE} target="_blank" rel="noreferrer">Official site <ExternalLink size={15} /></a></div></div><div className="mg-hero-art"><img src={`${SITE}/muse/art/480/275.jpg?v=2`} alt="MUSEGOD muse Lovebird" loading="lazy" /><span>999 MUSES · ONE WORLD</span></div></div>

    <div className="mg-source-bar"><span><Globe2 size={16} /> Official API {updatedAt ? `· checked ${updatedAt.toLocaleTimeString()}` : ''}</span><button onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> {loading ? 'Loading…' : 'Refresh data'}</button></div>
    {failed.length > 0 && <p className="mg-data-alert" role="status">Some official data is unavailable right now ({failed.join(', ')}). Existing readings may remain visible; values never loaded are N/D. Try Refresh data.</p>}
    {feedDelayed && <p className="mg-data-alert" role="status">The official API marked some feed data as stale. Events below may be older than the last check.</p>}
    {loading && !updatedAt && <div className="state-panel"><LoaderCircle className="spin" size={21} /><div><strong>Loading official data</strong><p>Reading the MUSEGOD public API.</p></div></div>}

    <div className="mg-section-heading"><div><span className="section-kicker">01 / THE TOKEN</span><h2>$MUSEGOD</h2><p>The Robinhood Chain token. The official docs describe a 1% trade fee, with 90% of that fee streamed to holders after a payout is triggered; 10% goes to pools.fun.</p></div><Flame size={30} /></div>
    <div className="mg-metrics"><Metric label="PRICE · USD" value={usd(market?.token?.priceUsd, 8)} detail={change == null ? '24h change N/D' : `24h ${change > 0 ? '+' : ''}${number(change, 2)}%`} /><Metric label="MARKET CAP · USD" value={usd(market?.token?.marketCapUsd, 0)} /><Metric label="24H VOLUME · USD" value={usd(market?.token?.volumeUsd, 0)} /><Metric label="TOKEN HOLDERS" value={number(market?.token?.holders)} /></div>
    <div className="mg-burn-highlight"><div><span className="section-kicker">BURNED FOREVER · ALL SOURCES</span><strong>{tokens(sources.burns?.total)} <small>$MUSEGOD</small></strong><p>{number(sources.burns?.count)} confirmed burn transactions since launch</p></div><div><span className="section-kicker">USD EQUIVALENT · LATEST PRICE</span><strong>{burnedUsd}</strong><p>Total tokens burned × latest available token price. This is an estimate at that price, not the historical USD spent on burns.</p></div></div>
    <div className="mg-detail-grid"><div className="mg-info-card"><div className="mg-card-top"><Flame size={21} /><span>THE FLOW</span></div><h3>Trades, rewards, burn.</h3><p>Token trade fees fund holder rewards. The separate NFT resale royalty buys $MUSEGOD: half is burned, and since Oct 7, 2026 the other half funds the weekly muse pot, according to the official docs.</p><div className="mg-mini-grid"><Metric label="STREAMED TO HOLDERS" value={tokens(sources.offering?.streamed)} detail="$MUSEGOD since launch" /><Metric label="BURN ENGINE BURNED" value={tokens(sources.burns?.fire?.burned)} detail="$MUSEGOD from NFT mint and royalty flow" /></div><a href={`${SITE}/docs#claim-your-rewards`} target="_blank" rel="noreferrer">How holder rewards work <ExternalLink size={14} /></a></div><div className="mg-info-card"><div className="mg-card-top"><Copy size={21} /><span>VERIFY THE CONTRACT</span></div><h3>The token address.</h3><p>Check the contract before using an exchange or block explorer. The official docs say this is the only $MUSEGOD token address.</p><button className="mg-address" onClick={() => void copyAddress('token')} title="Copy token contract"><code>{TOKEN}</code>{copied === 'token' ? <Check size={16} /> : <Copy size={16} />}</button><div className="mg-card-links"><a href={`${SITE}/trade`} target="_blank" rel="noreferrer">Official trade link <ExternalLink size={14} /></a><a href={`${SITE}/chart`} target="_blank" rel="noreferrer">Official chart <ExternalLink size={14} /></a></div></div></div>

    <div className="mg-section-heading"><div><span className="section-kicker">02 / THE COLLECTION</span><h2>The Muses.</h2><p>Each NFT has its own art, traits, onchain SOUL.md and linked ERC-8004 agent identity. The holder controls that agent through the NFT.</p></div><Sparkles size={30} /></div>
    <div className="mg-metrics"><Metric label="MINTED" value={sources.drop ? `${number(sources.drop.minted)} / ${number(sources.drop.supply)}` : 'N/D'} detail={sources.drop?.soldOut ? 'Sold out' : undefined} /><Metric label="COLLECTOR WALLETS" value={number(sources.collectors?.collectors ?? market?.muses?.owners)} /><Metric label="FLOOR · ETH" value={number(market?.muses?.floorEth, 4)} /><Metric label="24H SALES" value={number(market?.muses?.sales)} /></div>
    <div className="mg-detail-grid"><div className="mg-info-card"><div className="mg-card-top"><Users size={21} /><span>THE COLLECTION</span></div><h3>999 characters, 27 Ascended.</h3><p>The mint is sold out and the collection is revealed. Every muse is a character you can use in an AI chat or agent workflow through its official adoption prompt.</p><div className="mg-mini-grid"><Metric label="24H NFT VOLUME" value={number(market?.muses?.volumeEth, 2)} detail="ETH on OpenSea" /><Metric label="TOKEN + NFT HOLDERS" value={number(sources.collectors?.both)} detail="wallets holding both" /></div><a href={`${SITE}/muses`} target="_blank" rel="noreferrer">Browse official gallery <ExternalLink size={14} /></a></div><div className="mg-info-card"><div className="mg-card-top"><Sparkles size={21} /><span>VERIFY THE CONTRACT</span></div><h3>The NFT address.</h3><p>The Muses contract is separate from the $MUSEGOD token. Its art, ownership, soul and agent details can be checked on the official collection pages.</p><button className="mg-address" onClick={() => void copyAddress('nft')} title="Copy NFT contract"><code>{NFT}</code>{copied === 'nft' ? <Check size={16} /> : <Copy size={16} />}</button><div className="mg-card-links"><a href={`${SITE}/os`} target="_blank" rel="noreferrer">OpenSea collection <ExternalLink size={14} /></a><a href={`${SITE}/docs`} target="_blank" rel="noreferrer">NFT docs <ExternalLink size={14} /></a></div></div></div>

    <div className="mg-royalty"><div className="mg-section-heading"><div><span className="section-kicker">03 / THE ROYALTY ROUTE</span><h2>Where does the 5% go?</h2><p>The official MUSEGOD docs describe a 5% creator royalty on Muse resales through OpenSea. When a royalty payment is received, it is split into two equal paths. This is separate from OpenSea's own marketplace fees.</p></div></div><div className="mg-royalty-flow"><div><span>OPENSEA NFT RESALE</span><strong>5% creator royalty</strong><small>Only for sales that actually pay the royalty</small></div><div className="mg-flow-arrow">→</div><div><span>2.5% OF SALE PRICE</span><strong>Burn engine</strong><small>Buys $MUSEGOD and sends it to the dead address.</small></div><div className="mg-flow-plus">+</div><div><span>2.5% OF SALE PRICE</span><strong>Weekly Muse pot</strong><small>Buys $MUSEGOD for the collector draw.</small></div></div><div className="mg-royalty-readings"><Metric label="ROYALTY PAYMENTS RECORDED" value={eth(sources.burns?.fire?.royaltyWei)} detail={`${number(sources.burns?.fire?.sales)} royalty payments · historical total`} /><Metric label="ROUTED TO BURN ENGINE" value={eth(sources.burns?.fire?.royaltyToFireWei)} detail="Confirmed cumulative ETH/WETH" /><Metric label="CURRENT COLLECTOR POT" value={tokens(sources.pot?.pot?.musegod)} detail="$MUSEGOD · current week" /></div><p className="mg-royalty-note">The pot path began on Oct 7, 2026. Historical royalty totals include earlier sales, so they are not a lifetime pot total. A sale in the feed below does not by itself prove its royalty was paid; the burn engine and pot figures are the recorded fund data.</p><a href={`${SITE}/docs`} target="_blank" rel="noreferrer">Read the official royalty and pot rules <ExternalLink size={14} /></a></div>

    <div className="mg-pot"><div><span className="section-kicker">04 / FOR COLLECTORS</span><h2>The weekly pot.</h2><p>Holders enter their muses in the official Discord each week. One muse is drawn; half the pot goes to its holder and the other half is shared across entered muses. Entry and collecting happen on the official Discord, with its own rules and deadlines.</p><a className="button button-outline" href={`${SITE}/docs`} target="_blank" rel="noreferrer">Read the official draw rules <ArrowRight size={16} /></a></div><div className="mg-pot-stats"><Metric label="CURRENT POT" value={tokens(sources.pot?.pot?.musegod)} detail={`$MUSEGOD · ${usd(sources.pot?.pot?.usd, 0)} estimated`} /><Metric label="MUSES ENTERED" value={number(sources.pot?.week?.tickets)} /><Metric label="ENTRY CLOSES" value={date(sources.pot?.week?.closes)} /></div></div>

    <div className="mg-feed-section"><div className="mg-section-heading"><div><span className="section-kicker">05 / RECENT ACTIVITY</span><h2>Burns & Muse sales.</h2><p>Confirmed burn transactions from Robinhood Chain and recent NFT sales from the official OpenSea-backed feed. New data is checked automatically every minute while this tab is open.</p></div></div><div className="mg-feed-status" aria-live="polite"><span className="live-dot" /> {activityAt ? `Last successful activity check ${activityAt.toLocaleTimeString()}` : 'Waiting for activity feed'} · burn source cached ~15s · sales source read at most once a minute</div><div className="mg-feed-grid"><div className="mg-feed-panel"><div className="mg-feed-head"><Flame size={20} /><h3>Latest burns</h3><a href={`${API}/burns`} target="_blank" rel="noreferrer">Official burn data <ExternalLink size={13} /></a></div>{sources.burns?.recent?.length ? <ol>{sources.burns.recent.slice(0, 8).map((item) => <li key={`${item.tx}-${item.amount}`}><div className="mg-event-main"><strong>{tokens(item.amount, 2)} $MUSEGOD</strong><span>{engineBurns.has(item.tx) ? 'Burn engine' : 'Wallet burn'}</span></div><div className="mg-event-meta"><time dateTime={new Date(item.time * 1000).toISOString()}>{date(item.time)}</time><span>{shortAddress(item.wallet)}</span></div>{txUrl(item.tx) && <a href={txUrl(item.tx)} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13} /></a>}</li>)}</ol> : <p className="mg-feed-empty">{failed.includes('burns') ? 'Burn feed unavailable. Retry shortly.' : loading ? 'Loading burns…' : 'No recent burns returned.'}</p>}</div><div className="mg-feed-panel"><div className="mg-feed-head"><Sparkles size={20} /><h3>Latest NFT sales</h3><a href={`${SITE}/sales`} target="_blank" rel="noreferrer">Official sales page <ExternalLink size={13} /></a></div>{sources.sales?.sales?.length ? <ol>{sources.sales.sales.slice(0, 8).map((item) => <li key={`${item.tx}-${item.token}`}><div className="mg-event-main"><strong>Muse #{item.token}</strong><span>{number(item.eth, 5)} {item.currency}</span></div><div className="mg-event-meta"><time dateTime={new Date(item.at * 1000).toISOString()}>{date(item.at)}</time><span>{shortAddress(item.seller)} → {shortAddress(item.buyer)}</span></div><div className="mg-event-links"><a href={`${SITE}/muse/${item.token}`} target="_blank" rel="noreferrer">View muse <ExternalLink size={13} /></a>{txUrl(item.tx) && <a href={txUrl(item.tx)} target="_blank" rel="noreferrer">Transaction <ExternalLink size={13} /></a>}</div></li>)}</ol> : <p className="mg-feed-empty">{failed.includes('sales') ? 'Sales feed unavailable. Retry shortly.' : loading ? 'Loading sales…' : 'No recent sales returned.'}</p>}</div></div></div>
    <p className="mg-footnote">Market figures can change quickly. The official market API caches up to five minutes; burns cache about 15 seconds, and OpenSea sales are read at most once a minute. “Real time” here means automatically refreshed official data, subject to those source delays. N/D means a value was not provided. The USD burn equivalent uses the current token price and is not a historical cost basis. Sources: <a href={`${API}/market`} target="_blank" rel="noreferrer">market</a>, <a href={`${API}/drop`} target="_blank" rel="noreferrer">drop</a>, <a href={`${API}/collectors`} target="_blank" rel="noreferrer">collectors</a>, <a href={`${API}/offering`} target="_blank" rel="noreferrer">offering</a>, <a href={`${API}/burns`} target="_blank" rel="noreferrer">burns</a>, <a href={`${API}/pot`} target="_blank" rel="noreferrer">pot</a>, <a href={`${API}/sales?limit=8`} target="_blank" rel="noreferrer">sales</a>.</p>
  </div></section>
}
