'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Zap, Mail, Lock, ArrowRight, Github, Check } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginRequest } from '@/lib/utils/validation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const redirectTo = searchParams?.get('redirect') || '/create';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, touchedFields },
    setError,
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginRequest) => {
    setServerError(null);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'login',
          email: data.email,
          password: data.password,
          rememberMe: data.rememberMe,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setServerError(result?.error || 'Unable to sign in. Please try again.');
        return;
      }

      router.push(redirectTo);
    } catch (err) {
      console.error('Login failed', err);
      setServerError('Something went wrong. Please try again.');
    }
  };

  const emailError = errors.email?.message;
  const passwordError = errors.password?.message;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px]" />
      </div>

      <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border-white/10">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-primary to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-7 h-7 text-white fill-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {serverError && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                {serverError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="email"
                  placeholder="m@example.com"
                  className={`pl-10 bg-black/20 border-white/10 ${emailError && touchedFields.email ? 'border-red-500/60 focus-visible:ring-red-500' : ''}`}
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                />
              </div>
              {emailError && touchedFields.email && (
                <p className="text-xs text-red-400 mt-1">{emailError}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="password"
                  type="password"
                  className={`pl-10 bg-black/20 border-white/10 ${passwordError && touchedFields.password ? 'border-red-500/60 focus-visible:ring-red-500' : ''}`}
                  autoComplete="current-password"
                  {...register('password')}
                />
              </div>
              {passwordError && touchedFields.password && (
                <p className="text-xs text-red-400 mt-1">{passwordError}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="relative flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  {...register('rememberMe')}
                />
                <div className="h-4 w-4 rounded border border-white/20 bg-black/20 flex items-center justify-center transition-colors peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background">
                  <Check className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
              </label>
              <span className="text-sm text-muted-foreground">Remember me for 30 days</span>
            </div>
            <Button
              className="w-full font-bold"
              variant="glow"
              size="lg"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
              {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/api/auth/callback/github'}
            >
              <Github className="w-4 h-4 mr-2" />
              Github
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/api/auth/callback/google'}
            >
              Google
            </Button>
          </div>
          <div className="text-center text-sm text-gray-400 mt-2">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
