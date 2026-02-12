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
  accountIds: string[]
  onClose: () => void
  onConfirm?: () => void
}

export function DeleteAccountDialog({ accountIds, onClose, onConfirm }: DeleteAccountDialogProps) {
  const {
    accounts, proxyAccounts, sshAccounts, vpsAccounts,
    removeAccount, removeProxyAccount, removeSSHAccount, removeVPSAccount
  } = useAccountStore()

  const handleDelete = async () => {
    if (accountIds.length === 0) return

    try {
      let deletedCount = 0

      for (const id of accountIds) {
        const isProxy = proxyAccounts.some(p => p.id === id)
        const isSSH = sshAccounts.some(s => s.id === id)
        const isVPS = vpsAccounts.some(v => v.id === id)

        if (isVPS) {
          removeVPSAccount(id)
        } else if (isSSH) {
          removeSSHAccount(id)
        } else if (isProxy) {
          removeProxyAccount(id)
        } else {
          removeAccount(id)
        }
        deletedCount++
      }

      if (deletedCount === 1) {
        toast.success('Account deleted successfully')
      } else {
        toast.success(`${deletedCount} accounts deleted successfully`)
      }

      if (onConfirm) onConfirm()
      onClose()
    } catch (error) {
      toast.error('Failed to delete accounts')
      console.error(error)
    }
  }

  const isBulk = accountIds.length > 1
  const firstId = accountIds[0]

  // For single account display
  const account = accounts.find(a => a.id === firstId)
  const proxy = proxyAccounts.find(p => p.id === firstId)
  const ssh = sshAccounts.find(s => s.id === firstId)
  const vps = vpsAccounts.find(v => v.id === firstId)

  const displayText = (() => {
    if (isBulk) return `${accountIds.length} accounts selected`

    if (account) return `Email: ${account.email}`
    if (proxy) return `Proxy: ${proxy.name || `${proxy.host}:${proxy.port}`}`
    if (ssh) return `SSH: ${ssh.name || `${ssh.username}@${ssh.host}:${ssh.port}`}`
    if (vps) return `Server: ${vps.name || vps.ip}`
    return 'Unknown Account'
  })()

  return (
    <AlertDialog open={accountIds.length > 0} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {isBulk ? 'Delete Multiple Accounts' : 'Delete Account'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {isBulk
                  ? `Are you sure you want to permanently delete these ${accountIds.length} accounts? This action cannot be undone.`
                  : "Are you sure you want to permanently delete this account? This action cannot be undone."
                }
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">
                  {displayText}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                This may affect any systems or integrations that depend on these credentials.
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
            {isBulk ? `Delete ${accountIds.length} Accounts` : 'Delete Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
