import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useClients, ClientProfile } from '@/hooks/useClients';
import { ClientsList } from '@/components/admin/ClientsList';
import { ClientDetails } from '@/components/admin/ClientDetails';
import { ContentManagement } from '@/components/admin/ContentManagement';
import { Loader2, Users, Settings, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { getClients, loading: clientsLoading } = useClients();
  
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadClients();
    }
  }, [isAdmin]);

  const loadClients = async (search?: string) => {
    const result = await getClients(search);
    setClients(result);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    loadClients(term);
  };

  const handleSelectClient = (client: ClientProfile) => {
    setSelectedClient(client);
  };

  const handleBackToList = () => {
    setSelectedClient(null);
    loadClients(searchTerm);
  };

  const handleClientUpdated = () => {
    loadClients(searchTerm);
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedClient ? (
              <Button variant="ghost" size="icon" onClick={handleBackToList}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-bold">
              {selectedClient 
                ? `${selectedClient.first_name || ''} ${selectedClient.last_name || selectedClient.email}`.trim()
                : 'Админ-панель'
              }
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {selectedClient ? (
          <ClientDetails 
            client={selectedClient} 
            onBack={handleBackToList}
            onUpdated={handleClientUpdated}
          />
        ) : (
          <Tabs defaultValue="clients" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="clients" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Клиенты
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Контент
              </TabsTrigger>
            </TabsList>

            <TabsContent value="clients">
              <ClientsList
                clients={clients}
                loading={clientsLoading}
                searchTerm={searchTerm}
                onSearch={handleSearch}
                onSelectClient={handleSelectClient}
                onClientCreated={() => loadClients(searchTerm)}
              />
            </TabsContent>

            <TabsContent value="content">
              <ContentManagement />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Admin;
