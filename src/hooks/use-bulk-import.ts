import { useState } from 'react'
import { toast } from 'sonner'
import { useAccountStore } from '@/store/account-store'
import type { CloudflareAccount, ProxyAccount, VPSAccount, SSHAccount, AccountCategory, RegistrarType } from '@/types/cloudflare'
import { PARSERS } from '@/lib/credential-parsers'

export function useBulkImport() {
  const { addAccount, addProxyAccount, addVPSAccount, addSSHAccount, proxyAccounts } = useAccountStore()

  const [importData, setImportData] = useState("")
  const [importCategory, setImportCategory] = useState<AccountCategory>("cloudflare")
  const [importRegistrarName, setImportRegistrarName] = useState<RegistrarType>("namecheap")
  const [defaultProxyId, setDefaultProxyId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const handleBulkImport = async (onSuccess?: () => void) => {
    if (!importData.trim()) {
      toast.error('Please enter credentials to import')
      return
    }

    if (importCategory === 'registrar' && !importRegistrarName) {
      toast.error('Please select a registrar provider')
      return
    }

    setIsLoading(true)
    try {
      const lines = importData.trim().split('\n')
      let successCount = 0
      let errorCount = 0

      // For Namecheap proxy matching
      const findOrCreateProxy = (proxyString: string): string | undefined => {
        const proxyParser = PARSERS['proxy']
        const parsedProxy = proxyParser.parse(proxyString)
        if (!parsedProxy) return undefined

        // Check if exists
        const existing = proxyAccounts.find(p =>
          p.host === parsedProxy.host &&
          p.port === parsedProxy.port &&
          p.username === parsedProxy.username &&
          p.password === parsedProxy.password
        )

        if (existing) return existing.id

        // Create new
        const newId = crypto.randomUUID()
        addProxyAccount({
          ...parsedProxy,
          id: newId,
          name: parsedProxy.name || `Proxy ${parsedProxy.host}:${parsedProxy.port}`,
          createdAt: new Date()
        } as ProxyAccount)
        return newId
      }

      const parser = PARSERS[importCategory]
      if (!parser) {
        toast.error(`No parser found for category: ${importCategory}`)
        setIsLoading(false)
        return
      }

      lines.forEach((line) => {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine.startsWith('#')) return

        const parsedData = parser.parse(trimmedLine, { registrarName: importRegistrarName })
        if (!parsedData) {
          errorCount++
          return
        }

        // --- Category Specific Saving Logic ---

        if (importCategory === 'proxy') {
          addProxyAccount({
            ...parsedData,
            id: crypto.randomUUID(),
            createdAt: new Date()
          } as ProxyAccount)
          successCount++
          return
        }

        if (importCategory === 'vps') {
          addVPSAccount({
            ...parsedData,
            id: crypto.randomUUID(),
            createdAt: new Date()
          } as VPSAccount)
          successCount++
          return
        }

        if (importCategory === 'ssh') {
          addSSHAccount({
            ...parsedData,
            id: crypto.randomUUID(),
            createdAt: new Date()
          } as SSHAccount)
          successCount++
          return
        }

        // --- Cloudflare / Registrar / NPM (CloudflareAccount-based) ---

        // Handle Registrar Proxy Logic
        let proxyId = undefined
        if (importCategory === 'registrar' && importRegistrarName === 'namecheap') {
          // Check for 3rd arg manually since it's outside the standard parser return for Account
          const parts = trimmedLine.split(/\s+/)
          if (parts.length >= 3) {
            proxyId = findOrCreateProxy(parts[2])
          }
          if (!proxyId && defaultProxyId) {
            proxyId = defaultProxyId
          }
        }

        const newAccount: CloudflareAccount = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          ...parsedData as any, // Cast because parsedData is Partial<T>
          proxyId: proxyId || (parsedData as any).proxyId
        }

        addAccount(newAccount)
        successCount++
      })

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} account${successCount > 1 ? 's' : ''}`)
      }
      if (errorCount > 0) {
        toast.warning(`Skipped ${errorCount} invalid line${errorCount > 1 ? 's' : ''}`)
      }

      setImportData('')
      setImportCategory("cloudflare")
      setImportRegistrarName("namecheap")
      setDefaultProxyId("")
      onSuccess?.()
    } catch (error) {
      toast.error('Failed to import credentials')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    importData,
    setImportData,
    importCategory,
    setImportCategory,
    importRegistrarName,
    setImportRegistrarName,
    defaultProxyId,
    setDefaultProxyId,
    isLoading,
    handleBulkImport
  }
}
