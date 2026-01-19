import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAccountStore } from '@/store/account-store'
import type { CloudflareAccount, ProxyAccount, AccountCategory, RegistrarType } from '@/types/cloudflare'

export interface AccountFormData {
  email: string
  apiToken: string
  category: AccountCategory
  registrarName: RegistrarType | undefined
  username: string // API username for registrar accounts
  proxyId: string | undefined
  proxyName: string
  proxyHost: string
  proxyPort: string
  proxyUsername: string
  proxyPassword: string
}

const initialFormData: AccountFormData = {
  email: "",
  apiToken: "",
  category: "cloudflare",
  registrarName: undefined,
  username: "",
  proxyId: undefined,
  proxyName: "",
  proxyHost: "",
  proxyPort: "",
  proxyUsername: "",
  proxyPassword: "",
}

export function useAccountForm(existingAccount?: CloudflareAccount | ProxyAccount | null) {
  const { addAccount, addProxyAccount, updateAccount, updateProxyAccount } = useAccountStore()
  const [formData, setFormData] = useState<AccountFormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize form data when existingAccount changes
  useEffect(() => {
    if (existingAccount) {
      if (existingAccount.category === 'proxy') {
        const proxy = existingAccount as ProxyAccount
        setFormData({
          ...initialFormData,
          category: 'proxy',
          proxyName: proxy.name || "",
          proxyHost: proxy.host,
          proxyPort: proxy.port.toString(),
          proxyUsername: proxy.username || "",
          proxyPassword: proxy.password || "",
        })
      } else {
        const account = existingAccount as CloudflareAccount
        const defaultUsername = account.email.split('@')[0].replaceAll('.', '')
        setFormData({
          ...initialFormData,
          category: account.category || 'cloudflare',
          email: account.email,
          apiToken: account.apiToken,
          registrarName: account.registrarName,
          username: account.username || defaultUsername,
          proxyId: account.proxyId,
        })
      }
    } else {
      setFormData(initialFormData)
    }
  }, [existingAccount])

  const resetForm = () => {
    setFormData(initialFormData)
    setIsLoading(false)
  }

  const validate = () => {
    if (formData.category === 'proxy') {
      if (!formData.proxyHost || !formData.proxyPort) {
        toast.error('Please fill in proxy host and port')
        return false
      }
    } else {
      if (!formData.email || !formData.apiToken) {
        toast.error('Please fill in all required fields')
        return false
      }
    }
    return true
  }

  const handleSubmit = async (onSuccess?: () => void) => {
    if (!validate()) return

    setIsLoading(true)
    try {
      if (existingAccount) {
        // Update existing
        if (existingAccount.category === 'proxy') {
          updateProxyAccount(existingAccount.id, {
            name: formData.proxyName || `Proxy ${formData.proxyHost}:${formData.proxyPort}`,
            host: formData.proxyHost,
            port: parseInt(formData.proxyPort),
            username: formData.proxyUsername || undefined,
            password: formData.proxyPassword || undefined,
          })
          toast.success('Proxy account updated successfully')
        } else {
          updateAccount(existingAccount.id, {
            email: formData.email,
            apiToken: formData.apiToken,
            category: formData.category,
            registrarName: formData.registrarName,
            username: formData.category === 'registrar' ? formData.username : undefined,
            proxyId: formData.proxyId,
          })
          toast.success('Account updated successfully')
        }
      } else {
        // Add new
        if (formData.category === 'proxy') {
          const newProxyAccount: ProxyAccount = {
            id: crypto.randomUUID(),
            name: formData.proxyName || `Proxy ${formData.proxyHost}:${formData.proxyPort}`,
            host: formData.proxyHost,
            port: parseInt(formData.proxyPort),
            username: formData.proxyUsername || undefined,
            password: formData.proxyPassword || undefined,
            category: 'proxy',
            createdAt: new Date(),
          }
          addProxyAccount(newProxyAccount)
          toast.success('Proxy account added successfully')
        } else {
          const defaultUsername = formData.email.split('@')[0].replaceAll('.', '')
          const newAccount: CloudflareAccount = {
            id: crypto.randomUUID(),
            email: formData.email,
            apiToken: formData.apiToken,
            category: formData.category,
            registrarName: formData.category === 'registrar' ? (formData.registrarName || "namecheap") : undefined,
            username: formData.category === 'registrar' ? (formData.username?.replaceAll('.', '') || defaultUsername) : undefined,
            proxyId: formData.proxyId,
            createdAt: new Date(),
          }
          addAccount(newAccount)
          toast.success('Account added successfully')
        }
      }
      
      resetForm()
      onSuccess?.()
    } catch (error) {
      toast.error(existingAccount ? 'Failed to update account' : 'Failed to add account')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    formData,
    setFormData,
    isLoading,
    handleSubmit,
    resetForm
  }
}
