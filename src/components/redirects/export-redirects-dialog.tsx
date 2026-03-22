import { Download, Copy, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import type { ParsedNginxLocation } from "@/types/npm"

interface ExportRedirectsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locations: ParsedNginxLocation[]
}

export function ExportRedirectsDialog({
  open,
  onOpenChange,
  locations,
}: ExportRedirectsDialogProps) {
  const exportLines = locations.map(loc => `${loc.location} ${loc.destination}`)
  const exportText = exportLines.join('\n')

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(exportText)
    toast.success(`Copied ${exportLines.length} redirects to clipboard`)
  }

  const handleDownload = () => {
    const blob = new Blob([exportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'npm-redirects.txt'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${exportLines.length} redirects`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
        <div className="p-6 pb-2">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Export Redirects
            </DialogTitle>
            <DialogDescription>
              {exportLines.length} redirect{exportLines.length !== 1 ? 's' : ''} ready to export. Format: slug destination (space separated).
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3">
          <p className="text-xs text-muted-foreground font-mono">slug destination</p>
          <Textarea
            readOnly
            value={exportText}
            className="min-h-[220px] font-mono text-sm resize-none bg-muted/50 cursor-default"
          />
        </div>

        <div className="p-6 pt-2">
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={handleCopyToClipboard}>
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </Button>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download .txt
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
