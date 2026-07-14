import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MapPin, Clock, AlertTriangle, ArrowLeft, Send, Check, X as XIcon, Loader2, Edit, Trash2, Image } from "lucide-react";
import client from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/auth";
import { ItemData } from "@/lib/constants";

interface Claim {
  id: number;
  user_id: string;
  item_id: number;
  message?: string;
  status: string;
  created_at?: string;
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimMessage, setClaimMessage] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    fetchItem();
  }, [id]);

  useEffect(() => {
    if (user && item) {
      const ownerCheck = item.user_id === user.id;
      setIsOwner(ownerCheck);
      if (ownerCheck) fetchClaims();
    } else {
      setIsOwner(false);
    }
  }, [user, item]);

  const fetchItem = async () => {
    try {
      const res = await client.apiCall.invoke({
        url: `/api/v1/hub/items/${id}`,
        method: "GET",
        data: {},
      });
      setItem(res.data);
    } catch {
      toast.error("Item not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchClaims = async () => {
    try {
      const res = await client.apiCall.invoke({
        url: `/api/v1/hub/claims/item/${id}`,
        method: "GET",
        data: {},
      });
      setClaims(res.data || []);
    } catch {
      // ignore
    }
  };

  const handleClaim = async () => {
    if (!user) {
      authApi.login();
      return;
    }
    setClaiming(true);
    try {
      await client.apiCall.invoke({
        url: "/api/v1/hub/claims",
        method: "POST",
        data: { item_id: Number(id), message: claimMessage },
      });
      toast.success("Claim submitted successfully!");
      setClaimDialogOpen(false);
      setClaimMessage("");
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || "Failed to submit claim");
    } finally {
      setClaiming(false);
    }
  };

  const handleApproveClaim = async (claimId: number) => {
    try {
      await client.apiCall.invoke({
        url: `/api/v1/hub/claims/${claimId}/approve`,
        method: "PUT",
        data: {},
      });
      toast.success("Claim approved!");
      fetchClaims();
      fetchItem();
    } catch (err: any) {
      toast.error(err?.data?.detail || "Failed to approve claim");
    }
  };

  const handleRejectClaim = async (claimId: number) => {
    try {
      await client.apiCall.invoke({
        url: `/api/v1/hub/claims/${claimId}/reject`,
        method: "PUT",
        data: {},
      });
      toast.success("Claim rejected");
      fetchClaims();
    } catch (err: any) {
      toast.error(err?.data?.detail || "Failed to reject claim");
    }
  };

  const handleMarkReunited = async () => {
    const confirm = window.confirm("Are you sure you want to mark this item as reunited?");
    if (!confirm) return;

    try {
      await client.apiCall.invoke({
        url: `/api/v1/entities/items/${item?.id}/reunited`,
        method: "PATCH",
        data: {},
      });
      toast.success("Item successfully marked as Reunited!");
      fetchItem();
    } catch {
      toast.error("Failed to mark item as reunited");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await client.entities.items.delete({ id: String(item!.id) });
      toast.success("Item deleted");
      navigate("/");
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const getImages = (): string[] => {
    if (!item?.images) return [];
    try {
      return JSON.parse(item.images);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (!item) return null;

  const images = getImages();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Feed
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Images */}
          <div>
            {images.length > 0 ? (
              <div className="space-y-3">
                <div className="aspect-square rounded-lg overflow-hidden border bg-muted animate-in fade-in">
                  <img src={images[0]} alt={item.title} className="w-full h-full object-cover" />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {images.slice(1).map((img, i) => (
                      <div key={i} className="w-16 h-16 rounded-md overflow-hidden border flex-shrink-0">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-square rounded-lg overflow-hidden border bg-muted flex flex-col items-center justify-center text-muted-foreground p-6">
                <Image className="h-16 w-16 opacity-20 mb-2 animate-pulse" />
                <span className="text-sm opacity-50">No Image Available</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={item.type === "Lost" ? "destructive" : "default"} className={item.type === "Found" ? "bg-emerald-500 text-white" : ""}>
                {item.type}
              </Badge>
              <Badge variant="outline">{item.category}</Badge>
              {item.priority === "Urgent" && (
                <Badge className="bg-amber-500 text-white">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Urgent
                </Badge>
              )}
              <Badge variant="secondary">{item.status}</Badge>
            </div>

            <h1 className="text-2xl font-bold">{item.title}</h1>

            {item.description && (
              <p className="text-muted-foreground">{item.description}</p>
            )}

            <div className="space-y-2 text-sm">
              {item.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{item.location}</span>
                </div>
              )}
              {item.created_at && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(item.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              )}
              {item.contact_info && (
                <div className="text-muted-foreground">
                  <span className="font-medium">Contact:</span> {item.contact_info}
                </div>
              )}
              {item.status === "Reunited" && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-emerald-800 dark:text-emerald-300 text-sm mt-3 flex items-center gap-2">
                  <Check className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-semibold">Reunited:</span> This item has been successfully reunited
                    {item.reunited_at && ` on ${new Date(item.reunited_at).toLocaleDateString()}`}!
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              {!isOwner && item.status === "Active" && (
                <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      <Send className="h-4 w-4 mr-2" />
                      Claim This Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Submit a Claim</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Describe why you believe this item belongs to you or how you can identify it.
                      </p>
                      <Textarea
                        value={claimMessage}
                        onChange={(e) => setClaimMessage(e.target.value)}
                        placeholder="I can identify this item because..."
                        rows={4}
                      />
                      <Button
                        onClick={handleClaim}
                        disabled={claiming}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {claiming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Submit Claim
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {isOwner && (
                <>
                  {item.status === "Active" && (
                    <Button onClick={handleMarkReunited} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Check className="h-4 w-4 mr-2" />
                      Mark Reunited
                    </Button>
                  )}
                  <Button variant="outline" asChild disabled={item.status === "Reunited"}>
                    <Link to={item.status === "Reunited" ? "#" : `/item/${item.id}/edit`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Claims Section (Owner Only) */}
        {isOwner && claims.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Claims ({claims.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {claims.map((claim) => (
                <div key={claim.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm">{claim.message || "No message provided"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={claim.status === "Approved" ? "default" : claim.status === "Rejected" ? "destructive" : "secondary"}>
                        {claim.status}
                      </Badge>
                      {claim.created_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(claim.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {claim.status === "Pending" && (
                    <div className="flex gap-1 ml-3">
                      <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleApproveClaim(claim.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleRejectClaim(claim.id)}>
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}