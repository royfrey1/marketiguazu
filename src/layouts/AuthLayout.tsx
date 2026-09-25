import { Outlet } from 'react-router-dom'
import AuthFormWrapper from '../components/auth/AuthFormWrapper'

export default function AuthLayout() {
  return (
    <AuthFormWrapper>
      <Outlet />
    </AuthFormWrapper>
  )
}
