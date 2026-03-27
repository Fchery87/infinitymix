'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Zap, Mail, Lock, User, ArrowRight, Github, Check, X, AtSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useCallback, useRef, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterRequest } from '@/lib/utils/validation';

function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);

  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i < score ? colors[score - 1] : 'rgba(255,255,255,0.08)',
              boxShadow: i < score ? `0 0 8px ${colors[score - 1]}40` : 'none',
            }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[score - 1] || 'transparent' }}>
        {labels[score - 1]}
      </p>
    </div>
  );
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setError,
    clearErrors,
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      termsAccepted: false,
    },
    mode: 'onBlur',
  });

  const password = watch('password');
  const username = watch('username');

  const checkUsernameAvailability = useCallback(async (value: string) => {
    if (value.length < 3) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }

    setUsernameStatus('checking');
    setUsernameMessage('Checking availability...');

    try {
      const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(value)}`);
      const data = await res.json();

      if (data.available) {
        setUsernameStatus('available');
        setUsernameMessage('Username is available');
        clearErrors('username');
      } else {
        setUsernameStatus('taken');
        setUsernameMessage(data.error || 'Username is already taken');
        setError('username', { type: 'manual', message: data.error || 'Username is already taken' });
      }
    } catch {
      setUsernameStatus('error');
      setUsernameMessage('Could not verify username');
    }
  }, [clearErrors, setError]);

  const handleUsernameBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const currentValue = username;
    if (currentValue && currentValue.length >= 3 && !errors.username) {
      checkUsernameAvailability(currentValue);
    }
  }, [username, errors.username, checkUsernameAvailability]);

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 3) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }

    setUsernameStatus('idle');
    setUsernameMessage('');
  }, []);

  const onSubmit = async (data: RegisterRequest) => {
    setServerError(null);

    if (usernameStatus === 'taken') {
      setError('username', { type: 'manual', message: 'Username is already taken' });
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'register',
          name: data.name,
          email: data.email,
          password: data.password,
          username: data.username,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setServerError(result?.error || 'Unable to create your account. Please try again.');
        return;
      }

      router.push('/create');
    } catch (err) {
      console.error('Registration failed', err);
      setServerError('Something went wrong. Please try again.');
    }
  };

  const UsernameStatusIcon = () => {
    if (usernameStatus === 'checking') {
      return <div className="absolute right-3 top-3 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />;
    }
    if (usernameStatus === 'available') {
      return <Check className="absolute right-3 top-3 h-4 w-4 text-green-400" />;
    }
    if (usernameStatus === 'taken' || usernameStatus === 'error') {
      return <X className="absolute right-3 top-3 h-4 w-4 text-red-400" />;
    }
    return null;
  };

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
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Join InfinityMix and start creating mashups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {serverError && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                {serverError}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="name">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="name"
                  placeholder="John Doe"
                  className={`pl-10 bg-black/20 border-white/10 ${errors.name ? 'border-red-500/60 focus-visible:ring-red-500' : ''}`}
                  autoComplete="name"
                  {...register('name')}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name.message}</p>
              )}
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="username"
                  placeholder="johndoe"
                  className={`pl-10 pr-10 bg-black/20 border-white/10 ${errors.username || usernameStatus === 'taken' ? 'border-red-500/60 focus-visible:ring-red-500' : usernameStatus === 'available' ? 'border-green-500/60 focus-visible:ring-green-500' : ''}`}
                  autoComplete="username"
                  {...register('username')}
                  onBlur={handleUsernameBlur}
                  onChange={(e) => {
                    register('username').onChange(e);
                    handleUsernameChange(e);
                  }}
                />
                <UsernameStatusIcon />
              </div>
              {errors.username && (
                <p className="text-xs text-red-400">{errors.username.message}</p>
              )}
              {!errors.username && usernameMessage && (
                <p className={`text-xs ${usernameStatus === 'available' ? 'text-green-400' : usernameStatus === 'taken' ? 'text-red-400' : 'text-gray-400'}`}>
                  {usernameMessage}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="email"
                  placeholder="m@example.com"
                  className={`pl-10 bg-black/20 border-white/10 ${errors.email ? 'border-red-500/60 focus-visible:ring-red-500' : ''}`}
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="password"
                  type="password"
                  className={`pl-10 bg-black/20 border-white/10 ${errors.password ? 'border-red-500/60 focus-visible:ring-red-500' : ''}`}
                  autoComplete="new-password"
                  {...register('password')}
                />
              </div>
              <PasswordStrength password={password || ''} />
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
              {!errors.password && password && password.length > 0 && (
                <div className="text-xs text-gray-400 space-y-0.5 mt-1">
                  <p className={password.length >= 8 ? 'text-green-400' : ''}>
                    {password.length >= 8 ? '\u2713' : '\u2022'} At least 8 characters
                  </p>
                  <p className={/[A-Z]/.test(password) ? 'text-green-400' : ''}>
                    {/[A-Z]/.test(password) ? '\u2713' : '\u2022'} One uppercase letter
                  </p>
                  <p className={/[0-9]/.test(password) ? 'text-green-400' : ''}>
                    {/[0-9]/.test(password) ? '\u2713' : '\u2022'} One number
                  </p>
                </div>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2 pt-1">
              <label className="relative flex items-center cursor-pointer select-none mt-0.5">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  {...register('termsAccepted')}
                />
                <div className="h-4 w-4 rounded border border-white/20 bg-black/20 flex items-center justify-center transition-colors peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background">
                  <Check className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
              </label>
              <span className="text-sm text-muted-foreground leading-tight">
                I agree to the{' '}
                <Link href="/terms" className="text-primary hover:underline" target="_blank">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-primary hover:underline" target="_blank">
                  Privacy Policy
                </Link>
              </span>
            </div>
            {errors.termsAccepted && (
              <p className="text-xs text-red-400">{errors.termsAccepted.message}</p>
            )}

            <Button
              className="w-full font-bold"
              variant="glow"
              size="lg"
              type="submit"
              disabled={isSubmitting || usernameStatus === 'checking'}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
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
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
