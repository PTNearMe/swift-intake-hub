import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, Download, Users, FileText, CheckCircle, Clock } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

interface IntakeForm {
  id: string;
  patient_id: string;
  signed_at: string | null;
  pdf_url: string | null;
  email_sent: boolean;
  fax_sent: boolean;
  created_at: string;
  patients: Patient;
}

const AdminDashboard = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalPatients: 0,
    completedForms: 0,
    pendingForms: 0,
    generatedPdfs: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch intake forms with patient data
      const { data: forms, error: formsError } = await supabase
        .from('intake_forms')
        .select(`
          id,
          patient_id,
          signed_at,
          pdf_url,
          email_sent,
          fax_sent,
          created_at,
          patients (
            id,
            name,
            phone,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (formsError) throw formsError;

      // Fetch patient count
      const { count: patientCount, error: patientError } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      if (patientError) throw patientError;

      setIntakeForms(forms || []);

      // Calculate stats
      const completed = forms?.filter(f => f.signed_at).length || 0;
      const pending = (forms?.length || 0) - completed;
      const withPdfs = forms?.filter(f => f.pdf_url).length || 0;

      setStats({
        totalPatients: patientCount || 0,
        completedForms: completed,
        pendingForms: pending,
        generatedPdfs: withPdfs,
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredForms = intakeForms.filter((form) =>
    form.patients.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.patients.phone && form.patients.phone.includes(searchTerm))
  );

  const handleDownloadPdf = (pdfUrl: string, patientName: string) => {
    window.open(pdfUrl, '_blank');
  };

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-muted-foreground">Patient Intake Management System</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user?.email}
              </span>
              <Button variant="outline" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Patients</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalPatients}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Completed Forms</p>
                  <p className="text-2xl font-bold text-foreground">{stats.completedForms}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Pending Forms</p>
                  <p className="text-2xl font-bold text-foreground">{stats.pendingForms}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Generated PDFs</p>
                  <p className="text-2xl font-bold text-foreground">{stats.generatedPdfs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Patient Intake Forms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Patient Table */}
            <div className="border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead>Email/Fax</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredForms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell className="font-medium">
                        {form.patients.name}
                      </TableCell>
                      <TableCell>
                        {form.patients.phone || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={form.signed_at ? "default" : "secondary"}
                        >
                          {form.signed_at ? 'Completed' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(form.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {form.signed_at 
                          ? format(new Date(form.signed_at), 'MMM dd, yyyy')
                          : 'Not signed'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Badge variant={form.email_sent ? "default" : "secondary"} className="text-xs">
                            {form.email_sent ? 'Email ✓' : 'Email ✗'}
                          </Badge>
                          <Badge variant={form.fax_sent ? "default" : "secondary"} className="text-xs">
                            {form.fax_sent ? 'Fax ✓' : 'Fax ✗'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {form.pdf_url ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPdf(form.pdf_url!, form.patients.name)}
                            className="text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">No PDF</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredForms.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No intake forms found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;