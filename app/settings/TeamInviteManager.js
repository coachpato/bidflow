export default function TeamInviteManager({ members = [], initialInvites = [] }) {
  return (
    <section className="app-surface rounded-[24px] p-5 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="app-kicker">Team</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Team & invites</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Team access controls are coming after the pilot workspace flow is stable. Existing invite links still work, but sending new invites from this page is paused for now.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Coming soon
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace members</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{members.length}</p>
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pending invites</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{initialInvites.length}</p>
        </div>
      </div>
    </section>
  )
}
