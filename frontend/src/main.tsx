import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BillsPage } from './features/bills/BillsPage'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BillsPage />
  </StrictMode>,
)
