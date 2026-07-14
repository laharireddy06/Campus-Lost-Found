import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle, Clock, AlertCircle, Plus } from "lucide-react";
import client from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ItemData } from "@/lib/constants";

interface DashboardStats {
  total_posts: number;
  active_posts: number;
  claimed_items: number;
  pending_claims: number;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myItems, setMyItems] = useState<ItemData[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboard();
      fetchMyItems();
    }
  }, [user]);

  const fetchDashboard = async () => {
    try {
      const res = await client.apiCall.invoke({
        url: "/api/v1/hub/dashboard",
        method: "GET",
        data: {},
      });
      setStats(res.data);
    } catch {
      // ignore
    }
  };

  const fetchMyItems = async () => {
    try {
      const res = await client.entities.items.query({
        query: {},
        sort: "-created_at",
        limit: 20,
      });
      setMyItems(res.data?.items || []);
    } catch {
      // ignore
    } finally {
      setLoadingItems(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">Dashboard access requires authentication.</p>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Link to="/post">
              <Plus className="h-4 w-4 mr-2" />
              Post Item
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total_posts}</p>
                  <p className="text-xs text-muted-foreground">Total Posts</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active_posts}</p>
                  <p className="text-xs text-muted-foreground">Active Posts</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.claimed_items}</p>
                  <p className="text-xs text-muted-foreground">Claimed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending_claims}</p>
                  <p className="text-xs text-muted-foreground">Pending Claims</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* My Items */}
        <Card>
          <CardHeader>
            <CardTitle>My Items</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingItems ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : myItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You haven't posted any items yet.</p>
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Link to="/post">Post Your First Item</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myItems.map((item) => (
                  <Link
                    key={item.id}
                    to={`/item/${item.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <Badge variant={item.type === "Lost" ? "destructive" : "default"} className={item.type === "Found" ? "bg-emerald-500 text-white" : ""}>
                          {item.type}
                        </Badge>
                        {item.priority === "Urgent" && (
                          <Badge className="bg-amber-500 text-white">Urgent</Badge>
                        )}
                      </div>
                      <span className="font-medium text-sm">{item.title}</span>
                    </div>
                    <Badge variant="secondary">{item.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}