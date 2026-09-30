import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { config } from './config'
import { SendPage } from '../features/send/SendPage'

export default function App() {
  return <BrowserRouter><a className="skip-link" href="#main">Skip to content</a><div className="app-shell">
    <header className="site-header"><div className="brand"><span className="brand-mark" aria-hidden="true">A</span><span>AUTHZ <strong>CONSOLE</strong></span></div><nav aria-label="Main navigation"><NavLink to="/send">Send</NavLink></nav><span className="environment">{config.chainId}</span></header>
    <main id="main"><Routes><Route path="/send" element={<SendPage/>}/><Route path="*" element={<Navigate to="/send" replace/>}/></Routes></main>
    <footer className="site-footer">Authorization research console · V2 transaction path</footer>
  </div></BrowserRouter>
}
