import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import HostCreate from './pages/HostCreate'
import HostRoom from './pages/HostRoom'
import PlayerJoin from './pages/PlayerJoin'
import PlayerRoom from './pages/PlayerRoom'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host/create" element={<HostCreate />} />
      <Route path="/host/:roomCode" element={<HostRoom />} />
      <Route path="/join" element={<PlayerJoin />} />
      <Route path="/play/:roomCode" element={<PlayerRoom />} />
    </Routes>
  )
}

export default App
