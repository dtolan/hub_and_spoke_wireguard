import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'

/**
 * Development entry point
 * This file is used for local development and testing only.
 * It will not be included in the library build.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
