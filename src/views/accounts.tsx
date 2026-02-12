import { Suspense, useState } from "react"
import type { CloudflareAccount, ProxyAccount, SSHAccount, NPMAccount, VPSAccount, AccountCategory } from "@/types/cloudflare"
import { useAccountsView } from "@/hooks/use-accounts-view"
import { AccountsHeader } from "@/components/accounts/accounts-header"
import { AccountsTable } from "@/components/accounts/accounts-table"
import { AddCredentialsDialog } from "@/components/accounts/add-credentials-dialog"
import { EditAccountDialog } from "@/components/accounts/edit-account-dialog"
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
        getRawAccountForEdit,
        deleteAccountId,
        setDeleteAccountId,
        // Removed isImportDialogOpen from hook destructuring as we'll manage it locally or map it
    } = useAccountsView()

    // Local state to manage dialog mode
    const [dialogMode, setDialogMode] = useState<'single' | 'bulk'>('single')
    const [initialCategory, setInitialCategory] = useState<AccountCategory | undefined>()

    const handleAddClick = (category?: AccountCategory) => {
        setDialogMode('single')
        setInitialCategory(category)
        setIsAddDialogOpen(true)
    }

    const handleImportClick = () => {
        setDialogMode('bulk')
        setInitialCategory(undefined)
        setIsAddDialogOpen(true)
    }

    const handleEditClick = (account: CloudflareAccount | ProxyAccount | SSHAccount | NPMAccount | VPSAccount) => {
        setEditingAccount(getRawAccountForEdit(account))
        setIsEditDialogOpen(true)
    }

    const handleDeleteClick = (id: string) => {
        setDeleteAccountId(id)
    }

    return (
        <div className="container mx-auto max-w-6xl px-4 mt-8 sm:px-6 lg:px-8 space-y-8">
            {/* Header Section */}
            <AccountsHeader
                onImportClick={handleImportClick}
                onAddClick={() => handleAddClick()}
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

                onAddClick={handleAddClick}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
            />

            {/* Dialogs */}
            <AddCredentialsDialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                    setIsAddDialogOpen(open)
                    if (!open) {
                        setInitialCategory(undefined)
                        setDialogMode('single')
                    }
                }}
                initialCategory={initialCategory}
                initialMode={dialogMode}
            />

            <EditAccountDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                account={editingAccount}
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
