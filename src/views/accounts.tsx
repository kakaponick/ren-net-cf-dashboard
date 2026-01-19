import { Suspense } from "react"
import type { CloudflareAccount, ProxyAccount } from "@/types/cloudflare"
import { useAccountsView } from "@/hooks/use-accounts-view"
import { AccountsHeader } from "@/components/accounts/accounts-header"
import { AccountsTable } from "@/components/accounts/accounts-table"
import { AddAccountDialog } from "@/components/accounts/add-account-dialog"
import { EditAccountDialog } from "@/components/accounts/edit-account-dialog"
import { BulkImportDialog } from "@/components/accounts/bulk-import-dialog"
import { DeleteAccountDialog } from "@/components/accounts/delete-account-dialog"

function CredentialsContent() {
  const {
    // Data
    accounts,
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
  } = useAccountsView()

  const handleEditClick = (account: CloudflareAccount | ProxyAccount) => {
    setEditingAccount(account)
    setIsEditDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setDeleteAccountId(id)
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 mt-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header Section */}
      <AccountsHeader 
        onImportClick={() => setIsImportDialogOpen(true)}
        onAddClick={() => setIsAddDialogOpen(true)}
      />

      {/* Accounts Table */}
      <AccountsTable
        accounts={accounts}
        totalCount={totalAccounts}
        filteredCount={accounts.length}
        
        filterProps={{
          categoryFilter,
          setCategoryFilter,
          searchQuery,
          setSearchQuery,
          clearSearch,
        }}
        
        sortField={sortField}
        sortDirection={sortDirection}
        onToggleSort={toggleSort}
        
        onAddClick={() => setIsAddDialogOpen(true)}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      {/* Dialogs */}
      <AddAccountDialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen} 
      />
      
      <EditAccountDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        account={editingAccount}
      />
      
      <BulkImportDialog 
        open={isImportDialogOpen} 
        onOpenChange={setIsImportDialogOpen} 
      />
      
      <DeleteAccountDialog 
        accountId={deleteAccountId} 
        onClose={() => setDeleteAccountId(null)} 
      />
    </div>
  )
}

export default function CredentialsPage() {
  return (
    <Suspense fallback={null}>
      <CredentialsContent />
    </Suspense>
  )
}
