import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, X, Image as ImageIcon } from "lucide-react";
import client from "@/lib/api";
import { authApi } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES, STATUSES } from "@/lib/constants";

export default function EditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    type: "Lost",
    location: "",
    priority: "Normal",
    status: "Active",
    contact_info: "",
  });

  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  useEffect(() => {
    fetchItem();
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [id]);

  const fetchItem = async () => {
    try {
      const res = await client.entities.items.get({ id: String(id) });
      const data = res.data;
      setForm({
        title: data.title || "",
        description: data.description || "",
        category: data.category || "",
        type: data.type || "Lost",
        location: data.location || "",
        priority: data.priority || "Normal",
        status: data.status || "Active",
        contact_info: data.contact_info || "",
      });

      if (data.images) {
        try {
          const parsed = JSON.parse(data.images);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setExistingImages(parsed);
            setPreviewUrl(parsed[0]);
          }
        } catch {
          // fallback
        }
      }
    } catch {
      toast.error("Failed to load item");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (robust check using MIME and file extension fallback)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const fileType = file.type.toLowerCase();
    const hasExtension = file.name.includes(".");
    const fileExtension = hasExtension 
      ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      : "";

    // Allow files without extension, or files matching allowed types/extensions
    const isAllowed = !hasExtension || allowedTypes.includes(fileType) || allowedExtensions.includes(fileExtension);

    if (!isAllowed) {
      toast.error("Invalid file type. Allowed formats: JPG, JPEG, PNG, WEBP");
      e.target.value = "";
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size allowed is 10MB");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setImageRemoved(false);
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImageRemoved(true);
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    const fileInput = document.getElementById("image-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalImagesJson = null;

      if (selectedFile) {
        // User uploaded a new image
        const newUrl = await authApi.uploadImage(selectedFile);
        finalImagesJson = JSON.stringify([newUrl]);
      } else if (imageRemoved) {
        // User removed the image
        finalImagesJson = null;
      } else if (existingImages.length > 0) {
        // Keep the old image
        finalImagesJson = JSON.stringify(existingImages);
      }

      await client.entities.items.update({
        id: String(id),
        data: {
          ...form,
          images: finalImagesJson,
        },
      });

      toast.success("Item updated successfully!");
      navigate(`/item/${id}`);
    } catch {
      toast.error("Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  // Double check authorization
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(`/item/${id}`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Edit Item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lost">Lost</SelectItem>
                      <SelectItem value="Found">Found</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>

              {/* Image Upload / Edit Field */}
              <div className="space-y-2">
                <Label>Item Image</Label>
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors relative">
                  {!previewUrl ? (
                    <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-32 cursor-pointer">
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium">Click to select image</span>
                      <span className="text-xs text-muted-foreground mt-1">PNG, JPG, JPEG, WEBP (Max 10MB)</span>
                    </label>
                  ) : (
                    <div className="relative w-full max-h-48 overflow-hidden rounded-md flex justify-center">
                      <img src={previewUrl} alt="Preview" className="max-h-48 object-contain rounded-md" />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1 bg-black/75 hover:bg-black text-white rounded-full transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <Input
                    id="image-upload"
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>

              <div>
                <Label>Contact Information</Label>
                <Input value={form.contact_info} onChange={(e) => setForm({ ...form, contact_info: e.target.value })} />
              </div>

              <Button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}