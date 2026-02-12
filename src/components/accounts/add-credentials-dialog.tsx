import { useState, useEffect } from "react"
import { Plus, Upload, Cloud, Globe, Server, Terminal, ArrowRightLeft, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { useAccountForm } from "@/hooks/use-account-form"
import { AccountForm } from "./account-form"
import { AccountCategorySelect } from "./account-category-select"
import { useBulkImport } from "@/hooks/use-bulk-import"
import { useAccountStore } from "@/store/account-store"
import type { AccountCategory, RegistrarType } from "@/types/cloudflare"
import { getCategoryLabel } from "@/lib/utils"
import { PARSERS } from "@/lib/credential-parsers"

interface AddCredentialsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialCategory?: AccountCategory
    initialMode?: 'single' | 'bulk'
    onComplete?: () => void
}

export function AddCredentialsDialog({
    open,
    onOpenChange,
    initialCategory,
    initialMode = 'single',
    onComplete
}: AddCredentialsDialogProps) {
    const [mode, setMode] = useState<'single' | 'bulk'>(initialMode)
    const { proxyAccounts } = useAccountStore()

    // Single Entry State
    const {
        formData,
        setFormData,
        isLoading: isSingleLoading,
        handleSubmit: handleSingleSubmit,
        resetForm: resetSingleForm
    } = useAccountForm(null, initialCategory)

    // Bulk Import State
    const {
        importData,
        setImportData,
        importCategory,
        setImportCategory,
        importRegistrarName,
        setImportRegistrarName,
        defaultProxyId,
        setDefaultProxyId,
        isLoading: isBulkLoading,
        handleBulkImport
    } = useBulkImport()

    // Reset state when dialog opens/closes or initial props change
    useEffect(() => {
        if (open) {
            setMode(initialMode)
            if (initialCategory) {
                setFormData(prev => ({ ...prev, category: initialCategory }))
                setImportCategory(initialCategory)
            }
        } else {
            // Reset forms on close
            resetSingleForm()
            setImportData('')
        }
    }, [open, initialMode, initialCategory, setFormData, setImportCategory, setImportData, resetSingleForm])

    const handleClose = () => {
        onOpenChange(false)
    }

    const onSingleSubmit = () => {
        handleSingleSubmit(() => {
            handleClose()
            onComplete?.()
        })
    }

    const onBulkSubmit = () => {
        handleBulkImport(() => {
            handleClose()
            onComplete?.()
        })
    }

    // Centralized validation logic for single entry
    const isSingleFormValid = (): boolean => {
        switch (formData.category) {
            case 'proxy':
                return !!(formData.proxyHost && formData.proxyPort);

            case 'ssh':
                return !!(
                    formData.sshName &&
                    formData.sshHost &&
                    formData.sshUsername &&
                    formData.sshPrivateKey
                );

            case 'npm':
                return !!(
                    formData.npmHost &&
                    formData.npmIdentity &&
                    formData.npmSecret
                );

            case 'vps':
                return !!(formData.vpsName && formData.vpsIp);

            case 'cloudflare':
            case 'registrar':
            default:
                // For cloudflare and registrar: email + apiToken required
                if (!formData.email || !formData.apiToken) {
                    return false;
                }
                // For namecheap registrar: username also required
                if (
                    formData.category === 'registrar' &&
                    formData.registrarName === 'namecheap' &&
                    !formData.username
                ) {
                    return false;
                }
                return true;
        }
    };

    const isLoading = isSingleLoading || isBulkLoading

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
                <div className="p-6 pb-2">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="flex items-center gap-2">
                            {mode === 'single' ? <Plus className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                            {mode === 'single' ? 'Add New Account' : 'Bulk Import Credentials'}
                        </DialogTitle>
                        <DialogDescription>
                            {mode === 'single'
                                ? "Add a new account or proxy configuration for secure access to external services."
                                : "Quickly add multiple credentials by pasting them below."}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'bulk')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="single">Single Entry</TabsTrigger>
                            <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-2">
                    {mode === 'single' ? (
                        <AccountForm
                            formData={formData}
                            setFormData={setFormData}
                            isEditing={false}
                        />
                    ) : (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="import-category" className="text-sm font-medium">
                                    Account Type
                                </Label>
                                <AccountCategorySelect
                                    id="import-category"
                                    value={importCategory}
                                    onValueChange={setImportCategory}
                                    placeholder="Select account type"
                                />
                            </div>

                            {/* Registrar Selection */}
                            {importCategory === 'registrar' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="import-registrar-name" className="text-sm font-medium">
                                            Registrar Provider <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={importRegistrarName}
                                            onValueChange={(value) => setImportRegistrarName(value as RegistrarType)}
                                        >
                                            <SelectTrigger id="import-registrar-name" className="transition-colors focus:ring-2">
                                                <SelectValue placeholder="Select registrar" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="namecheap">
                                                    <div className="flex items-center gap-2">
                                                        <Globe className="h-4 w-4" />
                                                        Namecheap
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="njalla">
                                                    <div className="flex items-center gap-2">
                                                        <Globe className="h-4 w-4" />
                                                        Njalla
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Default Proxy Selection - Only for Namecheap */}
                                    {importRegistrarName === 'namecheap' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="default-proxy" className="text-sm font-medium">
                                                Default Proxy (Optional)
                                            </Label>
                                            <Select
                                                value={defaultProxyId || undefined}
                                                onValueChange={(value) => setDefaultProxyId(value === "__none__" ? "" : value)}
                                            >
                                                <SelectTrigger id="default-proxy" className="transition-colors focus:ring-2">
                                                    <SelectValue placeholder="Select default proxy" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {proxyAccounts.length === 0 ? (
                                                        <SelectItem value="__no_proxies__" disabled>
                                                            <span className="text-muted-foreground">No proxies available</span>
                                                        </SelectItem>
                                                    ) : (
                                                        <>
                                                            <SelectItem value="__none__">
                                                                <span className="text-muted-foreground">No default proxy</span>
                                                            </SelectItem>
                                                            {proxyAccounts.map((proxy) => (
                                                                <SelectItem key={proxy.id} value={proxy.id}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Server className="h-4 w-4" />
                                                                        {proxy.name || `${proxy.host}:${proxy.port}`}
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                This proxy will be used for rows that don't specify a proxy in the third parameter.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="import-data" className="text-sm font-medium">
                                        Credentials Data
                                    </Label>
                                    <span className="text-xs text-muted-foreground">
                                        {PARSERS[importCategory]?.helpText || 'Format not available'}
                                    </span>
                                </div>
                                <Textarea
                                    id="import-data"
                                    placeholder={PARSERS[importCategory]?.exampleText || 'Enter data...'}
                                    value={importData}
                                    onChange={(e) => setImportData(e.target.value)}
                                    className="min-h-[200px] font-mono text-sm resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 pt-2">
                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        {mode === 'single' ? (
                            <Button
                                onClick={onSingleSubmit}
                                disabled={!isSingleFormValid() || isLoading}
                            >
                                {isLoading ? 'Adding...' : `Add ${getCategoryLabel(formData.category)}`}
                            </Button>
                        ) : (
                            <Button
                                onClick={onBulkSubmit}
                                disabled={!importData.trim() || isLoading}
                            >
                                {isLoading ? 'Importing...' : 'Import Credentials'}
                            </Button>
                        )}
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
