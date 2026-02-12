import { Suspense, useState } from "react"
import type { CloudflareAccount, ProxyAccount, SSHAccount, NPMAccount, VPSAccount, AccountCategory } from "@/types/cloudflare"
import { useAccountsView } from "@/hooks/use-accounts-view"
import { AccountsHeader } from "@/components/accounts/accounts-header"
import { AccountsTable } from "@/components/accounts/accounts-table"
import { AddCredentialsDialog } from "@/components/accounts/add-credentials-dialog"
import { EditAccountDialog } from "@/components/accounts/edit-account-dialog"
import { DeleteAccountDialog } from "@/components/accounts/delete-account-dialog"
import { PARSERS } from "@/lib/credential-parsers"
import { toast } from "sonner"

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

        // Selection
        selectedAccountIds,
        toggleAccountSelection,
        toggleAllSelection
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

    const handleExportClick = () => {
        // Determine what to export based on current view/filter
        // If category filter is 'all', we might want to ask user or just error, 
        // as bulk export of different types in one file isn't supported by import yet strictly speaking 
        // (though our parser could potentialy handle it if we auto-detect, but we don't have auto-detect yet)

        if (categoryFilter === 'all') {
            toast.error("Please select a specific category to export.")
            return
        }

        const parser = PARSERS[categoryFilter]
        if (!parser) {
            toast.error("Export not supported for this category.")
            return
        }

        // Get the raw accounts matching this category
        // filteredAndSortedAccounts in useAccountsView returns generic objects, we might need raw ones?
        // Actually, the generic objects have enough info for basic export usually, 
        // BUT for things like Proxy/VPS, we mapped them to email/apiToken fields in the view hook.
        // We should use the raw stores or recover the data. 
        // Luckily useAccountsView provides rawAccounts access via getRawAccountForEdit or we can just filter the raw arrays from the store directly here if we had access.
        // But useAccountsView exposes `accounts` which is the processed list. 

        // Let's use the hook's raw data exposure which I recall adding/checking.
        // Wait, I need to check if useAccountsView exports raw arrays.
        // I checked it earlier, it exports: rawAccounts, rawProxyAccounts, rawSSHAccounts, rawVPSAccounts.

        let dataToExport: any[] = []
        switch (categoryFilter) {
            case 'cloudflare':
            case 'registrar':
            case 'npm':
                // @ts-ignore
                dataToExport = accounts.filter(a => a.category === categoryFilter)
                // Note: accounts in view hook is the FILTERED list. 
                // If we want to export ALL accounts of a category, we should use raw lists.
                // If we want to export VALID FILTERED list (search applied), we use accounts.
                // Let's export what the user SEES (filtered).
                // BUT 'accounts' in the hook is a normalized list where VPS/Proxy are mapped to email/token.
                // We need to map them BACK or get the raw version.

                // Better approach: Iterate the filtered `accounts` list, and find the raw version for each ID.
                // useAccountsView provides `getRawAccountForEdit`.
                break;
            case 'proxy':
            case 'ssh':
            case 'vps':
                // These are also in `accounts` list but mapped.
                break;
        }

        const exportLines: string[] = []

        accounts.forEach(viewAccount => {
            // Only export if it matches the category (redundant if filter is active but safe)
            if (viewAccount.category !== categoryFilter) return

            const rawAccount = getRawAccountForEdit(viewAccount)
            if (rawAccount) {
                // @ts-ignore - TS doesn't know rawAccount matches parser type perfectly, but it should
                const line = parser.export(rawAccount)
                exportLines.push(line)
            }
        })

        if (exportLines.length === 0) {
            toast.info("No accounts to export.")
            return
        }

        const exportText = exportLines.join('\n')
        navigator.clipboard.writeText(exportText)
        toast.success(`Exported ${exportLines.length} credentials to clipboard!`)
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
                onExportClick={handleExportClick}
                onDeleteSelectedClick={() => setDeleteAccountId('bulk-selection')}
                selectedCount={selectedAccountIds.size}
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
                selectedAccountIds={selectedAccountIds}
                onToggleSelection={toggleAccountSelection}
                onToggleAll={toggleAllSelection}
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
                accountIds={deleteAccountId === 'bulk-selection' ? Array.from(selectedAccountIds) : (deleteAccountId ? [deleteAccountId] : [])}
                onClose={() => setDeleteAccountId(null)}
                onConfirm={() => {
                    if (deleteAccountId === 'bulk-selection') {
                        toggleAllSelection([]) // Clear selection after bulk delete
                    }
                }}
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
