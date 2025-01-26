'use client'
import { useAuthStore } from '@/store/auth-store'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, LogIn, LogOut, UserPlus } from 'lucide-react'

export const AuthButton = () => {
  const { isLoggedIn, clearAuth } = useAuthStore()
  const [showModal, setShowModal] = useState(false)
  const [isLoginView, setIsLoginView] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget as HTMLFormElement)

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isLoginView ? 'login' : 'register',
          email: formData.get('email'),
          password: formData.get('password'),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      useAuthStore.getState().setAuth(data.email)
      setShowModal(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={isLoggedIn ? clearAuth : () => setShowModal(true)}
        variant={isLoggedIn ? 'destructive' : 'outline'}
        className="gap-2"
      >
        {isLoggedIn ? (
          <>
            <LogOut className="h-4 w-4" />
            Sign out
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Sign in
          </>
        )}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="p-0 sm:max-w-[450px]">
          <Card className="border-0">
            <CardContent className="p-0">
              <div className="grid items-stretch">
                <form onSubmit={handleSubmit} className="space-y-6 p-8">
                  <div className="flex flex-col items-center space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">
                      {isLoginView ? 'Welcome back' : 'Create account'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {isLoginView
                        ? 'Sign in to continue your journey'
                        : 'Get started with a free account'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        disabled={loading}
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        disabled={loading}
                        minLength={6}
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="text-center text-sm text-red-500">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full gap-2"
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isLoginView ? 'Sign in' : 'Create account'}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {isLoginView
                          ? "Don't have an account?"
                          : 'Already have an account?'}
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        disabled={loading}
                        onClick={() => {
                          setIsLoginView(!isLoginView)
                          setError(null)
                        }}
                        className="h-auto p-0 text-sm"
                      >
                        {isLoginView ? 'Sign up' : 'Sign in'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  )
}
