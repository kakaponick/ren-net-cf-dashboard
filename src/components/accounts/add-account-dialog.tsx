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

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const { formData, setFormData, isLoading, handleSubmit, resetForm } = useAccountForm()

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
      <DialogContent className="sm:max-w-[500px]">
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
                : !formData.email || !formData.apiToken ||
                  (formData.category === 'registrar' && formData.registrarName === 'namecheap' && !formData.username)) ||
              isLoading
            }
          >
            {isLoading ? 'Adding...' : `Add ${formData.category === 'proxy' ? 'Proxy' : 'Account'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
