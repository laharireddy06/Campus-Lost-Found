import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Clock, AlertTriangle, ChevronLeft, ChevronRight, Image, Check } from "lucide-react";
import { Link } from "react-router-dom";
import client from "@/lib/api";
import { CATEGORIES, ItemData } from "@/lib/constants";

export default function Index() {
  const [items, setItems] = useState<ItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(0);
  const limit = 12;

  const [stats, setStats] = useState({ total_lost_items: 0, total_found_items: 0, total_claimed: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [page, category, activeFilter, priority]);

  const fetchStats = async () => {
    try {
      const res = await client.apiCall.invoke({
        url: "/api/v1/hub/stats",
        method: "GET",
        data: {},
      });
      setStats(res.data);
    } catch {
      // ignore
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        skip: String(page * limit),
        limit: String(limit),
        sort: "priority_first",
      };
      if (search) params.search = search;
      if (category) params.category = category;
      if (priority) params.priority = priority;

      if (activeFilter === "lost") {
        params.type = "Lost";
      } else if (activeFilter === "found") {
        params.type = "Found";
      } else if (activeFilter === "active") {
        params.status = "Active";
      } else if (activeFilter === "reunited") {
        params.status = "Reunited";
      }

      const res = await client.apiCall.invoke({
        url: "/api/v1/hub/items",
        method: "GET",
        data: params,
      });
      setItems(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(0);
    fetchItems();
  };

  const totalPages = Math.ceil(total / limit);

  const getImageUrl = (item: ItemData) => {
    if (!item.images) return null;
    try {
      const imgs = JSON.parse(item.images);
      return imgs.length > 0 ? imgs[0] : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-12 px-4">
        <div className="container mx-auto max-w-7xl text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Lost & Found Campus Hub</h1>
          <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
            Report lost items, find misplaced belongings, and connect with item owners on campus.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <span className="font-bold text-lg">{stats.total_lost_items}</span>
              <p className="text-indigo-100">Lost Items</p>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <span className="font-bold text-lg">{stats.total_found_items}</span>
              <p className="text-indigo-100">Found Items</p>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <span className="font-bold text-lg">{stats.total_claimed}</span>
              <p className="text-indigo-100">Reunited Items</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="container mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items by title or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={category} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Old Type Select removed to avoid clutter; integrated as clean visual tabs below */}
          <Select value={priority} onValueChange={(v) => { setPriority(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Search
          </Button>
        </div>
      </section>

      {/* Primary Tab Filters */}
      <div className="container mx-auto max-w-7xl px-4 mb-6">
        <div className="flex gap-2 border-b pb-2 overflow-x-auto">
          {[
            { id: "all", label: "All Items" },
            { id: "lost", label: "Lost" },
            { id: "found", label: "Found" },
            { id: "active", label: "Active" },
            { id: "reunited", label: "Reunited" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveFilter(tab.id);
                setPage(0);
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <section className="container mx-auto max-w-7xl px-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-40 bg-muted rounded-md mb-3" />
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No items found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <Link key={item.id} to={`/item/${item.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border relative overflow-hidden">
                    {item.priority === "Urgent" && (
                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="bg-amber-500 text-white flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Urgent
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="h-40 bg-muted rounded-md mb-3 overflow-hidden flex items-center justify-center relative">
                        {getImageUrl(item) ? (
                          <img
                            src={getImageUrl(item)!}
                            alt={item.title}
                            className="w-full h-full object-cover rounded-md hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Image className="h-10 w-10 opacity-30 mb-1" />
                            <span className="text-xs opacity-50">No Image</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {item.status === "Reunited" ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Reunited
                          </Badge>
                        ) : (
                          <Badge variant={item.type === "Lost" ? "destructive" : "default"} className={item.type === "Found" ? "bg-emerald-500 text-white hover:bg-emerald-500" : ""}>
                            {item.type}
                          </Badge>
                        )}
                        <Badge variant="outline">{item.category}</Badge>
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-1 mb-1">{item.title}</h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {item.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.location}
                          </span>
                        )}
                        {item.status === "Reunited" && item.reunited_at ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            {new Date(item.reunited_at).toLocaleDateString()}
                          </span>
                        ) : item.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {item.status !== "Active" && item.status !== "Reunited" && (
                        <Badge variant="secondary" className="mt-2 text-xs">{item.status}</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}