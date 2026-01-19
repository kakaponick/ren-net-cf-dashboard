import { Upload, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AccountsHeaderProps {
  onImportClick: () => void
  onAddClick: () => void
}

export function AccountsHeader({ onImportClick, onAddClick }: AccountsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Credentials</h1>
        <p className="text-muted-foreground">
          Securely manage your API credentials and proxy configurations
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" size="sm" onClick={onImportClick}>
          <Upload className="mr-2 h-4 w-4" />
          Bulk Import
        </Button>
        <Button size="sm" onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>
    </div>
  )
}
