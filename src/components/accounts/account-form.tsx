import { useEffect } from "react"
import { Cloud, Globe, Server, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAccountStore } from '@/store/account-store'
import type { AccountFormData } from "@/hooks/use-account-form"
import type { AccountCategory, RegistrarType } from "@/types/cloudflare"

interface AccountFormProps {
  formData: AccountFormData
  setFormData: (data: AccountFormData) => void
  isEditing?: boolean
}

export function AccountForm({ formData, setFormData, isEditing = false }: AccountFormProps) {
  const { proxyAccounts } = useAccountStore()

  // Auto-set username when category changes to registrar and email is available
  useEffect(() => {
    if (formData.category === 'registrar' && formData.email && !formData.username) {
      const defaultUsername = formData.email.split('@')[0].replaceAll('.', '')
      setFormData({ ...formData, username: defaultUsername })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.category])

  return (
    <div className="grid gap-2 py-4">
      {/* Account Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="category" className="text-sm font-medium">
          Account Type
        </Label>
        {isEditing ? (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
            {formData.category === 'cloudflare' && <Cloud className="h-4 w-4 text-orange-600" />}
            {formData.category === 'registrar' && <Globe className="h-4 w-4 text-purple-600" />}
            {formData.category === 'proxy' && <Server className="h-4 w-4 text-green-600" />}
            <span className="font-medium capitalize">
              {formData.category === 'proxy' ? 'SOCKS5 Proxy' : formData.category}
            </span>
          </div>
        ) : (
          <Select
            value={formData.category}
            onValueChange={(value) => {
              const newCategory = value as AccountCategory
              const updates: Partial<AccountFormData> = { category: newCategory }
              
              // Auto-set username when switching to registrar if email is available
              if (newCategory === 'registrar' && formData.email && !formData.username) {
                updates.username = formData.email.split('@')[0].replaceAll('.', '')
              }
              
              setFormData({ ...formData, ...updates })
            }}
          >
            <SelectTrigger id="category" className="transition-colors focus:ring-2">
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cloudflare">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  Cloudflare Account
                </div>
              </SelectItem>
              <SelectItem value="registrar">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Domain Registrar
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
        )}
        {isEditing && (
          <p className="text-xs text-muted-foreground">
            Account type cannot be changed after creation.
          </p>
        )}
      </div>

      {/* Basic Account Information */}
      {formData.category !== 'proxy' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="user@company.com"
              value={formData.email}
              onChange={(e) => {
                const newEmail = e.target.value
                const oldEmailPrefix = formData.email.split('@')[0].replaceAll('.', '')
                const currentUsername = formData.username || ''
                
                // Auto-update username if it matches the old email prefix or is empty
                const shouldUpdateUsername = 
                  formData.category === 'registrar' && 
                  (!currentUsername || currentUsername === oldEmailPrefix)
                
                const newUsername = shouldUpdateUsername && newEmail.includes('@')
                  ? newEmail.split('@')[0].replaceAll('.', '')
                  : currentUsername
                
                setFormData({ 
                  ...formData, 
                  email: newEmail,
                  username: newUsername
                })
              }}
              className="transition-colors focus:ring-2"
            />
          </div>
        </div>
      )}

      {/* Proxy Configuration */}
      {formData.category === 'proxy' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proxy-name" className="text-sm font-medium">
              Proxy Name
            </Label>
            <Input
              id="proxy-name"
              placeholder="My SOCKS5 Proxy"
              value={formData.proxyName || ''}
              onChange={(e) => setFormData({ ...formData, proxyName: e.target.value })}
              className="transition-colors focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Optional friendly name for this proxy configuration
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proxy-host" className="text-sm font-medium">
                Host <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proxy-host"
                placeholder="proxy.example.com"
                value={formData.proxyHost || ''}
                onChange={(e) => setFormData({ ...formData, proxyHost: e.target.value })}
                className="transition-colors focus:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-port" className="text-sm font-medium">
                Port <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proxy-port"
                type="number"
                placeholder="1080"
                value={formData.proxyPort || ''}
                onChange={(e) => setFormData({ ...formData, proxyPort: e.target.value })}
                className="transition-colors focus:ring-2"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium">Authentication (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proxy-username" className="text-xs text-muted-foreground">
                  Username
                </Label>
                <Input
                  id="proxy-username"
                  placeholder="proxyuser"
                  value={formData.proxyUsername || ''}
                  onChange={(e) => setFormData({ ...formData, proxyUsername: e.target.value })}
                  className="transition-colors focus:ring-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proxy-password" className="text-xs text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="proxy-password"
                  type="password"
                  placeholder="proxypass"
                  value={formData.proxyPassword || ''}
                  onChange={(e) => setFormData({ ...formData, proxyPassword: e.target.value })}
                  className="transition-colors focus:ring-2"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registrar Selection */}
      {formData.category === 'registrar' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="registrar-name" className="text-sm font-medium">
              Registrar Provider <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.registrarName || "namecheap"}
              onValueChange={(value) => setFormData({ ...formData, registrarName: value as RegistrarType })}
            >
              <SelectTrigger id="registrar-name" className="transition-colors focus:ring-2">
                <SelectValue placeholder="Select registrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="namecheap">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Namecheap
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              API Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              placeholder="username"
              value={formData.username || ''}
              onChange={(e) => {
                // Remove dots from username as Namecheap doesn't allow them
                const newUsername = e.target.value.replaceAll('.', '')
                setFormData({ ...formData, username: newUsername })
              }}
              onBlur={(e) => {
                // Auto-fill username from email if empty
                if (!e.target.value && formData.email) {
                  const defaultUsername = formData.email.split('@')[0].replaceAll('.', '')
                  setFormData({ ...formData, username: defaultUsername })
                }
              }}
              className="font-mono text-sm transition-colors focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Your Namecheap API username. Defaults to the part before @ in your email.
            </p>
          </div>
        </>
      )}

      {/* Proxy Selection for Registrar Accounts */}
      {formData.category === 'registrar' && (
        <div className="space-y-2">
          <Label htmlFor="proxy-account" className="text-sm font-medium">
            Proxy Account (Optional)
          </Label>
          <Select
            value={formData.proxyId || "none"}
            onValueChange={(value) => setFormData({ ...formData, proxyId: value === "none" ? undefined : value })}
          >
            <SelectTrigger id="proxy-account" className="transition-colors focus:ring-2">
              <SelectValue placeholder="Select proxy for API calls" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  No proxy (direct connection)
                </div>
              </SelectItem>
              {proxyAccounts.map((proxy) => (
                <SelectItem key={proxy.id} value={proxy.id}>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    {proxy.name || `${proxy.host}:${proxy.port}`}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* API Token for non-proxy accounts */}
      {formData.category !== 'proxy' && (
        <div className="space-y-2">
          <Label htmlFor="apiToken" className="text-sm font-medium">
            API Token <span className="text-destructive">*</span>
          </Label>
          <Input
            id="apiToken"
            type="password"
            placeholder="Your API token"
            value={formData.apiToken}
            onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
            className="font-mono text-sm transition-colors focus:ring-2"
          />
          <p className="text-xs text-muted-foreground">
            Your API token will be encrypted and stored securely in your browser.
          </p>
        </div>
      )}
    </div>
  )
}
