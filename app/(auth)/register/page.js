import prisma from '@/lib/prisma'
import { isPublicRegistrationEnabled } from '@/lib/env'
import RegisterForm from './RegisterForm'

export default async function RegisterPage() {
  const userCount = await prisma.user.count()
  const canRegister = userCount === 0 || isPublicRegistrationEnabled()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Bid<span style={{ color: '#185FA5' }}>Flow</span>
          </h1>
          <p className="text-slate-500 mt-2 text-sm">Tender & Contract Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {canRegister ? (
            <RegisterForm />
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Registration disabled</h2>
              <p className="text-slate-500 text-sm">
                Online self-registration is turned off for this workspace. Ask your admin to create your account.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
