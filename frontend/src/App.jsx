import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Doctor from './pages/Doctor.jsx'
import Home from './pages/Home.jsx'
import Reception from './pages/Reception.jsx'

function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen">
      <NavBar />
      {/* browsers with View Transitions animate route changes natively; others get a plain fade */}
      <main key={pathname} className={document.startViewTransition ? '' : 'page-fade'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/doctor" element={<Doctor />} />
          <Route path="/reception" element={<Reception />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
