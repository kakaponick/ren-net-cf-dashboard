import { useState } from 'react'
import { toast } from 'sonner'
import { useAccountStore } from '@/store/account-store'
import type { CloudflareAccount, ProxyAccount, VPSAccount, AccountCategory, RegistrarType } from '@/types/cloudflare'

export function useBulkImport() {
  const { addAccount, addProxyAccount, addVPSAccount, proxyAccounts } = useAccountStore()
  
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

      lines.forEach((line) => {
        const trimmedLine = line.trim()
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          return
        }

        const parts = trimmedLine.split(/\s+/)
        
        // Handle proxy bulk import
        if (importCategory === 'proxy') {
           // Parse proxy string: host:port[:user:pass]
           const proxyParts = trimmedLine.split(':')
           if (proxyParts.length >= 2) {
             const host = proxyParts[0]
             const port = parseInt(proxyParts[1])
             const username = proxyParts[2] || undefined
             const password = proxyParts[3] || undefined
             
             if (host && !isNaN(port)) {
               const newProxyAccount: ProxyAccount = {
                 id: crypto.randomUUID(),
                 name: `Proxy ${host}:${port}`,
                 host,
                 port,
                 username,
                 password,
                 category: 'proxy',
                 createdAt: new Date(),
               }
               addProxyAccount(newProxyAccount)
               successCount++
             } else {
               errorCount++
             }
           } else {
             errorCount++
           }
           return
        }

        // Handle VPS (Server Registrars) bulk import
        if (importCategory === 'vps') {
          if (parts.length >= 2) {
            const name = parts[0]
            const ip = parts[1]
            const email = parts[2] || undefined
            const password = parts[3] || undefined
            const expirationDate = parts[4] || undefined

            if (name?.trim() && ip?.trim()) {
              const newVPSAccount: VPSAccount = {
                id: crypto.randomUUID(),
                name: name.trim(),
                ip: ip.trim(),
                email: email?.trim() || undefined,
                password: password?.trim() || undefined,
                expirationDate: expirationDate?.trim() || undefined,
                category: 'vps',
                createdAt: new Date(),
              }
              addVPSAccount(newVPSAccount)
              successCount++
            } else {
              errorCount++
            }
          } else {
            errorCount++
          }
          return
        }

        if (parts.length >= 2) {
          const email = parts[0]
          const apiToken = parts[1]
          let proxyId: string | undefined = undefined

          // Basic validation checking
          if (!email || !apiToken) {
            errorCount++
            return
          }

          // Validate email format for registrars
          if (importCategory === 'registrar') {
             const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
             if (!emailRegex.test(email)) {
               errorCount++
               return
             }
          }

          // Handle 3rd parameter (Proxy) for Namecheap only
          if (importCategory === 'registrar' && importRegistrarName === 'namecheap' && parts.length >= 3) {
            const proxyString = parts[2]
            const proxyParts = proxyString.split(':')
            
            if (proxyParts.length >= 2) {
               const host = proxyParts[0]
               const port = parseInt(proxyParts[1])
               const username = proxyParts[2] || undefined
               const password = proxyParts[3] || undefined

               if (host && !isNaN(port)) {
                 // Check if proxy already exists
                 const existingProxy = proxyAccounts.find(p => 
                   p.host === host && p.port === port && 
                   p.username === username && p.password === password
                 )
                 
                 if (existingProxy) {
                   proxyId = existingProxy.id
                 } else {
                   // Create new proxy
                   const newProxyId = crypto.randomUUID()
                   const newProxyAccount: ProxyAccount = {
                     id: newProxyId,
                     name: `Proxy ${host}:${port}`,
                     host,
                     port,
                     username,
                     password,
                     category: 'proxy',
                     createdAt: new Date(),
                   }
                   addProxyAccount(newProxyAccount)
                   proxyId = newProxyId
                 }
               }
            }
          }

          // Use default proxy if no proxy was specified in the line (Namecheap only)
          if (importCategory === 'registrar' && importRegistrarName === 'namecheap' && !proxyId && defaultProxyId) {
            proxyId = defaultProxyId
          }

          const defaultUsername = email.split('@')[0].replaceAll('.', '')
          const newAccount: CloudflareAccount = {
            id: crypto.randomUUID(),
            email: email,
            apiToken: apiToken,
            category: importCategory,
            // Only include registrarName and username if category is registrar
            ...(importCategory === 'registrar' ? { 
              registrarName: importRegistrarName || "namecheap",
              username: defaultUsername
            } : {}),
            proxyId: proxyId,
            createdAt: new Date(),
          }

          addAccount(newAccount)
          successCount++
        } else {
          errorCount++
        }
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
