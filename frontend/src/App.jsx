import { Navigate, Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Doctor from './pages/Doctor.jsx'
import Reception from './pages/Reception.jsx'

function App() {
  return (
    <div className="min-h-screen bg-bg">
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/doctor" replace />} />
        <Route path="/doctor" element={<Doctor />} />
        <Route path="/reception" element={<Reception />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/doctor" replace />} />
      </Routes>
    </div>
  )
}

export default App
