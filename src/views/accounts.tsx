import { Suspense, useState } from "react"
import type { CloudflareAccount, ProxyAccount, SSHAccount, NPMAccount, VPSAccount, AccountCategory } from "@/types/cloudflare"
import { useAccountsView } from "@/hooks/use-accounts-view"
import { AccountsHeader } from "@/components/accounts/accounts-header"
import { AccountsTable } from "@/components/accounts/accounts-table"
import { AddCredentialsDialog } from "@/components/accounts/add-credentials-dialog"
import { ExportCredentialsDialog } from "@/components/accounts/export-credentials-dialog"
import { EditAccountDialog } from "@/components/accounts/edit-account-dialog"
import { DeleteAccountDialog } from "@/components/accounts/delete-account-dialog"
import { PARSERS } from "@/lib/credential-parsers"
import { getCategoryLabel } from "@/lib/utils"
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

        // Raw data for proxy resolution
        rawProxyAccounts,

        // Selection
        selectedAccountIds,
        toggleAccountSelection,
        toggleAllSelection
    } = useAccountsView()

    // Add/Import dialog state
    const [dialogMode, setDialogMode] = useState<'single' | 'bulk'>('single')
    const [initialCategory, setInitialCategory] = useState<AccountCategory | undefined>()

    // Export dialog state
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
    const [exportLines, setExportLines] = useState<string[]>([])
    const [exportCategoryLabel, setExportCategoryLabel] = useState("")
    const [exportFormatHint, setExportFormatHint] = useState("")

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
        if (categoryFilter === 'all') {
            toast.error("Please select a specific category to export.")
            return
        }

        const parser = PARSERS[categoryFilter]
        if (!parser) {
            toast.error("Export not supported for this category.")
            return
        }

        const lines: string[] = []

        accounts.forEach(viewAccount => {
            if (viewAccount.category !== categoryFilter) return

            const rawAccount = getRawAccountForEdit(viewAccount)
            if (!rawAccount) return

            // Resolve linked proxy for registrar accounts
            const resolvedProxy = (rawAccount as CloudflareAccount).proxyId
                ? rawProxyAccounts.find(p => p.id === (rawAccount as CloudflareAccount).proxyId)
                : undefined

            const line = parser.export(rawAccount as any, resolvedProxy)
            lines.push(line)
        })

        if (lines.length === 0) {
            toast.info("No accounts to export.")
            return
        }

        setExportLines(lines)
        setExportCategoryLabel(getCategoryLabel(categoryFilter))
        setExportFormatHint(parser.helpText)
        setIsExportDialogOpen(true)
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

            <ExportCredentialsDialog
                open={isExportDialogOpen}
                onOpenChange={setIsExportDialogOpen}
                exportLines={exportLines}
                categoryLabel={exportCategoryLabel}
                formatHint={exportFormatHint}
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
