import { useState, useMemo, useEffect } from 'react'
import { useAccountStore } from '@/store/account-store'
import type { AccountCategory, CloudflareAccount, ProxyAccount } from '@/types/cloudflare'

export type SortField = 'email'
export type SortDirection = 'asc' | 'desc'

export function useAccountsView() {
  const { 
    accounts, 
    proxyAccounts, 
    loadAccounts, 
    loadProxyAccounts 
  } = useAccountStore()

  // View state
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<AccountCategory | "all">("all")
  const [sortField, setSortField] = useState<SortField>("email")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  
  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CloudflareAccount | ProxyAccount | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  
  // Loading data on mount
  useEffect(() => {
    loadAccounts()
    loadProxyAccounts()
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
  }, [accounts, proxyAccounts, searchQuery, categoryFilter, sortField, sortDirection])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const clearSearch = () => setSearchQuery("")

  const totalAccounts = accounts.length + proxyAccounts.length

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
    isImportDialogOpen,
    setIsImportDialogOpen,
    deleteAccountId,
    setDeleteAccountId,
    
    // Raw Data access if needed
    rawAccounts: accounts,
    rawProxyAccounts: proxyAccounts,
  }
}
