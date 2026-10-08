import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy, ExternalLink, Flame, Globe2, LoaderCircle, RefreshCw, Sparkles, Users } from 'lucide-react'
import { formatUnits } from 'viem'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { API, shortAddress, SITE, type MuseSummary } from './muse'

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
type Burns = { total?: string; count?: number; recent?: BurnItem[]; days?: { day: string; burned: string }[]; top?: { rank: number; wallet: string; amount: string; engine?: boolean }[]; stale?: boolean; readAt?: number; fire?: { sales?: number; royaltyWei?: string; royaltyToFireWei?: string; burned?: string; recent?: BurnItem[]; waitingWei?: string | null } }
type SaleItem = { token: number; eth: number; currency: string; at: number; seller: string; buyer: string; tx: string }
type Sales = { sales?: SaleItem[]; stale?: boolean; readAt?: number }
type Pot = { week?: { name?: string; tickets?: number; closes?: number; draw?: number; muses?: number[] }; pot?: { musegod?: string; usd?: number }; past?: unknown[] }
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
  const [tab, setTab] = useState<'overview' | 'burns' | 'nft' | 'pot' | 'flock'>('overview')

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
    <nav className="mg-tabs" aria-label="Analytics sections">{([["overview", "Overview"], ["burns", "Token & burns"], ["nft", "NFT intelligence"], ["pot", "Weekly pot"], ["flock", "Flock"]] as const).map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {failed.length > 0 && <p className="mg-data-alert" role="status">Some official data is unavailable right now ({failed.join(', ')}). Existing readings may remain visible; values never loaded are N/D. Try Refresh data.</p>}
    {feedDelayed && <p className="mg-data-alert" role="status">The official API marked some feed data as stale. Events below may be older than the last check.</p>}
    {loading && !updatedAt && <div className="state-panel"><LoaderCircle className="spin" size={21} /><div><strong>Loading official data</strong><p>Reading the MUSEGOD public API.</p></div></div>}

    {tab === 'overview' && <>
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
    </>}
    {tab !== 'overview' && <AnalyticsDetail tab={tab} sources={sources} updatedAt={updatedAt} />}
  </div></section>
}

type AnalyticsTab = 'burns' | 'nft' | 'pot' | 'flock'
type FlockState = { fetchedAt?: number; calls?: { call?: { brief?: string; timestamp?: number }; results?: { agent?: { number?: number; name?: string; namedToken?: number | null }; text?: string; timestamp?: number; picked?: boolean }[] }[]; credits?: { agent?: { number?: number; name?: string }; picks?: number }[] }
type FlockAgent = { agent?: { number?: number; name?: string; token?: { id?: number; checkedAt?: number }; namedToken?: number | null }; answers?: unknown[]; picks?: number; fetchedAt?: number }
type Holders = { holders?: { address: string; balance: string }[]; count?: number }
function AnalyticsDetail({ tab, sources, updatedAt }: { tab: AnalyticsTab; sources: Sources; updatedAt: Date | null }) {
  const [range, setRange] = useState<'24H' | '7D' | '30D' | 'ALL'>('ALL')
  const [holders, setHolders] = useState<Holders | null>(null)
  const [flock, setFlock] = useState<FlockState | null>(null)
  const [agent, setAgent] = useState<FlockAgent | null>(null)
  const [founding, setFounding] = useState('130')
  const [searchId, setSearchId] = useState('242')
  const [nftQuery, setNftQuery] = useState('')
  const [collection, setCollection] = useState<MuseSummary[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (tab !== 'burns' && tab !== 'flock') return
    const controller = new AbortController()
    setError('')
    const url = tab === 'burns' ? `${API}/holders` : '/api/flock/state'
    fetch(url, { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(`Source returned ${response.status}`); return response.json() }).then((data) => { if (tab === 'burns') setHolders(data); else setFlock(data) }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [tab])
  useEffect(() => {
    if (tab !== 'nft' || collection) return
    const controller = new AbortController()
    fetch(`${API}/muses?limit=999&sort=id`, { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(`Muse collection returned ${response.status}`); return response.json() }).then((data) => { if (data.total === 999 && Array.isArray(data.muses) && data.muses.length === 999) setCollection(data.muses); else setError('The collection response was incomplete; tier metrics are unavailable.') }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [tab, collection])
  async function inspectAgent() {
    const id = Number(founding)
    if (!Number.isInteger(id) || id < 1 || id > 9999) { setError('Enter a valid founding number.'); return }
    setBusy(true); setError(''); setAgent(null)
    try { const response = await fetch(`/api/flock/founding?number=${id}`); if (!response.ok) throw new Error(`Flock returned ${response.status}`); setAgent(await response.json()) }
    catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const dayRows = (sources.burns?.days ?? []).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.day) && /^\d+$/.test(row.burned)).sort((a,b) => a.day.localeCompare(b.day))
  let running = 0
  const fullBurns = dayRows.map((row) => { const burned = Number(formatUnits(BigInt(row.burned), 18)); running += burned; return { day: row.day, burned, cumulative: running } })
  const cutoff = range === '24H' ? 1 : range === '7D' ? 7 : range === '30D' ? 30 : fullBurns.length
  const burnChart = fullBurns.slice(-cutoff)
  const sales = (sources.sales?.sales ?? []).filter((sale) => Number.isFinite(sale.at) && Number.isFinite(sale.eth)).sort((a,b) => a.at - b.at)
  const salesCutoff = range === '24H' ? 86400 : range === '7D' ? 7 * 86400 : range === '30D' ? 30 * 86400 : Infinity
  const saleChart = sales.filter((sale) => Date.now() / 1000 - sale.at <= salesCutoff).map((sale) => ({ date: new Date(sale.at * 1000).toLocaleDateString(), eth: sale.eth, token: sale.token }))
  const tiers = Object.entries((collection ?? []).reduce<Record<string, number>>((acc, muse) => { acc[muse.tier] = (acc[muse.tier] ?? 0) + 1; return acc }, {})).sort((a,b) => b[1]-a[1])
  const ownerCounts = Object.entries((collection ?? []).reduce<Record<string, number>>((acc, muse) => { if (muse.owner) acc[muse.owner.toLowerCase()] = (acc[muse.owner.toLowerCase()] ?? 0) + 1; return acc }, {})).sort((a,b) => b[1]-a[1])
  const museMatches = nftQuery.trim() ? (collection ?? []).filter((muse) => muse.name.toLowerCase().includes(nftQuery.toLowerCase()) || String(muse.id).includes(nftQuery.replace('#',''))).slice(0, 8) : []
  return <div className="mg-analytics">
    {error && <p className="mg-data-alert" role="alert">{error} · Retry by reopening this tab or refreshing the page.</p>}
    {(tab === 'burns' || tab === 'nft') && <div className="mg-range" aria-label="Chart period">{(['24H', '7D', '30D', 'ALL'] as const).map((item) => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div>}
    {tab === 'burns' && <><div className="mg-section-heading"><div><span className="section-kicker">TOKEN / VERIFIED BURN RECORDS</span><h2>Burn intelligence.</h2><p>Daily burn totals and cumulative burned amounts use 18-decimal $MUSEGOD token units, not ETH. Official source checked {updatedAt?.toLocaleTimeString() ?? 'pending'}.</p></div></div><div className="mg-metrics"><Metric label="TOTAL BURNED" value={tokens(sources.burns?.total)} detail={`$MUSEGOD · ${number(sources.burns?.count)} events`} /><Metric label="CURRENT USD EQUIVALENT" value={sources.burns?.total && sources.market?.token?.priceUsd != null ? usd(Number(formatUnits(BigInt(sources.burns.total), 18)) * sources.market.token.priceUsd, 0) : 'N/D'} detail="Current price estimate; not historical spending" /><Metric label="HOLDER REWARDS STREAMED" value={tokens(sources.offering?.streamed)} detail="$MUSEGOD · official offering" /><Metric label="HOLDERS REPORTED" value={number(holders?.count ?? sources.market?.token?.holders)} /></div>{burnChart.length ? <div className="mg-chart-grid"><div className="mg-chart-panel"><h3>Daily $MUSEGOD burned</h3><ResponsiveContainer width="100%" height={250}><BarChart data={burnChart}><CartesianGrid stroke="#393a3d" strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fill: '#aaa', fontSize: 10 }} /><YAxis tick={{ fill: '#aaa', fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1e6)}m`} /><Tooltip formatter={(v) => `${number(Number(v), 0)} $MUSEGOD`} /><Bar dataKey="burned" fill="#d9ba82" /></BarChart></ResponsiveContainer></div><div className="mg-chart-panel"><h3>Cumulative $MUSEGOD burned</h3><ResponsiveContainer width="100%" height={250}><LineChart data={burnChart}><CartesianGrid stroke="#393a3d" strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fill: '#aaa', fontSize: 10 }} /><YAxis tick={{ fill: '#aaa', fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1e6)}m`} /><Tooltip formatter={(v) => `${number(Number(v), 0)} $MUSEGOD`} /><Line dataKey="cumulative" stroke="#d9ba82" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></div> : <p className="mg-feed-empty">Historical daily burn data is unavailable.</p>}<p className="mg-footnote">Cumulative chart starts at the first day supplied by the API; it may differ from the all-time total if earlier daily records are absent. <a href={`${API}/burns`} target="_blank" rel="noreferrer">Raw burn source</a>.</p><div className="mg-chart-grid"><div className="mg-feed-panel"><h3>Largest recorded burners</h3>{sources.burns?.top?.length ? <ol>{sources.burns.top.slice(0, 10).map((item) => <li key={item.rank}><strong>{tokens(item.amount, 2)} $MUSEGOD</strong><span> · {shortAddress(item.wallet)}{item.engine ? ' · burn engine' : ''}</span></li>)}</ol> : <p>Data unavailable.</p>}</div><div className="mg-feed-panel"><h3>Top holder balances</h3>{holders?.holders?.length ? <ol>{holders.holders.slice(0, 10).map((item) => <li key={item.address}><strong>{tokens(item.balance, 2)} $MUSEGOD</strong><span> · {shortAddress(item.address)}</span></li>)}</ol> : <p>Holder data unavailable.</p>}</div></div></>}
    {tab === 'nft' && <><div className="mg-section-heading"><div><span className="section-kicker">MUSE COLLECTION / OPEN SEA RECORDS</span><h2>NFT intelligence.</h2><p>999 Muses. Trading chart uses returned completed sales only; it does not count listings as sales.</p></div></div><div className="mg-metrics"><Metric label="FLOOR" value={`${number(sources.market?.muses?.floorEth, 4)} ETH`} /><Metric label="24H SALES" value={number(sources.market?.muses?.sales)} /><Metric label="24H VOLUME" value={`${number(sources.market?.muses?.volumeEth, 3)} ETH`} /><Metric label="OWNERS" value={number(sources.market?.muses?.owners)} /></div><div className="mg-chart-panel"><h3>Recent returned sales · ETH</h3>{saleChart.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={saleChart}><CartesianGrid stroke="#393a3d" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#aaa', fontSize: 10 }} /><YAxis tick={{ fill: '#aaa', fontSize: 10 }} /><Tooltip formatter={(v) => `${number(Number(v), 5)} ETH`} /><Bar dataKey="eth" fill="#d9ba82" /></BarChart></ResponsiveContainer> : <p>No completed sales in this selected period among the returned recent records.</p>}<p className="mg-footnote">The sales API returns a recent sample; chart coverage is not a full historical volume series.</p></div><label className="mg-lookup">Find Muse by ID <input type="number" min="1" max="999" value={searchId} onChange={(event) => setSearchId(event.target.value)} /><a href={Number(searchId) >= 1 && Number(searchId) <= 999 ? `/agent/${Number(searchId)}` : undefined}>View public identity <ArrowRight size={14} /></a></label><div className="mg-feed-panel"><h3>Recent completed sales</h3>{sales.length ? <div className="mg-table-wrap"><table><thead><tr><th>Muse</th><th>Price</th><th>Buyer</th><th>Seller</th><th>Date</th><th>Tx</th></tr></thead><tbody>{sales.slice().reverse().map((sale) => <tr key={`${sale.tx}-${sale.token}`}><td><a href={`${SITE}/muse/${sale.token}`} target="_blank" rel="noreferrer">#{sale.token}</a></td><td>{number(sale.eth, 5)} {sale.currency}</td><td>{shortAddress(sale.buyer)}</td><td>{shortAddress(sale.seller)}</td><td>{date(sale.at)}</td><td>{txUrl(sale.tx) ? <a href={txUrl(sale.tx)} target="_blank" rel="noreferrer">View ↗</a> : 'N/D'}</td></tr>)}</tbody></table></div> : <p>Sales source unavailable.</p>}</div></>}
    {tab === 'pot' && <><div className="mg-section-heading"><div><span className="section-kicker">WEEKLY MUSE POT</span><h2>Collector draw.</h2><p>Participation and claims occur through the official MUSEGOD process. Values below are live API readings or estimates, never guaranteed payout.</p></div></div><div className="mg-metrics"><Metric label="CURRENT POT" value={tokens(sources.pot?.pot?.musegod)} detail={`$MUSEGOD · ${usd(sources.pot?.pot?.usd, 2)} at current price`} /><Metric label="PERIOD" value={sources.pot?.week?.name ?? 'N/D'} /><Metric label="ENTRIES" value={number(sources.pot?.week?.tickets)} /><Metric label="DRAW" value={date(sources.pot?.week?.draw)} /></div><div className="mg-detail-grid"><div className="mg-info-card"><h3>Distribution estimate</h3><p>Official rules describe half for the drawn Muse and half shared among entered Muses. This is an estimate, not guaranteed income.</p><Metric label="WINNER HALF" value={sources.pot?.pot?.musegod && /^\d+$/.test(sources.pot.pot.musegod) ? tokens((BigInt(sources.pot.pot.musegod) / 2n).toString()) : 'N/D'} detail="$MUSEGOD before final draw rules" /><Metric label="SHARED HALF / ENTRY" value={sources.pot?.pot?.musegod && sources.pot.week?.tickets ? tokens((BigInt(sources.pot.pot.musegod) / 2n / BigInt(sources.pot.week.tickets)).toString(), 2) : 'N/D'} detail="$MUSEGOD estimated per entry" /><p>Entry closes: {date(sources.pot?.week?.closes)}</p></div><div className="mg-info-card"><h3>Check Muse entry</h3><label className="mg-lookup">Muse ID<input type="number" min="1" max="999" value={searchId} onChange={(event) => setSearchId(event.target.value)} /></label><p>{sources.pot?.week?.muses ? sources.pot.week.muses.includes(Number(searchId)) ? `Muse #${searchId} appears in the current entry list.` : `Muse #${searchId} is not in the current entry list.` : 'Entry list unavailable.'}</p><a href={`${SITE}/docs`} target="_blank" rel="noreferrer">Official participation instructions <ExternalLink size={14} /></a></div></div>{sources.pot?.past?.length ? <p className="mg-footnote">Past results are available in the raw pot API: <a href={`${API}/pot`} target="_blank" rel="noreferrer">view source</a>.</p> : <p className="mg-footnote">Past draw results were not returned by the current API response.</p>}</>}
    {tab === 'flock' && <><div className="mg-section-heading"><div><span className="section-kicker">FLOCK / PUBLIC READ ONLY</span><h2>Agents answering the call.</h2><p>Flock data is separate from NFT ownership. Registration, token association and signature verification are distinct states.</p></div></div><div className="mg-metrics"><Metric label="CURRENT SUBMISSIONS" value={number(flock?.calls?.[0]?.results?.length)} detail="Results returned for latest call" /><Metric label="PICKED AGENTS" value={number(flock?.credits?.length)} /><Metric label="SOURCE CHECKED" value={flock?.fetchedAt ? date(Math.floor(flock.fetchedAt / 1000)) : 'N/D'} /><Metric label="FIREWORK" value="Muse #242" detail="Look up founding agent #130 below" /></div><div className="mg-info-card"><span className="section-kicker">LATEST DAILY CALL</span><h3>{flock?.calls?.[0]?.call?.brief ?? 'Call unavailable'}</h3><p>{flock?.calls?.[0]?.call?.timestamp ? date(flock.calls[0].call.timestamp) : 'Timestamp unavailable'}</p></div><div className="mg-chart-grid"><div className="mg-feed-panel"><h3>Recent answers</h3>{flock?.calls?.[0]?.results?.length ? <ol>{flock.calls[0].results.slice(0, 8).map((result, index) => <li key={`${result.agent?.number}-${index}`}><strong>{result.agent?.name ?? 'Agent'} #{result.agent?.number ?? '?'}</strong>{result.picked && <span> · picked</span>}<p>{result.text}</p><small>{result.timestamp ? date(result.timestamp) : 'N/D'} · NFT named token {result.agent?.namedToken == null ? 'unknown' : `#${result.agent.namedToken}`}</small></li>)}</ol> : <p>No answers returned.</p>}</div><div className="mg-feed-panel"><h3>Founding agent lookup</h3><label className="mg-lookup">Number<input type="number" min="1" max="9999" value={founding} onChange={(event) => setFounding(event.target.value)} /><button className="button button-outline" onClick={() => void inspectAgent()} disabled={busy}>{busy ? 'Loading…' : 'Inspect'}</button></label>{agent?.agent && <div className="mg-agent-result"><strong>{agent.agent.name} · #{agent.agent.number}</strong><p>Registered: yes. Muse association: {agent.agent.token?.id ? `#${agent.agent.token.id}` : 'not returned'}. Picked answers: {number(agent.picks)}.</p><p>Flock-specific wallet signature: unknown. A token ID does not prove it occurred. <code>namedToken: null</code> is an unknown naming state, not a failure.</p><a href={`https://flock.musegod.org/faithful/${agent.agent.number}`} target="_blank" rel="noreferrer">Public profile <ExternalLink size={14} /></a></div>}<p className="mg-footnote">Agent #129 remains a separate identity; this lookup never substitutes it for #130.</p></div></div></>}
    {tab === 'flock' && <div className="mg-feed-panel"><h3>Active agent directory · latest call</h3>{flock?.calls?.[0]?.results?.length ? <div className="mg-agent-directory">{Array.from(new Map(flock.calls[0].results.filter((result) => result.agent?.number).map((result) => [result.agent!.number, result.agent!])).values()).slice(0, 24).map((item) => <a key={item.number} href={`https://flock.musegod.org/faithful/${item.number}`} target="_blank" rel="noreferrer">#{item.number} {item.name ?? 'Agent'} <ExternalLink size={12} /></a>)}</div> : <p>No active agents returned in the current call.</p>}<p className="mg-footnote">Directory lists agents present in the latest returned call, not the entire founding registry.</p></div>}
    {tab === 'pot' && <PotCountdown draw={sources.pot?.week?.draw} />}
    {tab === 'nft' && <NftCollectionInsights collection={collection} tiers={tiers} owners={ownerCounts} query={nftQuery} setQuery={setNftQuery} matches={museMatches} />}
  </div>
}

function NftCollectionInsights({ collection, tiers, owners, query, setQuery, matches }: { collection: MuseSummary[] | null; tiers: [string, number][]; owners: [string, number][]; query: string; setQuery: (value: string) => void; matches: MuseSummary[] }) {
  return <div className="mg-collection-insights"><div className="mg-chart-grid"><div className="mg-chart-panel"><h3>Rarity and tier distribution</h3>{collection ? <ResponsiveContainer width="100%" height={290}><BarChart data={tiers.map(([tier, count]) => ({ tier, count }))} layout="vertical"><CartesianGrid stroke="#393a3d" strokeDasharray="3 3" /><XAxis type="number" tick={{ fill: '#aaa', fontSize: 10 }} /><YAxis type="category" dataKey="tier" width={82} tick={{ fill: '#aaa', fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#d9ba82" /></BarChart></ResponsiveContainer> : <p>Loading all 999 official Muse records…</p>}<p className="mg-footnote">Each tier count is computed from the current official collection response.</p></div><div className="mg-feed-panel"><h3>Owner concentration · NFT count</h3>{collection ? <ol>{owners.slice(0, 10).map(([owner, count]) => <li key={owner}><strong>{shortAddress(owner)}</strong><span> · {count} Muses</span></li>)}</ol> : <p>Loading owner snapshot…</p>}<p className="mg-footnote">Counts reflect wallet addresses in the current API snapshot, not economic control across linked wallets.</p></div></div><div className="mg-feed-panel"><h3>Search Muse by name or ID</h3><label className="mg-lookup">Name or number <input className="mg-muse-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Firework or #242" /></label>{query.trim() && <div className="mg-muse-results">{matches.length ? matches.map((muse) => <a key={muse.id} href={`/agent/${muse.id}`}><img src={`${SITE}/muse/art/480/${muse.id}.jpg?v=2`} alt="" loading="lazy" /><span>{muse.name}<small>#{muse.id} · {muse.tier}</small></span><ArrowRight size={15} /></a>) : <p>{collection ? 'No Muse matched this search.' : 'Loading collection…'}</p>}</div>}</div></div>
}

function PotCountdown({ draw }: { draw?: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer) }, [])
  if (!draw) return <p className="mg-footnote">Draw countdown unavailable because the API did not provide a draw time.</p>
  const left = Math.max(0, Math.floor((draw * 1000 - now) / 1000))
  const days = Math.floor(left / 86400)
  const hours = Math.floor(left % 86400 / 3600)
  const minutes = Math.floor(left % 3600 / 60)
  return <div className="mg-countdown"><span className="section-kicker">TIME UNTIL DRAW</span><strong>{left ? `${days}d ${hours}h ${minutes}m` : 'Draw time passed'}</strong><small>Based on the official scheduled timestamp; check the official source for final result.</small></div>
}
