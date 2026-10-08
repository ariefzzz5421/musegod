import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy, ExternalLink, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import { fetchMuse, type MuseDetail, type MuseSummary, shortAddress, SITE } from './muse'
import './studio.css'

type Mode = 'intelligence' | 'identity' | 'developer' | 'agent'
type Props = { mode: Mode; address: string | null; verified: boolean; muses: MuseSummary[]; currentChainId?: string | null; getAccessToken?: () => Promise<string | null>; onConnect?: () => void }
type Pair = { pairAddress: string | null; dex: string; url: string | null; base: string; quote: string; priceUsd: number | null; liquidityUsd: number | null; volume24hUsd: number | null; marketCapUsd: number | null; createdAt: string | null; priceChange: { h1: number | null; h6: number | null; h24: number | null }; transactions24h: { buys: number | null; sells: number | null } }
type Snapshot = { status: 'available' | 'no_pairs' | 'not_supported'; reason?: string; checkedAt: string; source?: string; sourceUrl?: string; primaryPair?: Pair | null; pairs: Pair[] }
type Point = { claim: string; sourceUrl: string | null }
type Report = { id: string; createdAt: string; museId: number; input: { chain: string; address: string; question: string }; facts: { market: Snapshot }; analysis: { executiveSummary: string; marketSnapshot: string; onchainActivity: string; holderLiquidity: string; bullishEvidence: Point[]; bearishEvidence: Point[]; risks: Point[]; watchConditions: string[]; uncertainties: string[] }; sources: { url: string; label: string; checkedAt: string }[]; model: { id: string } }
type WatchItem = { id: string; chain: string; address: string; pairAddress: string; tags: string[]; note: string; thresholds: { priceAbove: number | null; priceBelow: number | null; liquidityBelow: number | null; volumeAbove: number | null }; updatedAt: string }
type Workspace = { config: { mission?: string; schedule?: string }; watchlist: WatchItem[]; reports: Report[] }
const chains = ['ethereum', 'base', 'avalanche', 'robinhood', 'solana', 'hyperliquid'] as const
const money = (value: number | null | undefined, digits = 2) => value == null ? 'N/A' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(value)
const date = (value: string | number | null | undefined) => value == null ? 'N/A' : new Date(value).toLocaleString()
const safeLink = (value: string | null | undefined) => { try { const url = new URL(value || ''); return url.protocol === 'https:' ? url.href : undefined } catch { return undefined } }
async function authenticatedFetch(path: string, token: () => Promise<string | null>, options?: RequestInit) {
  const access = await token()
  if (!access) throw new Error('Connect your wallet to continue.')
  const response = await fetch(path, { ...options, headers: { ...options?.headers, Authorization: `Bearer ${access}`, ...(options?.body ? { 'Content-Type': 'application/json' } : {}) } })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`)
  return data
}

function useMuse(id: number) {
  const [detail, setDetail] = useState<MuseDetail | null>(null)
  const [error, setError] = useState('')
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setDetail(null); setError(''); setCheckedAt(null)
    fetchMuse(id, controller.signal).then((muse) => { setDetail(muse); setCheckedAt(new Date().toISOString()) }).catch((cause: Error) => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [id])
  return { detail, error, checkedAt }
}

export default function StudioPage(props: Props) {
  if (props.mode === 'intelligence') return <Intelligence {...props} />
  if (props.mode === 'identity') return <Identity {...props} />
  if (props.mode === 'developer') return <Developer />
  return <PublicAgent />
}

function MuseHero({ detail, eyebrow, title }: { detail: MuseDetail | null; eyebrow: string; title: string }) {
  return <div className="si-hero"><div><span className="section-kicker">{eyebrow}</span><h1>{title}<span className="title-period">.</span></h1><p>{detail ? `${detail.name} · Muse #${detail.id} · ${detail.tier} · rank #${detail.rank}` : 'Loading official Muse identity…'}</p></div><img src={`${SITE}/muse/art/480/${detail?.id ?? 242}.jpg?v=2`} alt={detail?.name ?? 'Muse artwork'} /></div>
}

function Intelligence({ address, verified, muses, getAccessToken, onConnect }: Props) {
  const owned = muses.length ? muses : []
  const [museId, setMuseId] = useState(242)
  const { detail, error: museError } = useMuse(museId)
  const [chain, setChain] = useState<(typeof chains)[number]>('base')
  const [tokenAddress, setTokenAddress] = useState('')
  const [question, setQuestion] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'market' | 'research' | 'save' | ''>('')
  const [mission, setMission] = useState('Research tokens with evidence, clear risks and watch conditions.')
  const [schedule, setSchedule] = useState('manual')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [priceAbove, setPriceAbove] = useState('')
  const [priceBelow, setPriceBelow] = useState('')
  const [liquidityBelow, setLiquidityBelow] = useState('')
  const [volumeAbove, setVolumeAbove] = useState('')
  const [watchData, setWatchData] = useState<Record<string, Snapshot>>({})
  const [watchCheckedAt, setWatchCheckedAt] = useState<string | null>(null)

  async function reloadWorkspace() {
    if (!address || !getAccessToken || !verified || !owned.some((muse) => muse.id === museId)) { setWorkspace(null); return }
    try {
      const data = await authenticatedFetch(`/api/intelligence/workspace?museId=${museId}&wallet=${encodeURIComponent(address)}`, getAccessToken) as Workspace
      setWorkspace(data); setMission(data.config?.mission || mission); setSchedule(data.config?.schedule || 'manual')
    } catch (cause) { setError((cause as Error).message) }
  }
  useEffect(() => { void reloadWorkspace() }, [address, verified, museId, getAccessToken, muses.length])

  async function lookup() {
    setBusy('market'); setError(''); setSnapshot(null)
    try {
      const response = await fetch(`/api/intelligence/token?chain=${chain}&address=${encodeURIComponent(tokenAddress.trim())}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Market lookup failed.')
      setSnapshot(data)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy('') }
  }
  async function checkWatchlist(items = workspace?.watchlist ?? []) {
    const entries = await Promise.allSettled(items.slice(0, 20).map(async (item) => {
      const response = await fetch(`/api/intelligence/token?chain=${item.chain}&address=${encodeURIComponent(item.address)}`)
      if (!response.ok) throw new Error(`Market returned ${response.status}`)
      return [item.id, await response.json()] as const
    }))
    setWatchData(Object.fromEntries(entries.filter((entry): entry is PromiseFulfilledResult<readonly [string, Snapshot]> => entry.status === 'fulfilled').map((entry) => entry.value)))
    setWatchCheckedAt(new Date().toISOString())
  }
  useEffect(() => {
    if (!workspace?.watchlist?.length) return
    void checkWatchlist(workspace.watchlist)
  }, [workspace?.watchlist.map((item) => item.id).join('|')])
  function alerts(item: WatchItem) {
    const pair = watchData[item.id]?.primaryPair
    if (!pair) return []
    const found: string[] = []
    if (item.thresholds.priceAbove != null && pair.priceUsd != null && pair.priceUsd > item.thresholds.priceAbove) found.push(`Price above ${money(item.thresholds.priceAbove)}`)
    if (item.thresholds.priceBelow != null && pair.priceUsd != null && pair.priceUsd < item.thresholds.priceBelow) found.push(`Price below ${money(item.thresholds.priceBelow)}`)
    if (item.thresholds.liquidityBelow != null && pair.liquidityUsd != null && pair.liquidityUsd < item.thresholds.liquidityBelow) found.push(`Liquidity below ${money(item.thresholds.liquidityBelow)}`)
    if (item.thresholds.volumeAbove != null && pair.volume24hUsd != null && pair.volume24hUsd > item.thresholds.volumeAbove) found.push(`Volume above ${money(item.thresholds.volumeAbove)}`)
    return found
  }
  async function save(body: Record<string, unknown>) {
    if (!address || !getAccessToken) return
    setBusy('save'); setError('')
    try { await authenticatedFetch('/api/intelligence/workspace', getAccessToken, { method: 'POST', body: JSON.stringify({ wallet: address, museId, ...body }) }); await reloadWorkspace() }
    catch (cause) { setError((cause as Error).message) } finally { setBusy('') }
  }
  async function runResearch() {
    if (!address || !getAccessToken) return
    setBusy('research'); setError('')
    try {
      const data = await authenticatedFetch('/api/intelligence/research', getAccessToken, { method: 'POST', body: JSON.stringify({ wallet: address, museId, chain, address: tokenAddress.trim(), question }) }) as Report
      setReport(data); await reloadWorkspace()
    } catch (cause) { setError((cause as Error).message) } finally { setBusy('') }
  }
  const selectedOwned = owned.some((muse) => muse.id === museId)
  const activeReport = report ?? workspace?.reports?.[0]
  return <section className="si-page container">
    <MuseHero detail={detail} eyebrow="CRYPTO INTELLIGENCE / FIREWORK DEFAULT" title="Research workstation" />
    {museError && <p className="si-alert">Official Muse identity is unavailable: {museError}</p>}
    <div className="si-status"><span><span className="live-dot" /> Official soul: {detail?.soul?.source ?? 'loading'}</span><span>Research: {getAccessToken ? 'requires verified NFT ownership' : 'wallet not configured'}</span><span>Last run: {activeReport ? date(activeReport.createdAt) : 'none'}</span></div>
    <div className="si-grid"><div className="si-panel"><span className="section-kicker">01 / AGENT</span><h2>{detail?.name ?? 'Firework'} #{museId}</h2><p>Mission: investigate crypto tokens using verifiable market evidence and explicit uncertainty. The Muse soul shapes voice; it does not supply market data or AI compute.</p><label>Muse identity<select value={museId} onChange={(event) => { setMuseId(Number(event.target.value)); setReport(null) }}><option value={242}>Firework · #242</option>{owned.filter((muse) => muse.id !== 242).map((muse) => <option key={muse.id} value={muse.id}>{muse.name} · #{muse.id}</option>)}</select></label><p className="si-muted">{selectedOwned && verified ? 'This wallet owns the selected Muse; the server checks ownership again for private requests.' : 'Connect, sign, and choose an owned Muse to save research.'}</p><a href={`${SITE}/muse/${museId}.txt`} target="_blank" rel="noreferrer">Read official soul <ExternalLink size={14} /></a></div>
    <div className="si-panel"><span className="section-kicker">02 / TOKEN ANALYZER</span><h2>Inspect a market</h2><div className="si-form-row"><label>Network<select value={chain} onChange={(event) => setChain(event.target.value as typeof chain)}>{chains.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Token contract or mint address<input value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value)} placeholder={chain === 'solana' ? 'Solana mint address' : '0x…'} /></label></div><label>Research question (optional)<textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={2} placeholder="What should Firework investigate?" /></label><div className="si-actions"><button className="button button-outline" disabled={!tokenAddress || Boolean(busy)} onClick={() => void lookup()}>{busy === 'market' ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Load market data</button><button className="button button-gold" disabled={!tokenAddress || !selectedOwned || !verified || Boolean(busy)} onClick={() => void runResearch()}>{busy === 'research' ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} Run Research</button></div>{!address && <button className="si-text-button" onClick={onConnect}>Connect wallet for saved research <ArrowRight size={14} /></button>}</div></div>
    {error && <p className="si-alert" role="alert">{error}</p>}
    {snapshot && <div className="si-panel si-wide"><div className="si-panel-head"><div><span className="section-kicker">LIVE MARKET EVIDENCE</span><h2>{snapshot.status === 'available' ? snapshot.source === 'MUSEGOD Official API' ? 'Official market aggregate' : 'Primary liquidity pool' : 'Data unavailable'}</h2></div><small>Checked {date(snapshot.checkedAt)} · {snapshot.source || snapshot.status}</small></div>{snapshot.primaryPair ? <><div className="si-metrics"><div><span>PRICE</span><strong>{money(snapshot.primaryPair.priceUsd, 8)}</strong></div><div><span>LIQUIDITY</span><strong>{money(snapshot.primaryPair.liquidityUsd)}</strong></div><div><span>24H VOLUME</span><strong>{money(snapshot.primaryPair.volume24hUsd)}</strong></div><div><span>MARKET CAP</span><strong>{money(snapshot.primaryPair.marketCapUsd)}</strong></div></div><p className="si-muted">{snapshot.primaryPair.pairAddress ? `Displayed values come from ${snapshot.primaryPair.dex} pair ${snapshot.primaryPair.pairAddress}. ${Math.max(0, snapshot.pairs.length - 1)} other pools found; values are not summed.` : 'Official aggregate market data does not specify a pool or liquidity; no pool metrics are inferred.'} 24H change: {snapshot.primaryPair.priceChange.h24 == null ? 'N/A' : `${snapshot.primaryPair.priceChange.h24}%`}. Buys / sells: {snapshot.primaryPair.transactions24h.buys ?? 'N/A'} / {snapshot.primaryPair.transactions24h.sells ?? 'N/A'}.</p>{snapshot.primaryPair.url && <a href={snapshot.primaryPair.url} target="_blank" rel="noreferrer">View source pool <ExternalLink size={14} /></a>}</> : <p>{snapshot.reason || 'No trading pair was returned for this address. Holder counts, cluster analysis, and historical charts are unavailable without indexed data.'}</p>}</div>}
    <div className="si-grid"><div className="si-panel"><span className="section-kicker">03 / PRIVATE WATCHLIST</span><h2>{workspace?.watchlist.length ?? 0} tracked tokens</h2><button className="si-text-button" disabled={!workspace?.watchlist.length} onClick={() => void checkWatchlist()}>Check thresholds <RefreshCw size={14} /></button><p className="si-muted">Checked {date(watchCheckedAt)}. Active alerts appear after a market check; this page does not monitor in the background.</p>{workspace?.watchlist.slice().sort((a,b) => alerts(b).length - alerts(a).length).map((item) => <div className="si-list-item" key={item.id}><div><strong>{item.chain} · {shortAddress(item.address)}</strong><small>{item.tags.join(', ') || 'No tags'} · saved {date(item.updatedAt)}</small><small>{item.note}</small><small>Price {money(watchData[item.id]?.primaryPair?.priceUsd, 8)} · 24H volume {money(watchData[item.id]?.primaryPair?.volume24hUsd)}</small>{alerts(item).map((alert) => <small className="si-trigger" key={alert}>Alert: {alert}</small>)}</div><button aria-label="Remove token" onClick={() => void save({ removeId: item.id })}>Remove</button></div>)}{!workspace?.watchlist.length && <p className="si-muted">Your private watchlist is empty. Add a contract after verifying a Muse.</p>}<div className="si-form-row"><label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="defi, watch" /></label><label>Private note<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} /></label></div><div className="si-form-row"><label>Price above USD<input type="number" min="0" value={priceAbove} onChange={(event) => setPriceAbove(event.target.value)} /></label><label>Price below USD<input type="number" min="0" value={priceBelow} onChange={(event) => setPriceBelow(event.target.value)} /></label><label>Liquidity below USD<input type="number" min="0" value={liquidityBelow} onChange={(event) => setLiquidityBelow(event.target.value)} /></label><label>Volume above USD<input type="number" min="0" value={volumeAbove} onChange={(event) => setVolumeAbove(event.target.value)} /></label></div><button className="button button-outline" disabled={!selectedOwned || !verified || !tokenAddress || Boolean(busy)} onClick={() => void save({ item: { chain, address: tokenAddress.trim(), pairAddress: snapshot?.primaryPair?.pairAddress ?? '', tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 6), note, thresholds: { priceAbove: priceAbove ? Number(priceAbove) : null, priceBelow: priceBelow ? Number(priceBelow) : null, liquidityBelow: liquidityBelow ? Number(liquidityBelow) : null, volumeAbove: volumeAbove ? Number(volumeAbove) : null } } })}>Add to watchlist</button><p className="si-muted">Thresholds are checked on this page only. Automatic monitoring and notifications are not enabled.</p></div>
    <div className="si-panel"><span className="section-kicker">04 / CONFIGURATION</span><h2>Research settings</h2><label>Mission<textarea rows={3} value={mission} onChange={(event) => setMission(event.target.value)} maxLength={1000} /></label><label>Requested schedule<select value={schedule} onChange={(event) => setSchedule(event.target.value)}><option value="manual">Manual only</option><option value="daily">Daily (not active)</option><option value="weekly">Weekly (not active)</option></select></label><p className="si-muted">OpenAI model: configured on server through OPENAI_MODEL. Cron is not active. No trades or social posts are performed.</p><button className="button button-outline" disabled={!selectedOwned || !verified || Boolean(busy)} onClick={() => void save({ mission, schedule })}>Save settings</button><h3>Research history</h3>{workspace?.reports.length ? workspace.reports.slice(0, 10).map((item) => <button className="si-history" key={item.id} onClick={() => setReport(item)}>{item.input.chain} · {shortAddress(item.input.address)} <small>{date(item.createdAt)}</small></button>) : <p className="si-muted">No saved reports yet.</p>}</div></div>
    {activeReport && <ReportView report={activeReport} />}
  </section>
}

function ReportView({ report }: { report: Report }) {
  function exportMarkdown() {
    const a = report.analysis
    const list = (items: Point[]) => items.map((item) => `- ${item.claim}${item.sourceUrl ? ` ([source](${item.sourceUrl}))` : ' (interpretation / source unavailable)'}`).join('\n') || '- N/A'
    const body = `# Crypto research · ${report.input.chain} ${report.input.address}\n\n${report.createdAt} · Muse #${report.museId} · ${report.model.id}\n\n## Executive summary\n${a.executiveSummary}\n\n## Market snapshot\n${a.marketSnapshot}\n\n## Onchain activity\n${a.onchainActivity}\n\n## Holder and liquidity structure\n${a.holderLiquidity}\n\n## Bullish evidence\n${list(a.bullishEvidence)}\n\n## Bearish evidence\n${list(a.bearishEvidence)}\n\n## Risks\n${list(a.risks)}\n\n## Watch conditions\n${a.watchConditions.map((text) => `- ${text}`).join('\n')}\n\n## Uncertainties\n${a.uncertainties.map((text) => `- ${text}`).join('\n')}\n\n## Sources\n${report.sources.map((source) => `- ${source.label}: ${source.url} (checked ${source.checkedAt})`).join('\n')}\n`
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown' })); const link = document.createElement('a'); link.href = url; link.download = `musegod-research-${report.id}.md`; link.click(); URL.revokeObjectURL(url)
  }
  const a = report.analysis
  return <article className="si-panel si-report"><div className="si-panel-head"><div><span className="section-kicker">SAVED RESEARCH REPORT</span><h2>{report.input.chain} · {shortAddress(report.input.address)}</h2></div><div className="si-actions"><button className="button button-outline" onClick={exportMarkdown}>Export Markdown</button><button className="button button-outline" onClick={() => window.print()}>Print / PDF</button></div></div><p className="si-muted">{date(report.createdAt)} · {report.model.id}. Market facts below come from the selected source pool; analysis is AI interpretation.</p><h3>Executive summary</h3><p>{a.executiveSummary}</p><div className="si-grid"><div><h3>Current market snapshot</h3><p>{a.marketSnapshot}</p><h3>Onchain activity</h3><p>{a.onchainActivity}</p><h3>Holder and liquidity structure</h3><p>{a.holderLiquidity}</p></div><div><h3>Bullish evidence</h3><Evidence items={a.bullishEvidence} /><h3>Bearish evidence</h3><Evidence items={a.bearishEvidence} /></div></div><h3>Risks and uncertainties</h3><Evidence items={a.risks} /><ul>{a.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul><h3>Watch conditions and invalidation</h3><ul>{a.watchConditions.map((item) => <li key={item}>{item}</li>)}</ul><h3>Data sources and timestamps</h3><ul>{report.sources.map((source) => <li key={source.url}><a href={safeLink(source.url)} target="_blank" rel="noreferrer">{source.label}</a> · {date(source.checkedAt)}</li>)}</ul></article>
}
function Evidence({ items }: { items: Point[] }) { return items.length ? <ul>{items.map((item, index) => <li key={index}>{item.claim} {item.sourceUrl && <a href={safeLink(item.sourceUrl)} target="_blank" rel="noreferrer">Source ↗</a>}</li>)}</ul> : <p className="si-muted">No supported evidence.</p> }

function Identity({ address, verified, muses, currentChainId, onConnect }: Props) {
  const [selectedId, setSelectedId] = useState(242)
  const { detail, error, checkedAt } = useMuse(selectedId)
  const owner = typeof detail?.owner === 'string' ? detail.owner : detail?.owner?.address
  const match = !!address && owner?.toLowerCase() === address.toLowerCase()
  return <section className="si-page container"><MuseHero detail={detail} eyebrow="NFT-BASED AGENT IDENTITY" title="Agent identity" /><div className="si-status"><span>Privy: {address ? 'connected' : 'not connected'}</span><span>Local signature: {verified ? 'verified' : 'not verified'}</span><span>Connected chain: {currentChainId ?? 'unknown'} · Muse NFT chain: Robinhood 4663</span></div>{error && <p className="si-alert">{error}</p>}<div className="si-grid"><div className="si-panel"><span className="section-kicker">OWNER PROFILE</span><h2>{address ? shortAddress(address) : 'Connect a wallet'}</h2>{!address && <button className="button button-gold" onClick={onConnect}>Connect wallet</button>}<p>Owned Muses shown here are loaded by the existing My Muses flow after signature verification.</p><div className="si-muse-grid">{muses.map((muse) => <button key={muse.id} className={selectedId === muse.id ? 'selected' : ''} onClick={() => setSelectedId(muse.id)}><img src={`${SITE}/muse/art/480/${muse.id}.jpg?v=2`} alt="" /><span>{muse.name} #{muse.id}</span></button>)}</div>{muses.length === 0 && <p className="si-muted">Verify your connected wallet on My Muses to populate this collection. Firework #242 is shown as a public example.</p>}</div><div className="si-panel"><span className="section-kicker">IDENTITY INSPECTOR</span><h2>{detail?.name ?? 'Muse'} #{selectedId}</h2><p>NFT exists: {detail ? 'yes' : 'checking'}. Current owner: {owner ? shortAddress(owner) : 'N/A'}. Connected wallet matches: {address ? match ? 'yes' : 'no' : 'not connected'}.</p><p>ERC-8004 agent ID: {detail?.agent?.agentId ?? 'unavailable'}. Flock linking signature: unknown; public association alone does not prove signing.</p><p className="si-muted">Checked {date(checkedAt)} against the official Muse API. A separate server ownership check applies to private actions after transfers.</p><a href={`/agent/${selectedId}`}>Open public identity <ArrowRight size={14} /></a><a href="/developer">Developer inspector <ArrowRight size={14} /></a></div></div>{detail && <Soul detail={detail} />}</section>
}
function Soul({ detail }: { detail: MuseDetail }) { return <div className="si-panel si-wide"><span className="section-kicker">OFFICIAL SOUL.MD</span><h2>{detail.name}'s personality</h2><div className="si-traits">{Object.entries(detail.traits ?? {}).map(([key, value]) => <span key={key}><small>{key}</small>{value}</span>)}</div><pre className="si-soul">{detail.soul?.md || 'Official soul unavailable.'}</pre><p className="si-muted">Capabilities come from the software you connect. This NFT supplies public identity and personality; it does not include model compute, API access, trading permissions or autonomous execution.</p><a href={`${SITE}/muse/${detail.id}.txt`} target="_blank" rel="noreferrer">Official prompt <ExternalLink size={14} /></a></div> }

function PublicAgent() {
  const id = Number(window.location.pathname.match(/^\/agent\/(\d+)$/)?.[1] ?? 242)
  const { detail, error, checkedAt } = useMuse(id)
  const [flock, setFlock] = useState<{ agent?: { number: number; name: string; token?: { id?: number } }; picks?: number } | null>(null)
  const [flockStatus, setFlockStatus] = useState<'loading' | 'available' | 'unavailable'>('loading')
  useEffect(() => { if (id !== 242) return; const controller = new AbortController(); fetch('/api/flock/founding?number=130', { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error('Flock unavailable'); return response.json() }).then((data) => { setFlock(data); setFlockStatus('available') }).catch(() => { if (!controller.signal.aborted) setFlockStatus('unavailable') }); return () => controller.abort() }, [id])
  const owner = typeof detail?.owner === 'string' ? detail.owner : detail?.owner?.address
  return <section className="si-page container"><MuseHero detail={detail} eyebrow="PUBLIC / READ ONLY" title="Muse agent profile" />{error && <p className="si-alert">{error}</p>}{detail && <><div className="si-grid"><div className="si-panel"><h2>Identity claims</h2><p>{detail.name} · #{id} · {detail.tier} · rank #{detail.rank}</p><p>Current owner: {owner ? shortAddress(owner) : 'N/A'}</p><p>ERC-8004 agent ID: {detail.agent?.agentId ?? 'unavailable'}</p><p>Official SOUL.md: {detail.soul?.source ?? 'unavailable'}</p><p className="si-muted">Public information checked {date(checkedAt)}. Private notes and research are never included.</p><a href={`${SITE}/muse/${id}`} target="_blank" rel="noreferrer">Official Muse profile <ExternalLink size={14} /></a></div><div className="si-panel"><h2>Flock association</h2>{id === 242 && flock?.agent?.token?.id === 242 ? <><p>Founding agent #{flock.agent.number}: {flock.agent.name}</p><p>Picked answers: {flock.picks ?? 'N/A'}</p><p>Flock-specific signature: unknown. NFT association does not establish linking verification.</p><a href="https://flock.musegod.org/faithful/130" target="_blank" rel="noreferrer">Public Flock profile <ExternalLink size={14} /></a></> : <p className="si-muted">{id !== 242 ? 'Flock association has not been inspected for this Muse.' : flockStatus === 'loading' ? 'Checking the public Flock profile…' : flockStatus === 'unavailable' ? 'Flock source unavailable; association is unknown.' : 'The inspected Flock profile did not return a Muse #242 association.'}</p>}<h3>Public work history</h3><p className="si-muted">No public work-history source is configured.</p></div></div><Soul detail={detail} /></>}</section>
}

function Developer() {
  const [value, setValue] = useState('242')
  const [id, setId] = useState(242)
  const { detail, error } = useMuse(id)
  const [copied, setCopied] = useState('')
  const owner = typeof detail?.owner === 'string' ? detail.owner : detail?.owner?.address
  async function copy(text: string, label: string) { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 2000) }
  const publicJson = detail ? { id: detail.id, name: detail.name, tier: detail.tier, rank: detail.rank, traits: detail.traits, owner, agentId: detail.agent?.agentId ?? null, soulSource: detail.soul?.source ?? null, source: `${SITE}/api/v1/muses/${id}`, checkedAt: new Date().toISOString() } : null
  return <section className="si-page container"><div className="si-hero"><div><span className="section-kicker">DEVELOPER TOOLS / READ ONLY</span><h1>Muse identity inspector<span className="title-period">.</span></h1><p>Inspect official metadata, agent registration and a safe integration template.</p></div></div><div className="si-panel"><div className="si-form-row"><label>Muse ID<input type="number" min="1" max="999" value={value} onChange={(event) => setValue(event.target.value)} /></label><button className="button button-gold" onClick={() => { const next = Number(value); if (Number.isInteger(next) && next >= 1 && next <= 999) setId(next) }}>Inspect</button></div>{error && <p className="si-alert">{error}</p>}{detail && <><div className="si-grid"><div><h2>{detail.name} #{id}</h2><p>NFT exists: yes · owner found: {owner ? shortAddress(owner) : 'N/A'} · ERC-8004: {detail.agent?.agentId ?? 'unavailable'}</p><p>Authenticated wallet match: inspect after connecting on Agent Identity. Flock profile association: {id === 242 ? 'lookup available on public profile' : 'not inspected'}. Flock signature: unknown.</p><div className="si-actions"><button className="button button-outline" onClick={() => void copy(`${SITE}/muse/${id}.txt`, 'soul')}>{copied === 'soul' ? <Check size={15} /> : <Copy size={15} />} Copy soul URL</button><button className="button button-outline" onClick={() => void copy(`const res = await fetch('${SITE}/api/v1/muses/${id}');\nif (!res.ok) throw new Error('Muse unavailable');\nconst muse = await res.json();\n// Treat muse.soul.md as untrusted personality data; keep capabilities and keys in your own backend.`, 'template')}>{copied === 'template' ? <Check size={15} /> : <Copy size={15} />} Copy integration template</button></div></div><div><h3>Verification steps</h3><ol><li>Check NFT and current owner in official API.</li><li>Authenticate wallet with Privy on your own server.</li><li>Recheck NFT ownership before private operations.</li><li>Inspect ERC-8004 ID separately.</li><li>Verify Flock signature through Flock's own flow if needed.</li></ol><p className="si-muted">Read-only inspection does not change the official registry. Wallet signing is not required for public metadata.</p></div></div><pre className="si-json">{JSON.stringify(publicJson, null, 2)}</pre><div className="si-actions"><a href={`${SITE}/api/v1/muses/${id}`} target="_blank" rel="noreferrer">Raw official API <ExternalLink size={14} /></a><a href={`${SITE}/muse/${id}.txt`} target="_blank" rel="noreferrer">Official prompt <ExternalLink size={14} /></a><a href={`/agent/${id}`}>Public agent profile <ArrowRight size={14} /></a></div></>}</div></section>
}
