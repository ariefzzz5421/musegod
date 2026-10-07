import { useEffect, useMemo, useState } from 'react'
import { usePrivy, useSignMessage, useWallets } from '@privy-io/react-auth'
import { verifyMessage } from 'viem'
import {
  ArrowDownRight, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight,
  CircleHelp, Copy, ExternalLink, Fingerprint, Globe2, KeyRound, LayoutGrid,
  Link2, LoaderCircle, Menu, MessageCircle, RefreshCw, ShieldCheck, Sparkles,
  Wallet, X,
} from 'lucide-react'
import { fetchMuse, fetchOwnedMuses, MuseDetail, MuseSummary, safeMuseUrl, shortAddress, SITE } from './muse'

type Screen = 'overview' | 'collection' | 'guide'
type WalletState = { address: string; verifiedAt: number }

const FEATURED = [536, 9, 453]

function App({ configured }: { configured: boolean }) {
  return configured ? <ConnectedApp /> : <UnconfiguredApp />
}

function UnconfiguredApp() {
  const [screen, setScreen] = useState<Screen>('overview')
  return <Shell screen={screen} setScreen={setScreen} address={null} verified={false} onConnect={() => undefined} configured={false}>
    {screen === 'guide' ? <Guide /> : screen === 'collection' ? <section className="verify-section container"><div className="verify-card"><div className="verify-icon"><KeyRound size={30} /></div><span className="section-kicker">SETUP REQUIRED</span><h1>Connect your wallet.</h1><p>Add the public Privy App ID to <code>VITE_PRIVY_APP_ID</code> and restart the site. Follow the steps in the README.</p></div></section> : <Overview onConnect={() => undefined} configured={false} />}
  </Shell>
}

function ConnectedApp() {
  const { ready, authenticated, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const { signMessage } = useSignMessage()
  const [screen, setScreen] = useState<Screen>('overview')
  const [walletIndex, setWalletIndex] = useState(0)
  const [verification, setVerification] = useState<WalletState | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [muses, setMuses] = useState<MuseSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const wallet = wallets[walletIndex] ?? wallets[0]
  const address = authenticated ? wallet?.address ?? null : null
  const verified = Boolean(address && verification?.address.toLowerCase() === address.toLowerCase())

  useEffect(() => {
    setVerification(null)
    setMuses([])
    setVerifyError('')
  }, [address])

  useEffect(() => {
    if (!verified || !address) return
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    fetchOwnedMuses(address, controller.signal)
      .then(setMuses)
      .catch((error: Error) => { if (!controller.signal.aborted) setLoadError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [address, verified, refreshKey])

  async function verifyWallet() {
    if (!address || verifying) return
    setVerifying(true)
    setVerifyError('')
    try {
      const nonce = crypto.randomUUID()
      const issued = new Date().toISOString()
      const message = `MUSEGOD Agent Studio\n\nVerify that I control ${address}.\nOrigin: ${window.location.origin}\nNonce: ${nonce}\nIssued at: ${issued}\n\nThis signature is free and does not authorize a transaction or agent access.`
      const { signature } = await signMessage({ message }, { address })
      const valid = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` })
      if (!valid) throw new Error('Signature did not match this wallet. Try again.')
      setVerification({ address, verifiedAt: Date.now() })
      setScreen('collection')
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : 'Signature was not completed.')
    } finally {
      setVerifying(false)
    }
  }

  function disconnect() {
    setVerification(null)
    setMuses([])
    setWalletIndex(0)
    setScreen('overview')
    void logout()
  }

  return <Shell screen={screen} setScreen={setScreen} address={address} verified={verified} onConnect={login} onDisconnect={disconnect} ready={ready}>
    {screen === 'overview' && <Overview onConnect={login} configured />}
    {screen === 'collection' && <>
      {!address ? <ConnectionGate onConnect={login} /> : !verified ? <VerificationGate address={address} onVerify={verifyWallet} verifying={verifying} error={verifyError} /> :
        <Collection address={address} wallets={wallets.map((item) => item.address)} walletIndex={walletIndex} setWalletIndex={setWalletIndex} muses={muses} loading={loading} error={loadError} onRefresh={() => setRefreshKey((value) => value + 1)} verifiedAt={verification?.verifiedAt ?? 0} />}
    </>}
    {screen === 'guide' && <Guide />}
  </Shell>
}

function Shell({ children, screen, setScreen, address, verified, onConnect, onDisconnect, ready = true, configured = true }: {
  children: React.ReactNode; screen: Screen; setScreen: (screen: Screen) => void; address: string | null; verified: boolean;
  onConnect: () => void; onDisconnect?: () => void; ready?: boolean; configured?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = (target: Screen) => { setScreen(target); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return <div className="site-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={() => navigate('overview')} aria-label="MUSEGOD Agent Studio home"><span className="brand-mark">✳</span><span>MUSEGOD<span className="brand-dot">.</span></span><span className="brand-sub">AGENT STUDIO</span></button>
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={screen === 'overview' ? 'active' : ''} onClick={() => navigate('overview')}>Overview</button>
          <button className={screen === 'collection' ? 'active' : ''} onClick={() => navigate('collection')}>My muses</button>
          <button className={screen === 'guide' ? 'active' : ''} onClick={() => navigate('guide')}>How it works</button>
        </nav>
        <div className="header-actions">
          {address ? <><div className="wallet-pill"><span className="live-dot" />{shortAddress(address)}{verified && <ShieldCheck size={15} aria-label="Verified" />}</div><button className="disconnect-button" onClick={onDisconnect} title="Disconnect wallet" aria-label="Disconnect wallet"><X size={16} /></button></> :
            <button className="button button-small button-gold" disabled={!ready || !configured} onClick={onConnect}><Wallet size={16} /> Connect wallet</button>}
          <button className="menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">
        <button onClick={() => navigate('overview')}>Overview <ChevronRight size={17} /></button>
        <button onClick={() => navigate('collection')}>My muses <ChevronRight size={17} /></button>
        <button onClick={() => navigate('guide')}>How it works <ChevronRight size={17} /></button>
        {address && <button onClick={() => { onDisconnect?.(); setMenuOpen(false) }}>Disconnect <X size={17} /></button>}
      </nav>}
    </header>
    <main>{children}</main>
    <footer className="footer"><div className="container footer-inner"><div><span className="footer-logo">✳ MUSEGOD.</span><p>An independent workspace for your muses.<br />Collection data from the official MUSEGOD API.</p></div><div className="footer-links"><a href={`${SITE}/docs`} target="_blank" rel="noreferrer">Official docs <ExternalLink size={14} /></a><a href={`${SITE}/muses`} target="_blank" rel="noreferrer">Explore collection <ExternalLink size={14} /></a><a href="https://docs.privy.io" target="_blank" rel="noreferrer">About Privy <ExternalLink size={14} /></a></div></div></footer>
  </div>
}

function Overview({ onConnect, configured }: { onConnect: () => void; configured: boolean }) {
  return <>
    <section className="hero"><div className="container hero-grid">
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> YOUR MUSES, YOUR WORLD</div><h1>Give your muse<br /><em>a voice.</em></h1><p>Connect your wallet. Discover the MUSEGOD NFTs you own. Turn each onchain soul into an AI character you can actually use.</p><div className="hero-actions"><button className="button button-gold button-large" onClick={onConnect} disabled={!configured}><Wallet size={19} /> Connect your wallet <ArrowRight size={18} /></button><a className="text-link" href={`${SITE}/muses`} target="_blank" rel="noreferrer">Explore all 999 <ArrowRight size={16} /></a></div>{!configured && <div className="setup-notice"><KeyRound size={19} /><div><strong>Privy setup needed</strong><span>Add your public VITE_PRIVY_APP_ID to .env.local to enable wallet connection. See README.</span></div></div>}<div className="hero-footnote"><ShieldCheck size={16} /> A signature proves ownership. No gas, transfers, or wallet delegation.</div></div>
      <div className="hero-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-art-label"><Sparkles size={16} /> MEET THE MUSES</div><div className="hero-card hero-card-back"><img src={`${SITE}/muse/art/480/9.jpg?v=2`} alt="MUSEGOD muse Crouton" /></div><div className="hero-card hero-card-front"><img src={`${SITE}/muse/art/480/536.jpg?v=2`} alt="MUSEGOD muse Hornwort" /></div><div className="art-caption">999 characters · 999 onchain souls</div></div>
    </div></section>
    <section className="flow-section"><div className="container"><div className="section-heading"><div><span className="section-kicker">THE WORKFLOW</span><h2>From wallet to wonder.</h2></div><p>Your NFT is more than an image. Its onchain soul describes how your muse speaks, thinks, and helps.</p></div><div className="flow-grid">
      <div className="flow-card"><span className="flow-number">01</span><div className="flow-icon"><Wallet size={23} /></div><h3>Connect & verify</h3><p>Sign in with Privy, then sign a free message to confirm the wallet you want to explore.</p></div>
      <div className="flow-card"><span className="flow-number">02</span><div className="flow-icon"><LayoutGrid size={23} /></div><h3>Meet your muses</h3><p>Your current NFTs are loaded from MUSEGOD's public ownership API, with names, art, and traits.</p></div>
      <div className="flow-card"><span className="flow-number">03</span><div className="flow-icon"><MessageCircle size={23} /></div><h3>Put them to work</h3><p>Read each soul, copy its adoption prompt, and use it in the AI tool you already love.</p></div>
    </div></div></section>
    <section className="explore-section"><div className="container explore-grid"><div><span className="section-kicker">MADE FOR AGENTS</span><h2>Every muse has<br /><em>its own soul.</em></h2><p>Character, voice, boundaries, and personality live with the NFT. Your studio gives you a clear place to discover and use them.</p><a className="button button-outline" href={`${SITE}/docs#agents`} target="_blank" rel="noreferrer">Read the official agent docs <ArrowRight size={17} /></a></div><div className="explore-visual"><div className="code-label"><span className="live-dot" /> SOUL.md · ONCHAIN</div><pre>{`# SOUL.md\n\ni'm hornwort, a small plush frog.\ni serve calliope, muse of epic poetry.\n\n## tone\ncool, proud, easygoing\n\n## how i help\ni answer what you asked first...`}</pre><div className="code-bottom">ERC-8048 RECORD <ArrowDownRight size={16} /></div></div></div></section>
    <section className="showcase-section"><div className="container"><div className="section-heading"><div><span className="section-kicker">A GLIMPSE OF THE COLLECTION</span><h2>Get to know the muses.</h2></div><a className="text-link" href={`${SITE}/muses`} target="_blank" rel="noreferrer">View official gallery <ArrowRight size={16} /></a></div><div className="showcase-grid">{FEATURED.map((id, index) => <a className="showcase-card" key={id} href={`${SITE}/muse/${id}`} target="_blank" rel="noreferrer"><div className="showcase-image"><img src={`${SITE}/muse/art/480/${id}.jpg?v=2`} alt={`Muse #${id}`} loading="lazy" /><span>#{String(id).padStart(3, '0')}</span></div><div><span>{['COMMON · CALLIOPE', 'RARE · URANIA', 'ASCENDED · CALLIOPE'][index]}</span><h3>{['Hornwort', 'Crouton', 'Bastion'][index]}</h3></div><ArrowUpRightIcon /></a>)}</div></div></section>
  </>
}

function ArrowUpRightIcon() { return <ArrowRight className="card-arrow" size={20} /> }

function ConnectionGate({ onConnect }: { onConnect: () => void }) {
  return <section className="gate-section container"><div className="gate-art"><img src={`${SITE}/muse/art/480/536.jpg?v=2`} alt="Hornwort muse" /></div><div className="gate-content"><span className="section-kicker">YOUR COLLECTION</span><h1>Your muses live here.</h1><p>Connect the wallet that holds your MUSEGOD NFTs. Once you verify it, your collection and agent tools appear here.</p><button className="button button-gold button-large" onClick={onConnect}><Wallet size={19} /> Connect wallet <ArrowRight size={18} /></button><div className="gate-note"><ShieldCheck size={17} /> Read-only NFT discovery. Nothing is moved or approved.</div></div></section>
}

function VerificationGate({ address, onVerify, verifying, error }: { address: string; onVerify: () => void; verifying: boolean; error: string }) {
  return <section className="verify-section container"><div className="verify-card"><div className="verify-icon"><Fingerprint size={32} /></div><span className="section-kicker">ONE LAST STEP</span><h1>Verify your wallet.</h1><p>Sign a free message to prove you control <strong>{shortAddress(address)}</strong>. This unlocks your personal studio in this browser session.</p><div className="verify-address"><Wallet size={18} /> {address}</div><button className="button button-gold button-large" onClick={onVerify} disabled={verifying}>{verifying ? <LoaderCircle size={19} className="spin" /> : <Fingerprint size={19} />}{verifying ? 'Waiting for signature…' : 'Sign to verify'}<ArrowRight size={17} /></button>{error && <p className="inline-error" role="alert">{error}</p>}<div className="verify-safe"><ShieldCheck size={17} /> No gas fee · No transaction · No token approval</div></div></section>
}

function Collection({ address, wallets, walletIndex, setWalletIndex, muses, loading, error, onRefresh, verifiedAt }: {
  address: string; wallets: string[]; walletIndex: number; setWalletIndex: (index: number) => void;
  muses: MuseSummary[]; loading: boolean; error: string; onRefresh: () => void; verifiedAt: number
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<MuseDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setSelectedId(muses[0]?.id ?? null) }, [address, muses])
  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    const controller = new AbortController()
    setDetail(null); setDetailLoading(true); setDetailError(''); setCopied(false)
    fetchMuse(selectedId, controller.signal).then((result) => {
      if (result.owner && typeof result.owner === 'object' && 'address' in result.owner && String(result.owner.address).toLowerCase() !== address.toLowerCase()) {
        throw new Error('This muse is no longer held by the connected wallet. Refresh your collection.')
      }
      setDetail(result)
    }).catch((error: Error) => { if (!controller.signal.aborted) setDetailError(error.message) }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selectedId, address])
  useEffect(() => { setNotes(selectedId ? localStorage.getItem(`musegod:notes:${address.toLowerCase()}:${selectedId}`) ?? '' : ''); setSaved(false) }, [address, selectedId])
  const visibleMuses = useMemo(() => muses.filter((muse) => `${muse.name} ${muse.id} ${muse.tier}`.toLowerCase().includes(search.toLowerCase())), [muses, search])
  async function copyPrompt() {
    if (!detail) return
    try {
      const response = await fetch(safeMuseUrl(detail.links?.prompt, `${SITE}/muse/${detail.id}.txt`))
      if (!response.ok) throw new Error(`Prompt returned ${response.status}`)
      await navigator.clipboard.writeText(await response.text())
      setCopied(true); window.setTimeout(() => setCopied(false), 2500)
    } catch { setDetailError('Could not copy the prompt. Open it on MUSEGOD instead.') }
  }
  function saveNotes() {
    if (!selectedId) return
    localStorage.setItem(`musegod:notes:${address.toLowerCase()}:${selectedId}`, notes)
    setSaved(true)
  }

  return <section className="dashboard-section container"><div className="dashboard-top"><div><span className="section-kicker">YOUR AGENT STUDIO</span><h1>My muses<span className="title-period">.</span></h1><p>Meet the characters in your wallet and shape how you use them.</p></div><div className="dashboard-tools"><div className="verified-badge"><ShieldCheck size={16} /> Verified {new Date(verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><button className="icon-button" onClick={onRefresh} aria-label="Refresh collection" title="Refresh collection"><RefreshCw size={18} /></button></div></div>
    <div className="profile-strip"><div className="profile-avatar"><Wallet size={23} /></div><div className="profile-address"><span>CONNECTED WALLET</span><strong>{shortAddress(address)}</strong></div><div className="profile-stat"><strong>{loading ? '…' : error ? '—' : muses.length}</strong><span>MUSES OWNED</span></div><div className="profile-stat"><strong>4663</strong><span>ROBINHOOD CHAIN</span></div>{wallets.length > 1 && <label className="wallet-switch">Wallet <select value={walletIndex} onChange={(event) => setWalletIndex(Number(event.target.value))}>{wallets.map((item, index) => <option key={`${item}-${index}`} value={index}>{shortAddress(item)}</option>)}</select><ChevronDown size={14} /></label>}</div>
    {error ? <div className="state-panel error-panel" role="alert"><CircleHelp size={24} /><div><strong>Collection unavailable</strong><p>{error} Your NFTs have not been assumed empty.</p></div><button className="button button-outline" onClick={onRefresh}>Retry</button></div> : loading ? <div className="state-panel"><LoaderCircle size={24} className="spin" /><div><strong>Finding your muses…</strong><p>Reading current ownership from MUSEGOD.</p></div></div> : muses.length === 0 ? <div className="state-panel empty-panel"><Sparkles size={26} /><div><strong>No MUSEGOD NFTs found in this wallet</strong><p>Check that you connected the wallet holding them. Ownership data may update within about a minute.</p><a href={`${SITE}/muses`} target="_blank" rel="noreferrer">Explore the collection <ArrowRight size={15} /></a></div></div> :
      <div className="studio-grid"><div className="studio-list"><div className="list-header"><div><span className="section-kicker">YOUR COLLECTION</span><h2>{muses.length} {muses.length === 1 ? 'muse' : 'muses'} in your care</h2></div></div><label className="search-box"><span className="sr-only">Search your muses</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, number, or tier…" /></label><div className="muse-list">{visibleMuses.map((muse) => <button key={muse.id} className={`muse-list-card ${selectedId === muse.id ? 'selected' : ''}`} onClick={() => setSelectedId(muse.id)}><img src={`${SITE}/muse/art/480/${muse.id}.jpg?v=2`} alt={muse.name} loading="lazy" /><span className="muse-card-text"><small>{muse.tier.toUpperCase()} · #{String(muse.id).padStart(3, '0')}</small><strong>{muse.name}</strong><span>{muse.traits?.['Patron Muse'] ? `Muse of ${muse.traits['Patron Muse']}` : `Rank #${muse.rank}`}</span></span><ChevronRight size={19} /></button>)}{visibleMuses.length === 0 && <div className="list-empty">No muse matches “{search}”.</div>}</div><div className="source-note"><Globe2 size={15} /> Live ownership from <a href={`${SITE}/docs`} target="_blank" rel="noreferrer">musegod.org</a> · refresh to check transfers</div></div>
      <div className="detail-panel">{detailLoading ? <div className="detail-state"><LoaderCircle className="spin" size={28} />Loading this muse's soul…</div> : detailError && !detail ? <div className="detail-state error-panel" role="alert">{detailError}</div> : detail ? <><div className="detail-hero"><img src={`${SITE}/muse/art/960/${detail.id}.jpg?v=2`} alt={detail.name} /><div className="detail-hero-overlay"><span>{detail.tier.toUpperCase()} · RANK #{detail.rank}</span><h2>{detail.name}</h2><span>MUSE #{String(detail.id).padStart(3, '0')}</span></div></div><div className="detail-body"><div className="detail-heading"><div><span className="section-kicker">YOUR MUSE, YOUR AGENT</span><h3>Meet {detail.name}.</h3></div><span className="agent-tag"><Sparkles size={14} /> Agent #{detail.agent?.agentId ?? '—'}</span></div><p className="muse-intro">{detail.soul?.intro ?? 'This muse has an onchain character to explore.'}</p><div className="trait-row">{Object.entries(detail.traits ?? {}).filter(([key]) => ['Species', 'Patron Muse', 'Expression', 'Title'].includes(key)).slice(0, 3).map(([key, value]) => <span key={key}><small>{key}</small>{value}</span>)}</div><div className="soul-box"><div><BookOpen size={18} /><strong>From the soul</strong><span>{detail.soul?.source === 'chain' ? 'ONCHAIN' : 'SOURCE: MUSEGOD'}</span></div><p>{detail.soul?.help ?? detail.soul?.line ?? 'Open the full soul to discover this character.'}</p></div><div className="agent-actions"><button className="button button-gold" onClick={copyPrompt}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copied prompt' : 'Copy agent prompt'}</button><a className="button button-outline" href={safeMuseUrl(detail.links?.page, `${SITE}/muse/${detail.id}`)} target="_blank" rel="noreferrer">Full muse profile <ExternalLink size={16} /></a></div>{detailError && <p className="inline-error" role="alert">{detailError}</p>}<p className="action-hint">Paste the prompt into ChatGPT, Claude, or another AI to chat in this muse's voice.</p><div className="agent-links"><a href={`${SITE}/m/${detail.id}/agent`} target="_blank" rel="noreferrer">Official agent tools <ExternalLink size={14} /></a><a href={`${SITE}/m/${detail.id}/flock`} target="_blank" rel="noreferrer">Join the Flock <ExternalLink size={14} /></a></div><div className="notes-area"><div><strong>My agent notes</strong><span>Saved only in this browser for this wallet and muse.</span></div><textarea value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false) }} placeholder="Ideas, tasks, and ways you want to use this muse…" rows={4} maxLength={3000} /><button className="button button-outline" onClick={saveNotes}>{saved ? <Check size={16} /> : null}{saved ? 'Saved locally' : 'Save notes'}</button></div></div></> : <div className="detail-state">Choose a muse to see its soul.</div>}</div></div>}
  </section>
}

function Guide() {
  const [openStep, setOpenStep] = useState(0)
  const steps = [
    { title: 'Connect the wallet that holds your muse', text: 'Choose an EVM wallet in Privy. The wallet login itself signs an authentication message. If you have multiple wallets, select the one holding your NFT in the profile.', icon: Wallet },
    { title: 'Sign the verification message', text: 'Sign a second, clearly labeled message in your wallet. The app checks that the signature matches the selected address. There is no gas fee, approval, or transaction.', icon: Fingerprint },
    { title: 'Open your muse and read its soul', text: 'Your studio loads current ownership and each muse’s SOUL.md from MUSEGOD. The soul describes its voice, values, boundaries, and how it helps.', icon: BookOpen },
    { title: 'Copy the prompt into your AI', text: 'Use “Copy agent prompt” on a muse card, then paste it into a new ChatGPT or Claude conversation as an initial instruction. Tell the muse what task you want it to help with.', icon: Copy },
    { title: 'Keep your own workflow notes', text: 'Write ideas or tasks beside the muse and save them in this browser. Notes are local to this device; they do not change the NFT or its onchain soul.', icon: Sparkles },
  ]
  return <section className="guide-section"><div className="container"><div className="guide-hero"><div><span className="section-kicker">THE FIELD GUIDE</span><h1>Make your NFT<br /><em>come alive.</em></h1><p>A practical path from owning a MUSEGOD NFT to using its character as an AI agent.</p></div><div className="guide-hero-card"><span>THE SIMPLE VERSION</span><div><Wallet size={22} /><ArrowRight size={17} /><Fingerprint size={22} /><ArrowRight size={17} /><MessageCircle size={22} /></div><strong>Wallet → Signature → Your muse</strong></div></div><div className="guide-content"><div className="guide-intro"><span className="section-kicker">START HERE</span><h2>Five steps to your first conversation.</h2><p>The official collection gives every muse a unique soul. Your ownership gives you control of its linked agent identity; using the prompt lets an AI adopt its character.</p><a href={`${SITE}/docs`} target="_blank" rel="noreferrer">Read the official MUSEGOD documentation <ExternalLink size={15} /></a></div><div className="steps-list">{steps.map((step, index) => <div className={`step-item ${openStep === index ? 'open' : ''}`} key={step.title}><button onClick={() => setOpenStep(openStep === index ? -1 : index)} aria-expanded={openStep === index}><span className="step-index">0{index + 1}</span><step.icon size={19} /><strong>{step.title}</strong><ChevronDown size={18} /></button>{openStep === index && <p>{step.text}</p>}</div>)}</div></div><div className="guide-examples"><div><span className="section-kicker">PUT A MUSE TO WORK</span><h2>What can I do with it?</h2></div><div className="example-grid"><div><MessageCircle size={23} /><h3>Character conversations</h3><p>Ask it to brainstorm, write, or explain something in its own voice while keeping the task useful.</p></div><div><Link2 size={23} /><h3>Agent integrations</h3><p>Point an AI workflow at the muse's public <code>/muse/&lt;id&gt;.txt</code> or registration file for its identity and prompt.</p></div><div><Globe2 size={23} /><h3>Explore its identity</h3><p>Open its official profile to inspect traits, onchain soul, linked ERC-8004 agent, and collection links.</p></div></div></div><div className="next-places"><span className="section-kicker">WHERE NEXT</span><h2>Let your muse explore.</h2><p>The official MUSEGOD guide describes ways to bring your muse into other agent spaces. Each service has its own setup; review it before giving an agent permission to act.</p><div><a href={`${SITE}/flock`} target="_blank" rel="noreferrer">The Flock <ExternalLink size={14} /></a><a href={`${SITE}/docs`} target="_blank" rel="noreferrer">Terrakin guide <ExternalLink size={14} /></a><a href={`${SITE}/docs`} target="_blank" rel="noreferrer">Musebook guide <ExternalLink size={14} /></a></div></div><div className="guide-caution"><ShieldCheck size={23} /><div><strong>Your NFT stays in your wallet.</strong><p>This studio reads public collection data and saves notes locally. Copying a prompt does not give an AI control over your wallet. Never paste a seed phrase or private key into an AI chat.</p></div></div></div></section>
}

export default App
