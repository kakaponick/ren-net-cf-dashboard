'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNPMStore } from '@/store/npm-store';
import { NPMAPIClient } from '@/lib/npm-api';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface NPMSettingsCardProps {
    onSettingsChanged?: () => void;
}

export function NPMSettingsCard({ onSettingsChanged }: NPMSettingsCardProps) {
    const { settings, saveSettings, clearSettings, setToken } = useNPMStore();
    const [isOpen, setIsOpen] = useState(!settings);
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'success' | 'error' | null>(null);

    const [formData, setFormData] = useState({
        host: settings?.host || '',
        identity: settings?.identity || '',
        secret: settings?.secret || '',
    });

    const handleSave = () => {
        if (!formData.host || !formData.identity || !formData.secret) {
            toast.error('Please fill in all fields');
            return;
        }

        // Ensure host doesn't end with slash
        const host = formData.host.replace(/\/$/, '');

        saveSettings({
            host,
            identity: formData.identity,
            secret: formData.secret,
        });

        toast.success('Settings saved successfully');
        setTestStatus(null);
        onSettingsChanged?.();
    };

    const handleTestConnection = async () => {
        if (!formData.host || !formData.identity || !formData.secret) {
            toast.error('Please fill in all fields');
            return;
        }

        setIsTesting(true);
        setTestStatus(null);

        try {
            const host = formData.host.replace(/\/$/, '');
            const client = new NPMAPIClient(
                {
                    host,
                    identity: formData.identity,
                    secret: formData.secret,
                },
                undefined,
                (token, expires) => {
                    setToken({ token, expires });
                }
            );

            const success = await client.testConnection();
            if (success) {
                setTestStatus('success');
                toast.success('Connection successful');
            } else {
                setTestStatus('error');
                toast.error('Connection failed');
            }
        } catch (error) {
            setTestStatus('error');
            toast.error('Connection failed', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleClear = () => {
        clearSettings();
        setFormData({
            host: '',
            identity: '',
            secret: '',
        });
        setTestStatus(null);
        toast.success('Settings cleared');
        onSettingsChanged?.();
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card>
                <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="text-left">
                                <CardTitle>NPM Settings</CardTitle>
                                <CardDescription>
                                    Configure your Nginx Proxy Manager connection
                                </CardDescription>
                            </div>
                            <ChevronDown
                                className={`h-5 w-5 transition-transform ${isOpen ? 'transform rotate-180' : ''
                                    }`}
                            />
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="npm-host">NPM Host URL</Label>
                                <Input
                                    id="npm-host"
                                    placeholder="https://npm.example.com"
                                    value={formData.host}
                                    onChange={(e) =>
                                        setFormData({ ...formData, host: e.target.value })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="npm-email">Login Email</Label>
                                <Input
                                    id="npm-email"
                                    type="email"
                                    placeholder="admin@example.com"
                                    value={formData.identity}
                                    onChange={(e) =>
                                        setFormData({ ...formData, identity: e.target.value })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="npm-password">Password</Label>
                                <Input
                                    id="npm-password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.secret}
                                    onChange={(e) =>
                                        setFormData({ ...formData, secret: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handleTestConnection} disabled={isTesting} variant="outline">
                                {isTesting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        {testStatus === 'success' && (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        )}
                                        {testStatus === 'error' && (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        Test Connection
                                    </>
                                )}
                            </Button>

                            <Button onClick={handleSave}>Save Settings</Button>

                            {settings && (
                                <Button onClick={handleClear} variant="outline">
                                    Clear
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
