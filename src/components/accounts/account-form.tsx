import { useEffect } from "react"
import { Cloud, Globe, Server, Terminal, X, ArrowRightLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { useAccountStore } from '@/store/account-store'
import type { AccountFormData } from "@/hooks/use-account-form"
import type { AccountCategory, RegistrarType } from "@/types/cloudflare"
import { getCategoryColorClasses, getCategoryLabel } from "@/lib/utils"
import { Badge } from "../ui/badge"

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
            {formData.category === 'cloudflare' && <Cloud className={`h-4 w-4 ${getCategoryColorClasses('cloudflare').icon}`} />}
            {formData.category === 'registrar' && <Globe className={`h-4 w-4 ${getCategoryColorClasses('registrar').icon}`} />}
            {formData.category === 'proxy' && <Server className={`h-4 w-4 ${getCategoryColorClasses('proxy').icon}`} />}
            {formData.category === 'ssh' && <Terminal className={`h-4 w-4 ${getCategoryColorClasses('ssh').icon}`} />}
            {formData.category === 'vps' && <Server className={`h-4 w-4 ${getCategoryColorClasses('vps').icon}`} />}
            {formData.category === 'npm' && <ArrowRightLeft className={`h-4 w-4 ${getCategoryColorClasses('npm').icon}`} />}
            <span className="font-medium">
              {getCategoryLabel(formData.category)}
            </span>
          </div>
        ) : (
          <Select
            value={formData.category}
            onValueChange={(value) => {
              const newCategory = value as AccountCategory
              const updates: Partial<AccountFormData> = { category: newCategory }

              // Auto-set registrar defaults when switching to registrar
              if (newCategory === 'registrar') {
                updates.registrarName = 'namecheap'
                // Auto-set username when switching to registrar if email is available
                if (formData.email && !formData.username) {
                  updates.username = formData.email.split('@')[0].replaceAll('.', '')
                }
              }

              setFormData({ ...formData, ...updates })
            }}
          >
            <SelectTrigger id="category" className="transition-colors focus:ring-2">
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cloudflare">
                <div className={`flex items-center gap-2 `}>
                  <Badge variant="outline"> <Cloud className={`h-4 w-4 ${getCategoryColorClasses('cloudflare').text}`} /></Badge>
                  Cloudflare Account
                </div>
              </SelectItem>
              <SelectItem value="registrar">
                <div className={`flex items-center gap-2 `}>
                  <Badge variant="outline"> <Globe className={`h-4 w-4 ${getCategoryColorClasses('registrar').text}`} /></Badge>
                  Domain Registrar
                </div>
              </SelectItem>
              <SelectItem value="vps">
                <div className={`flex items-center gap-2 `}>
                  <Badge variant="outline"> <Server className={`h-4 w-4 ${getCategoryColorClasses('vps').text}`} /></Badge>
                  Server registrars
                </div>
              </SelectItem>
              <SelectItem value="proxy">
                <div className={`flex items-center gap-2 `}>
                  <Badge variant="outline"> <Server className={`h-4 w-4 ${getCategoryColorClasses('proxy').text}`} /></Badge>
                  SOCKS5 Proxy
                </div>
              </SelectItem>
              <SelectItem value="ssh">
                <div className={`flex items-center gap-2 `}>
                  <Badge variant="outline"> <Terminal className={`h-4 w-4 ${getCategoryColorClasses('ssh').text}`} /></Badge>
                  SSH Server
                </div>
              </SelectItem>
              <SelectItem value="npm">
                <div className={`flex items-center gap-2 `}>
                  <Badge variant="outline"> <ArrowRightLeft className={`h-4 w-4 ${getCategoryColorClasses('npm').text}`} /></Badge>
                  Nginx PM
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
      {formData.category !== 'proxy' && formData.category !== 'ssh' && formData.category !== 'npm' && formData.category !== 'vps' && (
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
                <SelectItem value="njalla">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Njalla
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.registrarName === 'namecheap' && (
            <>
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

              {/* Proxy Selection for Namecheap Registrar Accounts */}
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
            </>
          )}

          {formData.registrarName === 'njalla' && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Njalla API Key:</strong> Njalla uses API keys for authentication. No username or proxy is needed.
              </p>
            </div>
          )}
        </>
      )}

      {/* SSH Configuration */}
      {formData.category === 'ssh' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ssh-name" className="text-sm font-medium">
              Server Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ssh-name"
              placeholder="Production Server"
              value={formData.sshName || ''}
              onChange={(e) => setFormData({ ...formData, sshName: e.target.value })}
              className="transition-colors focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Friendly name for this SSH server
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ssh-host" className="text-sm font-medium">
                Host <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ssh-host"
                placeholder="192.168.1.1 or server.com"
                value={formData.sshHost || ''}
                onChange={(e) => setFormData({ ...formData, sshHost: e.target.value })}
                className="transition-colors focus:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssh-port" className="text-sm font-medium">
                Port
              </Label>
              <Input
                id="ssh-port"
                type="number"
                placeholder="22"
                value={formData.sshPort || '22'}
                onChange={(e) => setFormData({ ...formData, sshPort: e.target.value })}
                className="transition-colors focus:ring-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssh-username" className="text-sm font-medium">
              Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ssh-username"
              placeholder="root or ubuntu"
              value={formData.sshUsername || ''}
              onChange={(e) => setFormData({ ...formData, sshUsername: e.target.value })}
              className="font-mono text-sm transition-colors focus:ring-2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssh-private-key" className="text-sm font-medium">
              Private Key <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ssh-private-key"
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              value={formData.sshPrivateKey || ''}
              onChange={(e) => setFormData({ ...formData, sshPrivateKey: e.target.value })}
              className="font-mono text-xs transition-colors focus:ring-2 min-h-[120px]"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Paste your SSH private key in PEM format (begins with <code className="bg-muted px-1 py-0.5 rounded">-----BEGIN ... PRIVATE KEY-----</code>)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssh-passphrase" className="text-sm font-medium">
              Passphrase (Optional)
            </Label>
            <Input
              id="ssh-passphrase"
              type="password"
              placeholder="Enter passphrase if key is encrypted"
              value={formData.sshPassphrase || ''}
              onChange={(e) => setFormData({ ...formData, sshPassphrase: e.target.value })}
              className="transition-colors focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Only required if your private key is encrypted with a passphrase
            </p>
          </div>
        </div>
      )}

      {/* NPM Configuration */}
      {formData.category === 'npm' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="npm-name" className="text-sm font-medium">
              Instance Name
            </Label>
            <Input
              id="npm-name"
              placeholder="My NPM Instance"
              value={formData.npmName || ''}
              onChange={(e) => setFormData({ ...formData, npmName: e.target.value })}
              className="transition-colors focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Optional friendly name for this NPM instance
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="npm-host" className="text-sm font-medium">
              Host URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="npm-host"
              placeholder="https://npm.example.com"
              value={formData.npmHost || ''}
              onChange={(e) => setFormData({ ...formData, npmHost: e.target.value })}
              className="font-mono text-sm transition-colors focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Full URL to your Nginx Proxy Manager instance
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="npm-identity" className="text-sm font-medium">
              Login Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="npm-identity"
              type="email"
              placeholder="admin@example.com"
              value={formData.npmIdentity || ''}
              onChange={(e) => setFormData({ ...formData, npmIdentity: e.target.value })}
              className="transition-colors focus:ring-2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="npm-secret" className="text-sm font-medium">
              Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="npm-secret"
              type="password"
              placeholder="Your NPM password"
              value={formData.npmSecret || ''}
              onChange={(e) => setFormData({ ...formData, npmSecret: e.target.value })}
              className="transition-colors focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Your NPM login password will be encrypted and stored securely.
            </p>
          </div>
        </div>
      )}

      {/* VPS Configuration */}
      {formData.category === 'vps' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vps-name" className="text-sm font-medium">
              Server Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vps-name"
              placeholder="Production Server 1"
              value={formData.vpsName || ''}
              onChange={(e) => setFormData({ ...formData, vpsName: e.target.value })}
              className="transition-colors focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Friendly name for this Server
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vps-ip" className="text-sm font-medium">
              IP Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vps-ip"
              placeholder="192.168.1.1"
              value={formData.vpsIp || ''}
              onChange={(e) => setFormData({ ...formData, vpsIp: e.target.value })}
              className="font-mono text-sm transition-colors focus:ring-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vps-email" className="text-sm font-medium">
                Email/Login
              </Label>
              <Input
                id="vps-email"
                type="email"
                placeholder="admin@vps.com"
                value={formData.vpsEmail || ''}
                onChange={(e) => setFormData({ ...formData, vpsEmail: e.target.value })}
                className="transition-colors focus:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vps-password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="vps-password"
                type="password"
                placeholder="••••••••"
                value={formData.vpsPassword || ''}
                onChange={(e) => setFormData({ ...formData, vpsPassword: e.target.value })}
                className="transition-colors focus:ring-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vps-expiration" className="text-sm font-medium">
              Expiration Date (Optional)
            </Label>
            <DatePicker
              date={formData.vpsExpirationDate ? new Date(formData.vpsExpirationDate) : undefined}
              onDateChange={(date) => setFormData({ ...formData, vpsExpirationDate: date ? date.toISOString().split('T')[0] : '' })}
              placeholder="Select expiration date"
            />
            <p className="text-xs text-muted-foreground">
              When does this Server expire?
            </p>
          </div>
        </div>
      )}

      {/* API Token for non-proxy accounts */}
      {formData.category !== 'proxy' && formData.category !== 'ssh' && formData.category !== 'npm' && formData.category !== 'vps' && (
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
            Your API token will be stored in your browser.
          </p>
        </div>
      )}
    </div>
  )
}
