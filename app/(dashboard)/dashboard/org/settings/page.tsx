'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, Eye, EyeOff, Copy, Check, 
  RefreshCw, Webhook, ExternalLink, Shield
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Organization = {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  webhookUrl?: string;
  webhookSecret?: string;
  website?: string;
  logoUrl?: string;
};

export default function OrgSettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const orgId = localStorage.getItem('currentOrgId');
      const response = await fetch(`/api/organizations/${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setOrganization(data.organization);
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrganization = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const orgId = localStorage.getItem('currentOrgId');

    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          website: formData.get('website'),
          logoUrl: formData.get('logoUrl'),
          webhookUrl: formData.get('webhookUrl'),
        }),
      });

      if (response.ok) {
        await fetchOrganization();
        alert('Settings updated successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update organization:', error);
      alert('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!confirm('Regenerate API key? Your current key will stop working immediately.')) {
      return;
    }

    try {
      const orgId = localStorage.getItem('currentOrgId');
      const response = await fetch(`/api/organizations/${orgId}/regenerate-api-key`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchOrganization();
        alert('API key regenerated successfully');
      }
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
      alert('Failed to regenerate API key');
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookResult(null);

    try {
      const response = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': organization?.apiKey || '',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setWebhookResult({ success: true, message: 'Webhook sent successfully! Check your endpoint.' });
      } else {
        setWebhookResult({ success: false, message: data.error || 'Webhook test failed' });
      }
    } catch (error: any) {
      setWebhookResult({ success: false, message: error.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Organization not found</p>
      </div>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Organization Settings</h1>
        <p className="text-gray-600">Manage your organization details and API credentials</p>
      </div>

      {/* Basic Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateOrganization} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={organization.name}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Contact Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={organization.email}
                  required
                />
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  placeholder="https://example.com"
                  defaultValue={organization.website || ''}
                />
              </div>

              <div>
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  name="logoUrl"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  defaultValue={organization.logoUrl || ''}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                name="webhookUrl"
                type="url"
                placeholder="https://your-site.com/api/webhooks"
                defaultValue={organization.webhookUrl || ''}
              />
              <p className="text-xs text-gray-500 mt-1">
                Receive payment notifications at this URL
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* API Credentials */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            API Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Organization ID */}
          <div>
            <Label>Organization ID</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={organization.id}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(organization.id, 'orgId')}
              >
                {copied === 'orgId' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>API Key</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateApiKey}
                className="text-red-600 hover:text-red-700"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={showApiKey ? organization.apiKey : '••••••••••••••••••••••••'}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(organization.apiKey, 'apiKey')}
              >
                {copied === 'apiKey' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use this key to authenticate API requests
            </p>
          </div>

          {/* Webhook Secret */}
          {organization.webhookSecret && (
            <div>
              <Label>Webhook Secret</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={showWebhookSecret ? organization.webhookSecret : '••••••••••••••••••••••••'}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                >
                  {showWebhookSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(organization.webhookSecret!, 'webhookSecret')}
                >
                  {copied === 'webhookSecret' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Use this secret to verify webhook signatures
              </p>
            </div>
          )}

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Keep your credentials secure!</strong> Never share your API key or webhook secret publicly.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Webhook Testing */}
      {organization.webhookUrl && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Testing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Test your webhook endpoint to ensure it's configured correctly.
              </p>
              <Button
                onClick={handleTestWebhook}
                disabled={testingWebhook}
                variant="outline"
              >
                {testingWebhook ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending Test Webhook...
                  </>
                ) : (
                  <>
                    <Webhook className="h-4 w-4 mr-2" />
                    Send Test Webhook
                  </>
                )}
              </Button>
            </div>

            {webhookResult && (
              <Alert variant={webhookResult.success ? 'default' : 'destructive'}>
                <AlertDescription>
                  {webhookResult.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-gray-50 border rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Webhook Format</h4>
              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`POST ${organization.webhookUrl}
Headers:
  Content-Type: application/json
  X-Webhook-Signature: <hmac_signature>
  X-Webhook-Event: payment.succeeded

Body:
{
  "event": "payment.succeeded",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "paymentId": "uuid",
    "productId": "uuid",
    "customerWallet": "...",
    "amount": "50000000",
    "txSignature": "..."
  }
}`}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentation Links */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <a
              href="/docs/api"
              target="_blank"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="h-4 w-4" />
              API Documentation
            </a>
            <a
              href="/docs/webhooks"
              target="_blank"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="h-4 w-4" />
              Webhook Integration Guide
            </a>
            <a
              href="/docs/widget"
              target="_blank"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="h-4 w-4" />
              Payment Widget Setup
            </a>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}