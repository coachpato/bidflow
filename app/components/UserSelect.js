'use client'

import { useEffect, useState } from 'react'

export default function UserSelect({
  value,
  onChange,
  label = 'Assigned user',
  allowUnassigned = true,
  helperText,
}) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function fetchUsers() {
      const response = await fetch('/api/users')
      const data = await response.json()

      if (!isMounted) return

      setUsers(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    fetchUsers().catch(() => {
      if (!isMounted) return
      setUsers([])
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>
      <select
        value={value || ''}
        onChange={event => {
          const selectedValue = event.target.value
          const selectedUser = users.find(user => String(user.id) === selectedValue) || null
          onChange(selectedValue, selectedUser)
        }}
        className="app-select"
        disabled={loading}
      >
        {allowUnassigned ? <option value="">Unassigned</option> : null}
        {users.map(user => (
          <option key={user.id} value={String(user.id)}>
            {user.name} ({user.email})
          </option>
        ))}
      </select>
      {helperText ? (
        <p className="mt-2 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  )
}
