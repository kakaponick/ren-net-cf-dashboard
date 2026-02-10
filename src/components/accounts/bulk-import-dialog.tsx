import { Upload, Cloud, Globe, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBulkImport } from "@/hooks/use-bulk-import"
import { useAccountStore } from "@/store/account-store"
import type { AccountCategory, RegistrarType } from "@/types/cloudflare"

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const { proxyAccounts } = useAccountStore()
  const {
    importData,
    setImportData,
    importCategory,
    setImportCategory,
    importRegistrarName,
    setImportRegistrarName,
    defaultProxyId,
    setDefaultProxyId,
    isLoading,
    handleBulkImport
  } = useBulkImport()

  const handleClose = () => {
    onOpenChange(false)
  }

  const onSubmit = () => {
    handleBulkImport(() => {
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Credentials
          </DialogTitle>
          <DialogDescription>
            Quickly add multiple credentials by pasting them below.
            Note: Proxy credentials must be added individually.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="import-category" className="text-sm font-medium">
              Category
            </Label>
            <Select
              value={importCategory}
              onValueChange={(value) => setImportCategory(value as AccountCategory)}
            >
              <SelectTrigger id="import-category" className="transition-colors focus:ring-2">
                <SelectValue placeholder="Select category for imported credentials" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cloudflare">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Cloudflare
                  </div>
                </SelectItem>

                <SelectItem value="registrar">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Registrar
                  </div>
                </SelectItem>
                <SelectItem value="proxy">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    SOCKS5 Proxy
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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
                Format: {
                  importCategory === 'registrar'
                    ? (importRegistrarName === 'njalla' ? 'Email  API_Key' : 'Email  API_Key  Proxy(Optional)')
                    : importCategory === 'proxy'
                      ? 'Host:Port[:User:Pass]'
                      : 'Email  API_Token'
                }
              </span>
            </div>
            <Textarea
              id="import-data"
              placeholder={
                importCategory === 'registrar'
                  ? (importRegistrarName === 'njalla'
                    ? `# Example format (one account per line):
user@example.com  api_key_1234567890
admin@client.com  api_key_abcdef1234`
                    : `# Example format (one account per line):
user@example.com  api_key_1234567890
admin@client.com  api_key_abcdef1234  127.0.0.1:1080
support@company.com  api_key_xyz789  192.168.1.1:1080:username:password`)
                  : importCategory === 'proxy'
                    ? `# Example format (one proxy per line):
127.0.0.1:1080
127.0.0.1:1080:username:password
proxy.example.com:1080`
                    : `# Example format (one account per line):
user@company.com  auth_token_123abc
admin@client.com  auth_token_456def`
              }
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="min-h-[200px] font-mono text-sm resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!importData.trim() || isLoading}>
            {isLoading ? 'Importing...' : 'Import Credentials'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
