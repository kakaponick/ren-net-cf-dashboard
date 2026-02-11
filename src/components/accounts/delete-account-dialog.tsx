import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { useAccountStore } from '@/store/account-store'
import type { CloudflareAccount, ProxyAccount, SSHAccount, VPSAccount } from "@/types/cloudflare"

interface DeleteAccountDialogProps {
  accountId: string | null
  onClose: () => void
}

export function DeleteAccountDialog({ accountId = null, onClose }: DeleteAccountDialogProps) {
  const {
    accounts, proxyAccounts, sshAccounts, vpsAccounts,
    removeAccount, removeProxyAccount, removeSSHAccount, removeVPSAccount
  } = useAccountStore()

  const handleDelete = async () => {
    if (!accountId) return

    try {
      const isProxy = proxyAccounts.some(p => p.id === accountId)
      const isSSH = sshAccounts.some(s => s.id === accountId)
      const isVPS = vpsAccounts.some(v => v.id === accountId)

      if (isVPS) {
        removeVPSAccount(accountId)
        toast.success('Server registrar deleted successfully')
      } else if (isSSH) {
        removeSSHAccount(accountId)
        toast.success('SSH credentials deleted successfully')
      } else if (isProxy) {
        removeProxyAccount(accountId)
        toast.success('Proxy configuration deleted successfully')
      } else {
        removeAccount(accountId)
        toast.success('Account deleted successfully')
      }
      onClose()
    } catch (error) {
      toast.error('Failed to delete account')
      console.error(error)
    }
  }

  const account = accounts.find(a => a.id === accountId)
  const proxy = proxyAccounts.find(p => p.id === accountId)
  const ssh = sshAccounts.find(s => s.id === accountId)
  const vps = vpsAccounts.find(v => v.id === accountId)

  const displayText = (() => {
    if (account) return `Email: ${account.email}`
    if (proxy) return `Proxy: ${proxy.name || `${proxy.host}:${proxy.port}`}`
    if (ssh) return `SSH: ${ssh.name || `${ssh.username}@${ssh.host}:${ssh.port}`}`
    if (vps) return `Server: ${vps.name || vps.ip}`
    return 'Unknown Account'
  })()

  return (
    <AlertDialog open={accountId !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Are you sure you want to permanently delete this account? This action cannot be undone.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">
                  {displayText}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                This may affect any systems or integrations that depend on this account.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
