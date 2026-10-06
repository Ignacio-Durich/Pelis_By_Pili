import { AuthGate } from '../features/auth/AuthGate'
import { CoupleGate } from '../features/couple/CoupleGate'
import { Home } from './Home'

export function App() {
  return (
    <AuthGate>
      <CoupleGate>
        <Home />
      </CoupleGate>
    </AuthGate>
  )
}
