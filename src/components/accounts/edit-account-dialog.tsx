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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            {account?.category === 'ssh' ? 'Edit SSH Account' : account?.category === 'proxy' ? 'Edit Proxy Configuration' : 'Edit Account'}
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
            disabled={
              (formData.category === 'proxy'
                ? !formData.proxyHost || !formData.proxyPort
                : formData.category === 'ssh'
                  ? !formData.sshName || !formData.sshHost || !formData.sshUsername || !formData.sshPrivateKey
                  : formData.category === 'npm'
                    ? !formData.npmHost || !formData.npmIdentity || !formData.npmSecret
                    : !formData.email || !formData.apiToken ||
                    (formData.category === 'registrar' && formData.registrarName === 'namecheap' && !formData.username)) ||
              isLoading
            }
          >
            {isLoading ? 'Saving...' : `Save ${formData.category === 'ssh' ? 'SSH Server' : formData.category === 'proxy' ? 'Proxy' : formData.category === 'npm' ? 'NPM Account' : 'Account'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
