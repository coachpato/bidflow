import AppLogo from './AppLogo'

export default function AuthShell({
  title,
  description,
  children,
  supportingLabel,
  supportingDescription,
  highlights = [],
}) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 lg:px-8 bg-var(--background)">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(circle_at_top_left,_rgba(24,49,74,0.12),_transparent_35%)]" />
      <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(circle_at_bottom_right,_rgba(160,123,57,0.14),_transparent_28%)]" />

      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-var(--line) bg-var(--surface) shadow-var(--shadow-lg) backdrop-blur xl:grid-cols-[1fr_0.88fr]">
        {/* Left Side - Desktop Only */}
        <section className="relative hidden overflow-hidden border-r border-var(--line) bg-gradient-to-br from-[var(--brand-700)] via-[var(--brand-600)] to-[var(--brand-500)] p-10 text-white xl:flex xl:flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(160,123,57,0.18),_transparent_24%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="space-y-10">
              <AppLogo href="/" caption="" />

              <div className="max-w-md space-y-6">
                <p className="app-kicker text-white/70">{supportingLabel}</p>
                <h1 className="app-display text-4xl font-bold leading-tight">{title}</h1>
                <p className="text-base leading-7 text-white/80">{supportingDescription}</p>
              </div>
            </div>

            <div className="grid gap-4">
              {highlights.map(item => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm hover:bg-white/15 transition"
                >
                  <p className="text-sm font-semibold leading-snug">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Side - Form Area */}
        <section className="flex items-center p-5 sm:p-8 lg:p-12">
          <div className="mx-auto w-full max-w-lg">
            {/* Mobile Logo */}
            <div className="mb-8 xl:hidden">
              <AppLogo href="/" tone="dark" caption="" />
            </div>

            {/* Form Card */}
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="app-kicker">{description}</p>
                <h2 className="app-display text-4xl font-bold leading-tight text-var(--foreground)">
                  {title}
                </h2>
              </div>

              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
