import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import App from './App'
import './styles.css'

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {appId ? (
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ['wallet'],
          appearance: { theme: 'dark', accentColor: '#dbbc83' },
          embeddedWallets: { ethereum: { createOnLogin: 'off' } },
        }}
      >
        <App configured />
      </PrivyProvider>
    ) : (
      <App configured={false} />
    )}
  </React.StrictMode>,
)
