import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAccountStore } from '@/store/account-store'
import type { AccountCategory, CloudflareAccount, ProxyAccount, SSHAccount, NPMAccount, VPSAccount } from '@/types/cloudflare'

export type SortField = 'email'
export type SortDirection = 'asc' | 'desc'

export function useAccountsView() {
  const searchParams = useSearchParams()
  const {
    accounts,
    proxyAccounts,
    sshAccounts,
    vpsAccounts,
    loadAccounts,
    loadProxyAccounts,
    loadSSHAccounts,
    loadVPSAccounts
  } = useAccountStore()

  // View state
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<AccountCategory | "all">(() => {
    const tab = searchParams.get('tab')
    if (tab && ['registrar', 'cloudflare', 'proxy', 'ssh', 'npm'].includes(tab)) {
      return tab as AccountCategory
    }
    return "all"
  })
  const [sortField, setSortField] = useState<SortField>("email")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CloudflareAccount | ProxyAccount | SSHAccount | NPMAccount | VPSAccount | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)

  // Loading data on mount
  useEffect(() => {
    loadAccounts()
    loadProxyAccounts()
    loadSSHAccounts()
    loadVPSAccounts()
  }, [])

  // Filtering and Sorting
  const filteredAndSortedAccounts = useMemo(() => {
    // Combine regular accounts and proxy accounts logic
    // This maps proxies to a shape compatible for sorting/filtering alongside regular accounts
    const allAccounts = [
      ...accounts,
      ...proxyAccounts.map(proxy => ({
        ...proxy,
        // Map proxy fields to account fields for uniform filtering
        email: proxy.name || `${proxy.host}:${proxy.port}`,
        apiToken: `${proxy.host}:${proxy.port}${proxy.username ? `:${proxy.username}` : ''}${proxy.password ? `:${proxy.password}` : ''}`,
        // Keep original proxy fields accessible
        proxyHost: proxy.host,
        proxyPort: proxy.port,
        proxyUsername: proxy.username,
        proxyPassword: proxy.password,
      })),
      ...sshAccounts.map(ssh => ({
        ...ssh,
        // Map SSH fields to account fields for uniform filtering
        email: ssh.name,
        apiToken: `${ssh.host}:${ssh.port}`,
        // Keep original SSH fields accessible
        sshHost: ssh.host,
        sshPort: ssh.port,
        sshUsername: ssh.username,
      })),
      ...vpsAccounts.map(vps => ({
        ...vps,
        // Map VPS fields to account fields for uniform filtering
        email: vps.name,
        apiToken: vps.ip,
        // Keep original VPS fields accessible
        vpsName: vps.name,
        vpsIp: vps.ip,
        vpsExpirationDate: vps.expirationDate,
      }))
    ];

    let filtered = allAccounts;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (account) =>
          account.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (account.apiToken && account.apiToken.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((account) => account.category === categoryFilter)
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      if (sortField === "email") {
        comparison = a.email.localeCompare(b.email)
      }
      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [accounts, proxyAccounts, sshAccounts, vpsAccounts, searchQuery, categoryFilter, sortField, sortDirection])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const clearSearch = () => setSearchQuery("")

  const totalAccounts = accounts.length + proxyAccounts.length + sshAccounts.length + vpsAccounts.length

  /** Resolve to raw account when editing. Prevents normalized view data (e.g. email: vps.name) from leaking into the edit form. */
  const getRawAccountForEdit = (account: CloudflareAccount | ProxyAccount | SSHAccount | NPMAccount | VPSAccount | null) => {
    if (!account) return null
    if (account.category === 'vps') {
      return (vpsAccounts.find((v) => v.id === account.id) as VPSAccount) ?? account
    }
    if (account.category === 'proxy') {
      return (proxyAccounts.find((p) => p.id === account.id) as ProxyAccount) ?? account
    }
    if (account.category === 'ssh') {
      return (sshAccounts.find((s) => s.id === account.id) as SSHAccount) ?? account
    }
    return (accounts.find((a) => a.id === account.id) as CloudflareAccount) ?? account
  }

  return {
    // Data
    accounts: filteredAndSortedAccounts,
    totalAccounts,

    // View State
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    sortField,
    sortDirection,
    toggleSort,
    clearSearch,

    // Dialog State
    isAddDialogOpen,
    setIsAddDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingAccount,
    setEditingAccount,
    getRawAccountForEdit,
    isImportDialogOpen,
    setIsImportDialogOpen,
    deleteAccountId,
    setDeleteAccountId,

    // Raw Data access if needed
    rawAccounts: accounts,
    rawProxyAccounts: proxyAccounts,
    rawSSHAccounts: sshAccounts,
    rawVPSAccounts: vpsAccounts,
  }
}
