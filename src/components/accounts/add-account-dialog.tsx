import { Plus } from "lucide-react"
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
import type { AccountCategory } from "@/types/cloudflare"
import { getCategoryLabel } from "@/lib/utils"

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCategory?: AccountCategory
}

export function AddAccountDialog({ open, onOpenChange, initialCategory }: AddAccountDialogProps) {
  const { formData, setFormData, isLoading, handleSubmit, resetForm } = useAccountForm(null, initialCategory)

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const onSubmit = () => {
    handleSubmit(() => {
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Account
          </DialogTitle>
          <DialogDescription>
            Add a new account or proxy configuration for secure access to external services.
          </DialogDescription>
        </DialogHeader>

        <AccountForm
          formData={formData}
          setFormData={setFormData}
          isEditing={false}
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
            {isLoading ? 'Adding...' : `Add ${getCategoryLabel(formData.category)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
