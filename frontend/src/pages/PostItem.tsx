import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, X, Image as ImageIcon } from "lucide-react";
import client from "@/lib/api";
import { authApi } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES } from "@/lib/constants";

export default function PostItem() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    type: "Lost",
    location: "",
    priority: "Normal",
    contact_info: "",
  });

  useEffect(() => {
    // Cleanup preview URL on unmount
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

    // Validate size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size allowed is 10MB");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    const fileInput = document.getElementById("image-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.type) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      let uploadedImageUrl = "";
      if (selectedFile) {
        uploadedImageUrl = await authApi.uploadImage(selectedFile);
      }

      await client.entities.items.create({
        data: {
          ...form,
          images: uploadedImageUrl ? JSON.stringify([uploadedImageUrl]) : null,
          status: "Active",
        },
      });

      toast.success("Item posted successfully!");
      navigate("/");
    } catch (err: any) {
      toast.error(err?.message || "Failed to post item");
    } finally {
      setLoading(false);
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
        <div className="container mx-auto max-w-md px-4 py-20 text-center">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-muted-foreground">Posting items requires authentication.</p>
              <Button onClick={() => authApi.login()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                Log In to Post Item
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Post a Lost or Found Item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Type *</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lost">Lost</SelectItem>
                      <SelectItem value="Found">Found</SelectItem>
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
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Blue Backpack with Laptop"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the item in detail..."
                  rows={3}
                />
              </div>

              {/* Image Upload Field */}
              <div className="space-y-2">
                <Label>Upload Image</Label>
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
                  <Label>Category *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g., Library, 2nd Floor"
                  />
                </div>
              </div>

              <div>
                <Label>Contact Information</Label>
                <Input
                  value={form.contact_info}
                  onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                  placeholder="Phone number or email"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? "Posting..." : "Post Item"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}