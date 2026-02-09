import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAccountStore } from '@/store/account-store'
import type { CloudflareAccount, ProxyAccount, SSHAccount, NPMAccount, AccountCategory, RegistrarType } from '@/types/cloudflare'

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
  sshName: string
  sshHost: string
  sshPort: string
  sshUsername: string
  sshPrivateKey: string
  sshPassphrase: string
  npmName: string
  npmHost: string
  npmIdentity: string
  npmSecret: string
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
  sshName: "",
  sshHost: "",
  sshPort: "22",
  sshUsername: "",
  sshPrivateKey: "",
  sshPassphrase: "",
  npmName: "",
  npmHost: "",
  npmIdentity: "",
  npmSecret: "",
}

export function useAccountForm(existingAccount?: CloudflareAccount | ProxyAccount | SSHAccount | NPMAccount | null, initialCategory?: AccountCategory) {
  const { addAccount, addProxyAccount, addSSHAccount, updateAccount, updateProxyAccount, updateSSHAccount } = useAccountStore()
  const [formData, setFormData] = useState<AccountFormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize form data when existingAccount or initialCategory changes
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
      } else if (existingAccount.category === 'ssh') {
        const ssh = existingAccount as SSHAccount
        setFormData({
          ...initialFormData,
          category: 'ssh',
          sshName: ssh.name,
          sshHost: ssh.host,
          sshPort: ssh.port.toString(),
          sshUsername: ssh.username,
          sshPrivateKey: ssh.privateKey,
          sshPassphrase: ssh.passphrase || '',
        })
      } else if (existingAccount.category === 'npm') {
        // NPM accounts are stored as CloudflareAccounts, need to decode
        const account = existingAccount as CloudflareAccount
        try {
          const decoded = JSON.parse(account.apiToken)
          setFormData({
            ...initialFormData,
            category: 'npm',
            npmName: account.name || '',
            npmHost: decoded.host || '',
            npmIdentity: account.email,
            npmSecret: decoded.secret || '',
          })
        } catch {
          // Fallback if decode fails
          setFormData({
            ...initialFormData,
            category: 'npm',
          })
        }
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
      // If no existing account, use initialCategory if provided, otherwise default
      setFormData({
        ...initialFormData,
        category: initialCategory || 'cloudflare'
      })
    }
  }, [existingAccount, initialCategory])

  const resetForm = () => {
    setFormData({
      ...initialFormData,
      category: initialCategory || 'cloudflare'
    })
    setIsLoading(false)
  }

  const validate = () => {
    if (formData.category === 'proxy') {
      if (!formData.proxyHost || !formData.proxyPort) {
        toast.error('Please fill in proxy host and port')
        return false
      }
    } else if (formData.category === 'ssh') {
      if (!formData.sshName || !formData.sshHost || !formData.sshUsername || !formData.sshPrivateKey) {
        toast.error('Please fill in all required SSH fields')
        return false
      }
    } else if (formData.category === 'npm') {
      if (!formData.npmHost || !formData.npmIdentity || !formData.npmSecret) {
        toast.error('Please fill in all required NPM fields')
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
        } else if (existingAccount.category === 'ssh') {
          updateSSHAccount(existingAccount.id, {
            name: formData.sshName,
            host: formData.sshHost,
            port: parseInt(formData.sshPort) || 22,
            username: formData.sshUsername,
            privateKey: formData.sshPrivateKey,
            passphrase: formData.sshPassphrase || undefined,
          })
          toast.success('SSH server updated successfully')
        } else if (existingAccount.category === 'npm') {
          // NPM accounts are stored as CloudflareAccounts with special encoding
          updateAccount(existingAccount.id, {
            email: formData.npmIdentity, // Store identity in email field
            apiToken: JSON.stringify({ host: formData.npmHost, secret: formData.npmSecret }), // Store host+secret in apiToken
            category: 'npm',
          })
          toast.success('NPM account updated successfully')
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
        } else if (formData.category === 'ssh') {
          const newSSHAccount: SSHAccount = {
            id: crypto.randomUUID(),
            name: formData.sshName,
            host: formData.sshHost,
            port: parseInt(formData.sshPort) || 22,
            username: formData.sshUsername,
            privateKey: formData.sshPrivateKey,
            passphrase: formData.sshPassphrase || undefined,
            category: 'ssh',
            createdAt: new Date(),
          }
          addSSHAccount(newSSHAccount)
          toast.success('SSH server added successfully')
        } else if (formData.category === 'npm') {
          // NPM accounts are stored as CloudflareAccounts with special encoding
          const newNPMAccount: CloudflareAccount = {
            id: crypto.randomUUID(),
            name: formData.npmName || `NPM ${formData.npmHost}`,
            email: formData.npmIdentity, // Store identity in email field
            apiToken: JSON.stringify({ host: formData.npmHost, secret: formData.npmSecret }), // Store host+secret in apiToken  
            category: 'npm',
            createdAt: new Date(),
          }
          addAccount(newNPMAccount)
          toast.success('NPM account added successfully')
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
