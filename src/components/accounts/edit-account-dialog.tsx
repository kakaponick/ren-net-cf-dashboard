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
import type { CloudflareAccount, ProxyAccount } from "@/types/cloudflare"

interface EditAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: CloudflareAccount | ProxyAccount | null
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            {account?.category === 'proxy' ? 'Edit Proxy Configuration' : 'Edit Account'}
          </DialogTitle>
          <DialogDescription>
            {account?.category === 'proxy'
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
                : !formData.email || !formData.apiToken) ||
              isLoading
            }
          >
            {isLoading ? 'Saving...' : `Save ${formData.category === 'proxy' ? 'Proxy' : 'Account'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
