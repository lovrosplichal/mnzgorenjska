import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const koren = document.getElementById('root')
if (!koren) throw new Error('Manjka <div id="root"> v index.html')

ReactDOM.createRoot(koren).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
