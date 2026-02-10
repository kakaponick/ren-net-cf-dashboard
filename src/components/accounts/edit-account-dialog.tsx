import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useAccountForm } from "@/hooks/use-account-form"
import { AccountForm } from "./account-form"
import type { CloudflareAccount, ProxyAccount, SSHAccount, NPMAccount } from "@/types/cloudflare"
import { getCategoryLabel } from "@/lib/utils"

interface EditAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: CloudflareAccount | ProxyAccount | SSHAccount | NPMAccount | null
}

export function EditAccountDialog({ open, onOpenChange, account }: EditAccountDialogProps) {
  const { formData, setFormData, isLoading, handleSubmit } = useAccountForm(account)

  const handleClose = () => {
    onOpenChange(false)
  }

  const onSubmit = () => {
    handleSubmit(() => {
      handleClose()
    })
  }

  // Centralized validation logic for all account types
  const isFormValid = (): boolean => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit {account ? getCategoryLabel(account.category || 'cloudflare') : 'Account'}
          </DialogTitle>
          <DialogDescription>
            {account?.category === 'ssh'
              ? 'Update your SSH server configuration. Changes will be saved securely.'
              : account?.category === 'proxy'
                ? 'Update your SOCKS5 proxy configuration. Changes will be saved securely.'
                : 'Update your account information and API token. Changes will be saved securely.'
            }
          </DialogDescription>
        </DialogHeader>

        <AccountForm
          formData={formData}
          setFormData={setFormData}
          isEditing={true}
        />

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!isFormValid() || isLoading}
          >
            {isLoading ? 'Saving...' : `Save ${getCategoryLabel(formData.category)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
