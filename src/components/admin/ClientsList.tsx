import React, { useState } from 'react';
import { ClientProfile } from '@/hooks/useClients';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Loader2, User, Calendar, Eye, EyeOff, Trash2, Clock } from 'lucide-react';
import { format, parseISO, isAfter, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useExternalDb } from '@/hooks/useExternalDb';

const CUSTOM_AUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/custom-auth`;

interface ClientsListProps {
  clients: ClientProfile[];
  loading: boolean;
  searchTerm: string;
  onSearch: (term: string) => void;
  onSelectClient: (client: ClientProfile) => void;
  onClientCreated: () => void;
}

export const ClientsList: React.FC<ClientsListProps> = ({
  clients,
  loading,
  searchTerm,
  onSearch,
  onSelectClient,
  onClientCreated,
}) => {
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();
  const { query } = useExternalDb();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newClient, setNewClient] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    birth_date: '',
    birth_time: '',
    subscription_until: '',
  });

  const handleCreateClient = async () => {
    if (!newClient.email) {
      toast({
        title: 'Ошибка',
        description: 'Email обязателен',
        variant: 'destructive',
      });
      return;
    }

    if (!newClient.password || newClient.password.length < 6) {
      toast({
        title: 'Ошибка',
        description: 'Пароль обязателен (минимум 6 символов)',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    try {
      const authHeader = getAuthHeader();
      if (!authHeader) {
        toast({
          title: 'Ошибка',
          description: 'Необходима авторизация',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`${CUSTOM_AUTH_URL}?action=create-user`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newClient.email.trim(),
          password: newClient.password,
          first_name: newClient.first_name || null,
          last_name: newClient.last_name || null,
          birth_date: newClient.birth_date || null,
          birth_time: newClient.birth_time || null,
          subscription_until: newClient.subscription_until || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        let message = result.error || 'Не удалось создать клиента';
        if (result.error?.includes('already exists')) {
          message = 'Пользователь с таким email уже существует';
        }
        toast({
          title: 'Ошибка',
          description: message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Успешно',
        description: 'Клиент создан',
      });
      
      setIsDialogOpen(false);
      setNewClient({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        birth_date: '',
        birth_time: '',
        subscription_until: '',
      });
      setShowPassword(false);
      onClientCreated();
    } catch (error) {
      console.error('Create client error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать клиента',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    
    setDeleting(true);
    try {
      // Delete all related data first
      await query(`DELETE FROM life_navigator.tasks WHERE user_id = '${clientToDelete.id}'`);
      await query(`DELETE FROM life_navigator.habits WHERE user_id = '${clientToDelete.id}'`);
      await query(`DELETE FROM life_navigator.bazi_charts WHERE user_id = '${clientToDelete.id}'`);
      await query(`DELETE FROM life_navigator.individual_forecasts WHERE user_id = '${clientToDelete.id}'`);
      await query(`DELETE FROM life_navigator.user_hints WHERE user_id = '${clientToDelete.id}'`);
      await query(`DELETE FROM life_navigator.achievements WHERE user_id = '${clientToDelete.id}'`);
      await query(`DELETE FROM life_navigator.user_roles WHERE user_id = '${clientToDelete.id}'`);
      // Delete profile last
      await query(`DELETE FROM life_navigator.profiles WHERE id = '${clientToDelete.id}'`);
      
      toast({ title: 'Клиент удалён' });
      setDeleteConfirmOpen(false);
      setClientToDelete(null);
      onClientCreated(); // Refresh list
    } catch (error) {
      console.error('Delete client error:', error);
      toast({ 
        title: 'Ошибка', 
        description: 'Не удалось удалить клиента', 
        variant: 'destructive' 
      });
    } finally {
      setDeleting(false);
    }
  };

  const isSubscriptionActive = (date: string | null) => {
    if (!date) return false;
    return isAfter(parseISO(date), new Date());
  };

  const formatLastActivity = (lastActivity: string | null) => {
    if (!lastActivity) return null;
    try {
      return formatDistanceToNow(parseISO(lastActivity), { addSuffix: true, locale: ru });
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или email..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Новый клиент</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={newClient.password}
                    onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                    placeholder="Минимум 6 символов"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Имя</Label>
                  <Input
                    id="first_name"
                    value={newClient.first_name}
                    onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Фамилия</Label>
                  <Input
                    id="last_name"
                    value={newClient.last_name}
                    onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birth_date">Дата рождения</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={newClient.birth_date}
                    onChange={(e) => setNewClient({ ...newClient, birth_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth_time">Время рождения</Label>
                  <Input
                    id="birth_time"
                    type="time"
                    value={newClient.birth_time}
                    onChange={(e) => setNewClient({ ...newClient, birth_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscription">Подписка до</Label>
                <Input
                  id="subscription"
                  type="date"
                  value={newClient.subscription_until}
                  onChange={(e) => setNewClient({ ...newClient, subscription_until: e.target.value })}
                />
              </div>
              <Button onClick={handleCreateClient} className="w-full" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Создать'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm ? 'Клиенты не найдены' : 'Нет клиентов'}
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => onSelectClient(client)}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {client.first_name || client.last_name 
                        ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                        : client.email
                      }
                    </p>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{client.email}</span>
                      <span className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        {formatLastActivity(client.last_activity) ?? 'не заходил'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {client.subscription_until && (
                    <Badge variant={isSubscriptionActive(client.subscription_until) ? 'default' : 'secondary'}>
                      <Calendar className="h-3 w-3 mr-1" />
                      {format(parseISO(client.subscription_until), 'd MMM yyyy', { locale: ru })}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientToDelete(client);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить клиента{' '}
              <strong>
                {clientToDelete?.first_name || clientToDelete?.email}
              </strong>
              ? Все данные клиента будут безвозвратно удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
