import { Outlet } from 'react-router-dom'
import Seo from '../components/seo/Seo'
import AuthFormWrapper from '../components/auth/AuthFormWrapper'

export default function AuthLayout() {
  return (
    <AuthFormWrapper>
      <Seo noindex />
      <Outlet />
    </AuthFormWrapper>
  )
}
