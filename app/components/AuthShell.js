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
    <div className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(24,49,74,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(160,123,57,0.14),_transparent_28%)]" />
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/60 bg-[rgba(255,255,255,0.72)] shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur xl:grid-cols-[1fr_0.88fr]">
        <section className="relative hidden overflow-hidden border-r border-white/60 bg-[linear-gradient(160deg,rgba(10,24,36,0.98),rgba(18,36,54,0.96),rgba(24,49,74,0.94))] p-10 text-white xl:flex xl:flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(160,123,57,0.18),_transparent_24%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="space-y-10">
              <AppLogo href="/" caption="For the built environment, legal and accounting firms behind South Africa's biggest projects" />

              <div className="max-w-md space-y-5">
                <p className="app-kicker text-white/70">{supportingLabel}</p>
                <h1 className="app-display text-5xl font-semibold leading-[1.02] tracking-tight">{title}</h1>
                <p className="max-w-sm text-base leading-7 text-slate-200/82">{supportingDescription}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {highlights.map(item => (
                <div key={item.title} className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.07)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-200/78">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center p-5 sm:p-8 lg:p-10">
          <div className="mx-auto w-full max-w-lg">
            <div className="mb-8 xl:hidden">
              <AppLogo href="/" tone="dark" caption="For the built environment, legal and accounting firms behind South Africa's biggest projects" />
            </div>
            <div className="app-surface rounded-[24px] p-6 sm:p-8">
              <div className="mb-8 space-y-3">
                <p className="app-kicker">{description}</p>
                <h2 className="app-display text-4xl font-semibold leading-tight text-slate-950">{title}</h2>
              </div>
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
